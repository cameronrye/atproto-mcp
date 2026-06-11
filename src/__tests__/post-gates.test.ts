/**
 * Reply and quote controls on post creation.
 *
 * create_post / create_thread can write an app.bsky.feed.threadgate record
 * (who can reply) and create_post an app.bsky.feed.postgate record (quote
 * policy) after the post itself is created. Per the lexicons, a gate record's
 * rkey MUST equal the gated post's rkey and live in the same repository, and
 * a threadgate with `allow: []` means nobody can reply (absent = anyone).
 *
 * Contract under test:
 * - gate records are written via com.atproto.repo.putRecord with the post's
 *   own rkey/repo, parsed from the created post's AT-URI;
 * - invalid replyControls (non-list allowListUris, >5 rules) are rejected
 *   BEFORE any post is published;
 * - a gate-write failure AFTER the post succeeded must NOT fail the call:
 *   the result stays success:true with gateApplied:false and a warning;
 * - create_thread applies replyControls to the ROOT post only, after the
 *   whole thread is published (and still gates the root on partial failure).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreatePostTool } from '../tools/implementations/create-post-tool.js';
import { CreateThreadTool } from '../tools/implementations/create-thread-tool.js';
import { ValidationError } from '../types/index.js';
import type { AtpClient } from '../utils/atp-client.js';

const SELF = 'did:plc:self';
const POST_URI = `at://${SELF}/app.bsky.feed.post/post1`;
const LIST_URI = `at://${SELF}/app.bsky.graph.list/mylist`;

const THREADGATE = 'app.bsky.feed.threadgate';
const POSTGATE = 'app.bsky.feed.postgate';

function mockClient(overrides?: {
  post?: ReturnType<typeof vi.fn>;
  putRecord?: ReturnType<typeof vi.fn>;
}) {
  const post =
    overrides?.post ??
    vi.fn().mockResolvedValue({
      uri: POST_URI,
      cid: 'bafyreidfgezpvbixbf63xgkpcfjjxgsfi4cyx3vrm6auzkqq7gcyzql4tu',
    });
  const putRecord =
    overrides?.putRecord ??
    vi.fn().mockResolvedValue({ success: true, data: { uri: 'at://gate', cid: 'cidgate' } });
  const agent = {
    post,
    session: { did: SELF },
    com: { atproto: { repo: { putRecord } } },
  };
  const client = {
    getAgent: vi.fn().mockReturnValue(agent),
    isAuthenticated: vi.fn().mockReturnValue(true),
    hasCredentials: vi.fn().mockReturnValue(true),
    executeAuthenticatedRequest: vi.fn().mockImplementation(async (op: () => unknown) => {
      try {
        return { success: true, data: await op() };
      } catch (error) {
        return { success: false, error };
      }
    }),
  } as unknown as AtpClient;
  return { client, post, putRecord };
}

interface IGateRule {
  $type: string;
  list?: string;
}

interface IPutRecordCall {
  repo: string;
  collection: string;
  rkey: string;
  record: {
    $type: string;
    post: string;
    createdAt: string;
    allow?: IGateRule[];
    embeddingRules?: IGateRule[];
  };
}

describe('create_post replyControls (threadgate)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes a threadgate record with the SAME rkey as the post', async () => {
    const { client, post, putRecord } = mockClient();
    const tool = new CreatePostTool(client);

    const result = await tool.handler({
      text: 'gated post',
      replyControls: {
        allowMentioned: true,
        allowFollowing: true,
        allowListUris: [LIST_URI],
      },
    });

    expect(post).toHaveBeenCalledTimes(1);
    expect(putRecord).toHaveBeenCalledTimes(1);
    const call = putRecord.mock.calls[0]![0] as IPutRecordCall;
    expect(call.repo).toBe(SELF);
    expect(call.collection).toBe(THREADGATE);
    expect(call.rkey).toBe('post1');
    expect(call.record.$type).toBe(THREADGATE);
    expect(call.record.post).toBe(POST_URI);
    expect(typeof call.record.createdAt).toBe('string');
    const types = call.record.allow!.map(rule => rule.$type);
    expect(types).toContain('app.bsky.feed.threadgate#mentionRule');
    expect(types).toContain('app.bsky.feed.threadgate#followingRule');
    expect(types).not.toContain('app.bsky.feed.threadgate#followerRule');
    const listRule = call.record.allow!.find(
      rule => rule.$type === 'app.bsky.feed.threadgate#listRule'
    );
    expect(listRule?.list).toBe(LIST_URI);
    expect(result.success).toBe(true);
    expect(result.gateApplied).toBe(true);
  });

  it('maps allowFollowers to followerRule', async () => {
    const { client, putRecord } = mockClient();
    const tool = new CreatePostTool(client);

    await tool.handler({ text: 'gated post', replyControls: { allowFollowers: true } });

    const call = putRecord.mock.calls[0]![0] as IPutRecordCall;
    expect(call.record.allow).toEqual([{ $type: 'app.bsky.feed.threadgate#followerRule' }]);
  });

  it('writes allow: [] (nobody can reply) for replyControls with no rules enabled', async () => {
    const { client, putRecord } = mockClient();
    const tool = new CreatePostTool(client);

    await tool.handler({ text: 'locked post', replyControls: {} });

    const call = putRecord.mock.calls[0]![0] as IPutRecordCall;
    expect(call.collection).toBe(THREADGATE);
    expect(call.record.allow).toEqual([]);
  });

  it('rejects an allowListUris entry that is not an app.bsky.graph.list URI before posting', async () => {
    const { client, post, putRecord } = mockClient();
    const tool = new CreatePostTool(client);

    await expect(
      tool.handler({
        text: 'gated post',
        replyControls: { allowListUris: [`at://${SELF}/app.bsky.feed.post/notalist`] },
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(post).not.toHaveBeenCalled();
    expect(putRecord).not.toHaveBeenCalled();
  });

  it('rejects more than 5 allow rules before posting (lexicon maxLength)', async () => {
    const { client, post } = mockClient();
    const tool = new CreatePostTool(client);

    await expect(
      tool.handler({
        text: 'gated post',
        replyControls: {
          allowMentioned: true,
          allowFollowing: true,
          allowFollowers: true,
          allowListUris: [
            `at://${SELF}/app.bsky.graph.list/a`,
            `at://${SELF}/app.bsky.graph.list/b`,
            `at://${SELF}/app.bsky.graph.list/c`,
          ],
        },
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(post).not.toHaveBeenCalled();
  });

  it('returns success with gateApplied:false and a warning when the gate write fails', async () => {
    const putRecord = vi.fn().mockRejectedValue(new Error('boom'));
    const { client } = mockClient({ putRecord });
    const tool = new CreatePostTool(client);

    const result = await tool.handler({ text: 'gated post', replyControls: {} });

    expect(result.success).toBe(true);
    expect(result.uri).toBe(POST_URI);
    expect(result.gateApplied).toBe(false);
    expect(typeof result.warning).toBe('string');
    expect(result.warning.length).toBeGreaterThan(0);
  });

  it('writes no gate and omits gateApplied when no controls are given', async () => {
    const { client, putRecord } = mockClient();
    const tool = new CreatePostTool(client);

    const result = await tool.handler({ text: 'plain post' });

    expect(putRecord).not.toHaveBeenCalled();
    expect(result.gateApplied).toBeUndefined();
    expect(result.warning).toBeUndefined();
  });
});

describe('create_post quoteControls (postgate)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes a postgate with disableRule (same rkey) when allowQuotes is false', async () => {
    const { client, putRecord } = mockClient();
    const tool = new CreatePostTool(client);

    const result = await tool.handler({
      text: 'no quotes please',
      quoteControls: { allowQuotes: false },
    });

    expect(putRecord).toHaveBeenCalledTimes(1);
    const call = putRecord.mock.calls[0]![0] as IPutRecordCall;
    expect(call.repo).toBe(SELF);
    expect(call.collection).toBe(POSTGATE);
    expect(call.rkey).toBe('post1');
    expect(call.record.$type).toBe(POSTGATE);
    expect(call.record.post).toBe(POST_URI);
    expect(call.record.embeddingRules).toEqual([{ $type: 'app.bsky.feed.postgate#disableRule' }]);
    expect(result.gateApplied).toBe(true);
  });

  it('writes no postgate when allowQuotes is true (the network default)', async () => {
    const { client, putRecord } = mockClient();
    const tool = new CreatePostTool(client);

    const result = await tool.handler({
      text: 'quotes welcome',
      quoteControls: { allowQuotes: true },
    });

    expect(putRecord).not.toHaveBeenCalled();
    expect(result.gateApplied).toBe(true);
  });

  it('applies both gates and reports a warning when only the postgate fails', async () => {
    const putRecord = vi.fn().mockImplementation(async (input: IPutRecordCall) => {
      if (input.collection === POSTGATE) throw new Error('postgate boom');
      return { success: true, data: {} };
    });
    const { client } = mockClient({ putRecord });
    const tool = new CreatePostTool(client);

    const result = await tool.handler({
      text: 'gated post',
      replyControls: { allowMentioned: true },
      quoteControls: { allowQuotes: false },
    });

    expect(putRecord).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(result.gateApplied).toBe(false);
    expect(result.warning).toMatch(/quote controls/i);
    expect(result.warning).toContain('app.bsky.feed.postgate');
  });
});

describe('create_thread replyControls (threadgate on the root post)', () => {
  beforeEach(() => vi.clearAllMocks());

  const threePosts = [{ text: 'Post 1' }, { text: 'Post 2' }, { text: 'Post 3' }];

  function sequencedPost() {
    let calls = 0;
    return vi.fn().mockImplementation(async () => {
      calls++;
      return { uri: `at://${SELF}/app.bsky.feed.post/${calls}`, cid: `cid${calls}` };
    });
  }

  it('gates the ROOT post only, after every post in the thread is published', async () => {
    const post = sequencedPost();
    const { client, putRecord } = mockClient({ post });
    const tool = new CreateThreadTool(client);

    const result = await tool.handler({
      posts: threePosts,
      replyControls: { allowFollowing: true },
    });

    expect(post).toHaveBeenCalledTimes(3);
    expect(putRecord).toHaveBeenCalledTimes(1);
    const call = putRecord.mock.calls[0]![0] as IPutRecordCall;
    expect(call.collection).toBe(THREADGATE);
    expect(call.rkey).toBe('1'); // the root post's rkey
    expect(call.record.post).toBe(`at://${SELF}/app.bsky.feed.post/1`);
    expect(call.record.allow).toEqual([{ $type: 'app.bsky.feed.threadgate#followingRule' }]);
    // The gate is written only after the LAST post, so the thread's own
    // in-thread replies are never subject to it.
    const lastPostOrder = post.mock.invocationCallOrder[2]!;
    const gateOrder = putRecord.mock.invocationCallOrder[0]!;
    expect(gateOrder).toBeGreaterThan(lastPostOrder);
    expect(result.success).toBe(true);
    expect(result.gateApplied).toBe(true);
  });

  it('returns success with gateApplied:false and a warning when the gate write fails', async () => {
    const post = sequencedPost();
    const putRecord = vi.fn().mockRejectedValue(new Error('gate boom'));
    const { client } = mockClient({ post, putRecord });
    const tool = new CreateThreadTool(client);

    const result = await tool.handler({
      posts: threePosts,
      replyControls: { allowMentioned: true },
    });

    expect(result.success).toBe(true);
    expect(result.totalPosts).toBe(3);
    expect(result.gateApplied).toBe(false);
    expect(typeof result.warning).toBe('string');
  });

  it('still gates the live root post when the thread partially fails', async () => {
    let calls = 0;
    const post = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls === 3) throw new Error('rate limited');
      return { uri: `at://${SELF}/app.bsky.feed.post/${calls}`, cid: `cid${calls}` };
    });
    const { client, putRecord } = mockClient({ post });
    const tool = new CreateThreadTool(client);

    const result = await tool.handler({
      posts: threePosts,
      replyControls: { allowMentioned: true },
    });

    expect(result.success).toBe(false);
    expect(result.failedAtPosition).toBe(3);
    expect(putRecord).toHaveBeenCalledTimes(1);
    const call = putRecord.mock.calls[0]![0] as IPutRecordCall;
    expect(call.rkey).toBe('1');
    expect(result.gateApplied).toBe(true);
  });

  it('rejects invalid allowListUris before publishing any post', async () => {
    const post = sequencedPost();
    const { client, putRecord } = mockClient({ post });
    const tool = new CreateThreadTool(client);

    await expect(
      tool.handler({
        posts: threePosts,
        replyControls: { allowListUris: ['https://not-an-at-uri.example'] },
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(post).not.toHaveBeenCalled();
    expect(putRecord).not.toHaveBeenCalled();
  });

  it('writes no gate when replyControls is omitted', async () => {
    const post = sequencedPost();
    const { client, putRecord } = mockClient({ post });
    const tool = new CreateThreadTool(client);

    const result = await tool.handler({ posts: threePosts });

    expect(putRecord).not.toHaveBeenCalled();
    expect(result.gateApplied).toBeUndefined();
  });
});
