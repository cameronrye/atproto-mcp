/**
 * Write-path safety regression tests: explicit facets and embeds.
 *
 * - create_post: explicit facet byte offsets must fall on UTF-8 codepoint
 *   boundaries — an offset inside a multi-byte character produces a corrupt
 *   facet that the PDS accepts but clients render garbled.
 * - create_post: explicit mention values with a leading '@' and hashtag values
 *   with a leading '#' are normalized (otherwise handle resolution fails and a
 *   literal "#tag" tag is recorded).
 * - create_post: embed.external accepts an optional pre-uploaded thumb blob so
 *   generate_link_preview's uploaded thumbnail is not orphaned.
 * - like_post / repost: the idempotent already-exists branch has no record CID
 *   to return — the output contract makes cid optional instead of lying with ''.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreatePostTool } from '../tools/implementations/create-post-tool.js';
import { LikePostTool } from '../tools/implementations/like-post-tool.js';
import { RepostTool } from '../tools/implementations/repost-tool.js';
import { ValidationError } from '../types/index.js';
import type { AtpClient } from '../utils/atp-client.js';

const SELF = 'did:plc:self';

// Wrap an operation the way AtpClient.executeAuthenticatedRequest does.
const wrap = async (op: () => unknown) => {
  try {
    return { success: true, data: await op() };
  } catch (error) {
    return { success: false, error };
  }
};

function makeClient(agentParts: Record<string, unknown>): AtpClient {
  const agent = { session: { did: SELF }, ...agentParts };
  return {
    getAgent: vi.fn().mockReturnValue(agent),
    isAuthenticated: vi.fn().mockReturnValue(true),
    hasCredentials: vi.fn().mockReturnValue(true),
    executeAuthenticatedRequest: vi.fn().mockImplementation(wrap),
    executePublicRequest: vi.fn().mockImplementation(wrap),
  } as unknown as AtpClient;
}

function createPostClient() {
  const post = vi.fn().mockResolvedValue({
    uri: `at://${SELF}/app.bsky.feed.post/created`,
    cid: 'bafycreated01',
  });
  const resolveHandle = vi.fn().mockResolvedValue({ data: { did: 'did:plc:bob' } });
  const client = makeClient({ post, com: { atproto: { identity: { resolveHandle } } } });
  return { client, post, resolveHandle };
}

describe('create_post explicit facet UTF-8 boundary alignment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a byteStart that splits a multi-byte codepoint', async () => {
    const { client, post } = createPostClient();
    const tool = new CreatePostTool(client);

    await expect(
      tool.handler({
        // '😀' is 4 UTF-8 bytes (0..4); byteStart 2 lands inside it.
        text: '😀 see this',
        facets: [
          {
            index: { byteStart: 2, byteEnd: 10 },
            features: [{ type: 'link', value: 'https://x.com' }],
          },
        ],
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects a byteEnd that splits a multi-byte codepoint', async () => {
    const { client, post } = createPostClient();
    const tool = new CreatePostTool(client);

    await expect(
      tool.handler({
        // 'é' is 2 UTF-8 bytes at offsets 5..7 ("see c[é]dille"); byteEnd 6 splits it.
        text: 'see cédille',
        facets: [
          {
            index: { byteStart: 4, byteEnd: 6 },
            features: [{ type: 'link', value: 'https://x.com' }],
          },
        ],
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(post).not.toHaveBeenCalled();
  });

  it('accepts a range that exactly covers a multi-byte codepoint', async () => {
    const { client, post } = createPostClient();
    const tool = new CreatePostTool(client);

    const result = await tool.handler({
      text: '😀 see this',
      facets: [
        {
          index: { byteStart: 0, byteEnd: 4 }, // the whole emoji
          features: [{ type: 'link', value: 'https://x.com' }],
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe('create_post explicit facet value normalization', () => {
  beforeEach(() => vi.clearAllMocks());

  it("strips a leading '@' from a mention value before resolving the handle", async () => {
    const { client, post, resolveHandle } = createPostClient();
    const tool = new CreatePostTool(client);

    await tool.handler({
      text: 'hi @bob',
      facets: [
        {
          index: { byteStart: 3, byteEnd: 7 },
          features: [{ type: 'mention', value: '@bob.test' }],
        },
      ],
    });

    expect(resolveHandle).toHaveBeenCalledWith({ handle: 'bob.test' });
    const record = post.mock.calls[0]![0];
    expect(record.facets[0].features[0]).toEqual({
      $type: 'app.bsky.richtext.facet#mention',
      did: 'did:plc:bob',
    });
  });

  it("strips a leading '#' from a hashtag value so the tag is not literally '#tag'", async () => {
    const { client, post } = createPostClient();
    const tool = new CreatePostTool(client);

    await tool.handler({
      text: 'love #atproto',
      facets: [
        {
          index: { byteStart: 5, byteEnd: 13 },
          features: [{ type: 'hashtag', value: '#atproto' }],
        },
      ],
    });

    const record = post.mock.calls[0]![0];
    expect(record.facets[0].features[0]).toEqual({
      $type: 'app.bsky.richtext.facet#tag',
      tag: 'atproto',
    });
  });
});

describe('create_post external embed thumbnail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('wires a pre-uploaded thumb descriptor into the external embed as a lexicon blob', async () => {
    const { client, post } = createPostClient();
    const tool = new CreatePostTool(client);

    // The descriptor shape generate_link_preview returns as preview.thumb.blob.
    const thumb = {
      type: 'blob',
      ref: 'bafkreithumb01',
      mimeType: 'image/jpeg',
      size: 2048,
    };

    const result = await tool.handler({
      text: 'check this out',
      embed: {
        external: {
          uri: 'https://example.com',
          title: 'Example',
          description: 'An example page',
          thumb,
        },
      },
    });

    expect(result.success).toBe(true);
    const record = post.mock.calls[0]![0];
    expect(record.embed).toEqual({
      $type: 'app.bsky.embed.external',
      external: {
        uri: 'https://example.com',
        title: 'Example',
        description: 'An example page',
        thumb: {
          $type: 'blob',
          ref: { $link: 'bafkreithumb01' },
          mimeType: 'image/jpeg',
          size: 2048,
        },
      },
    });
  });

  it('omits thumb from the external embed when none is supplied', async () => {
    const { client, post } = createPostClient();
    const tool = new CreatePostTool(client);

    await tool.handler({
      text: 'plain link card',
      embed: {
        external: { uri: 'https://example.com', title: 'Example', description: 'd' },
      },
    });

    const record = post.mock.calls[0]![0];
    expect(record.embed.external).not.toHaveProperty('thumb');
  });
});

describe('idempotent like/repost cid honesty', () => {
  beforeEach(() => vi.clearAllMocks());

  const POST_URI = 'at://did:plc:author/app.bsky.feed.post/1';
  const POST_CID = 'bafyreiabc123';

  function likeClient(viewerLike?: string) {
    const getPosts = vi.fn().mockResolvedValue({
      data: { posts: [{ uri: POST_URI, cid: POST_CID, viewer: { like: viewerLike } }] },
    });
    const createRecord = vi
      .fn()
      .mockResolvedValue({ data: { uri: `at://${SELF}/app.bsky.feed.like/new`, cid: 'cidnew' } });
    const client = makeClient({ getPosts, com: { atproto: { repo: { createRecord } } } });
    return { client, createRecord };
  }

  function repostClient(viewerRepost?: string) {
    const getPosts = vi.fn().mockResolvedValue({
      data: { posts: [{ uri: POST_URI, cid: POST_CID, viewer: { repost: viewerRepost } }] },
    });
    const createRecord = vi
      .fn()
      .mockResolvedValue({ data: { uri: `at://${SELF}/app.bsky.feed.repost/new`, cid: 'cidnew' } });
    const client = makeClient({ getPosts, com: { atproto: { repo: { createRecord } } } });
    return { client, createRecord };
  }

  it('like_post: already-liked returns alreadyLiked=true with NO cid (not "")', async () => {
    const existing = `at://${SELF}/app.bsky.feed.like/existing`;
    const { client, createRecord } = likeClient(existing);
    const tool = new LikePostTool(client);

    const result = await tool.handler({ uri: POST_URI, cid: POST_CID });

    expect(createRecord).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.uri).toBe(existing);
    expect(result.alreadyLiked).toBe(true);
    // The existing like's record CID is unknown without an extra fetch — the
    // contract is an absent cid, never a fake empty string.
    expect(result.cid).toBeUndefined();
  });

  it('like_post: a fresh like still returns the new record cid and alreadyLiked=false', async () => {
    const { client, createRecord } = likeClient(undefined);
    const tool = new LikePostTool(client);

    const result = await tool.handler({ uri: POST_URI, cid: POST_CID });

    expect(createRecord).toHaveBeenCalledTimes(1);
    expect(result.cid).toBe('cidnew');
    expect(result.alreadyLiked).toBe(false);
  });

  it('repost: already-reposted returns alreadyReposted=true with NO cid (not "")', async () => {
    const existing = `at://${SELF}/app.bsky.feed.repost/existing`;
    const { client, createRecord } = repostClient(existing);
    const tool = new RepostTool(client);

    const result = await tool.handler({ uri: POST_URI, cid: POST_CID });

    expect(createRecord).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.uri).toBe(existing);
    expect(result.alreadyReposted).toBe(true);
    expect(result.cid).toBeUndefined();
  });

  it('repost: a fresh repost still returns the new record cid', async () => {
    const { client, createRecord } = repostClient(undefined);
    const tool = new RepostTool(client);

    const result = await tool.handler({ uri: POST_URI, cid: POST_CID });

    expect(createRecord).toHaveBeenCalledTimes(1);
    expect(result.cid).toBe('cidnew');
    expect(result.alreadyReposted).toBe(false);
  });
});
