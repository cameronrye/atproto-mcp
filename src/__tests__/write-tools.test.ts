/**
 * Unit tests for the post-write tools: CreatePostTool, ReplyToPostTool, and
 * CreateThreadTool.
 *
 * These lock the on-the-wire record shapes the tools send to the AT Protocol
 * agent (agent.post) and the reply strongRef structure ({uri, cid}) built from
 * CIDs resolved via com.atproto.repo.getRecord. They are regression guards for:
 *   - facets being attached only when richtext detection finds them,
 *   - reply.root / reply.parent being populated with resolved CIDs (not rkeys),
 *   - langs passthrough,
 *   - thread posts chaining each subsequent reply.parent to the PREVIOUS post's
 *     returned uri/cid while reply.root stays pinned to the first post.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreatePostTool } from '../tools/implementations/create-post-tool.js';
import { ReplyToPostTool } from '../tools/implementations/reply-to-post-tool.js';
import { CreateThreadTool } from '../tools/implementations/create-thread-tool.js';
import type { AtpClient } from '../utils/atp-client.js';

// CIDs must be >=10 alphanumeric chars to pass validateCID in CreatePostTool's
// response validation; keep all CIDs that long for consistency across tools.
const ROOT_CID = 'bafyrootcid01';

// Wrap an operation the way AtpClient.executeAuthenticatedRequest does.
const wrap = async (op: () => unknown) => {
  try {
    return { success: true, data: await op() };
  } catch (error) {
    return { success: false, error };
  }
};

// Typed like the real com.atproto.repo.getRecord (a Promise-returning XRPC
// call); an untyped vi.fn() would make mockImplementation(async ...) trip
// @typescript-eslint/no-misused-promises (Promise where void is expected).
const createGetRecordMock = () =>
  vi.fn<
    (params: { repo?: string; collection?: string; rkey: string }) => Promise<{
      data: { uri?: string; cid: string };
    }>
  >();
type GetRecordMock = ReturnType<typeof createGetRecordMock>;

interface IMockAgentParts {
  post: ReturnType<typeof vi.fn>;
  getRecord: GetRecordMock;
}

function createMockAtpClient(): { client: AtpClient } & IMockAgentParts {
  // Default: agent.post resolves a single valid post ref. Tests that create
  // multiple posts (threads) override with mockResolvedValueOnce.
  const post = vi.fn().mockResolvedValue({
    uri: 'at://did:plc:self/app.bsky.feed.post/created',
    cid: 'bafycreated01',
  });

  // getCidFromUri -> com.atproto.repo.getRecord -> { data: { cid } }
  const getRecord = createGetRecordMock();
  getRecord.mockResolvedValue({
    data: {
      uri: 'at://did:plc:author/app.bsky.feed.post/parent',
      cid: ROOT_CID,
    },
  });

  const agent = {
    post,
    com: { atproto: { repo: { getRecord } } },
    session: { did: 'did:plc:self' },
  };

  const client = {
    getAgent: vi.fn().mockReturnValue(agent),
    isAuthenticated: vi.fn().mockReturnValue(true),
    hasCredentials: vi.fn().mockReturnValue(true),
    executeAuthenticatedRequest: vi.fn().mockImplementation(wrap),
    executePublicRequest: vi.fn().mockImplementation(wrap),
  } as unknown as AtpClient;

  return { client, post, getRecord };
}

describe('CreatePostTool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts a plain-text record with the given text and no facets', async () => {
    const { client, post, getRecord } = createMockAtpClient();
    const tool = new CreatePostTool(client);

    const result = await tool.handler({ text: 'hello world' });

    expect(result.success).toBe(true);
    expect(result.uri).toBe('at://did:plc:self/app.bsky.feed.post/created');
    expect(result.cid).toBe('bafycreated01');

    expect(post).toHaveBeenCalledTimes(1);
    const record = post.mock.calls[0]![0];
    expect(record).toMatchObject({ $type: 'app.bsky.feed.post', text: 'hello world' });
    // Plain text has no detectable facets, so the field must be absent (not []).
    expect(record.facets).toBeUndefined();
    expect(record.reply).toBeUndefined();
    expect(typeof record.createdAt).toBe('string');
    // No reply -> no CID resolution.
    expect(getRecord).not.toHaveBeenCalled();
  });

  it('attaches a non-empty facets array when the text contains a URL', async () => {
    const { client, post } = createMockAtpClient();
    const tool = new CreatePostTool(client);

    await tool.handler({ text: 'see https://example.com' });

    const record = post.mock.calls[0]![0];
    expect(Array.isArray(record.facets)).toBe(true);
    expect(record.facets.length).toBeGreaterThan(0);
    // The detected facet should be the link feature for the URL.
    const features = record.facets.flatMap((f: any) => f.features);
    expect(features.some((feat: any) => feat.$type === 'app.bsky.richtext.facet#link')).toBe(true);
  });

  it('passes langs through to the record', async () => {
    const { client, post } = createMockAtpClient();
    const tool = new CreatePostTool(client);

    await tool.handler({ text: 'hola', langs: ['es', 'en-US'] });

    const record = post.mock.calls[0]![0];
    expect(record.langs).toEqual(['es', 'en-US']);
  });

  it('builds reply.root and reply.parent strongRefs with CIDs resolved via getRecord', async () => {
    const { client, post, getRecord } = createMockAtpClient();
    // Distinct CIDs per resolved URI so we can prove root vs parent mapping.
    getRecord.mockImplementation(async ({ rkey }: { rkey: string }) => ({
      data: { cid: rkey === 'rootkey' ? 'bafyrootcid01' : 'bafyparentci1' },
    }));
    const tool = new CreatePostTool(client);

    const rootUri = 'at://did:plc:author/app.bsky.feed.post/rootkey';
    const parentUri = 'at://did:plc:author/app.bsky.feed.post/parentkey';

    await tool.handler({ text: 'a reply', reply: { root: rootUri, parent: parentUri } });

    // Both root and parent CIDs are resolved via getRecord.
    expect(getRecord).toHaveBeenCalledTimes(2);

    const record = post.mock.calls[0]![0];
    expect(record.reply).toEqual({
      root: { uri: rootUri, cid: 'bafyrootcid01' },
      parent: { uri: parentUri, cid: 'bafyparentci1' },
    });
  });
});

describe('ReplyToPostTool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('builds reply.root and reply.parent {uri,cid} via getRecord and posts via agent.post', async () => {
    const { client, post, getRecord } = createMockAtpClient();
    getRecord.mockImplementation(async ({ rkey }: { rkey: string }) => ({
      data: { cid: rkey === 'rootkey' ? 'bafyrootcid01' : 'bafyparentci1' },
    }));
    const tool = new ReplyToPostTool(client);

    const rootUri = 'at://did:plc:author/app.bsky.feed.post/rootkey';
    const parentUri = 'at://did:plc:author/app.bsky.feed.post/parentkey';

    const result = await tool.handler({ text: 'replying', root: rootUri, parent: parentUri });

    expect(result.success).toBe(true);
    expect(result.uri).toBe('at://did:plc:self/app.bsky.feed.post/created');
    expect(result.replyTo).toEqual({ root: rootUri, parent: parentUri });

    // Resolves a CID for both root and parent.
    expect(getRecord).toHaveBeenCalledTimes(2);

    // Reply posted through agent.post (not a namespaced creator).
    expect(post).toHaveBeenCalledTimes(1);
    const record = post.mock.calls[0]![0];
    expect(record).toMatchObject({ $type: 'app.bsky.feed.post', text: 'replying' });
    expect(record.reply).toEqual({
      root: { uri: rootUri, cid: 'bafyrootcid01' },
      parent: { uri: parentUri, cid: 'bafyparentci1' },
    });
  });

  it('passes langs through on the reply record', async () => {
    const { client, post } = createMockAtpClient();
    const tool = new ReplyToPostTool(client);

    await tool.handler({
      text: 'replying',
      root: 'at://did:plc:author/app.bsky.feed.post/rootkey',
      parent: 'at://did:plc:author/app.bsky.feed.post/parentkey',
      langs: ['en'],
    });

    const record = post.mock.calls[0]![0];
    expect(record.langs).toEqual(['en']);
  });
});

describe('CreateThreadTool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('chains posts: root has no reply, each subsequent reply.parent is the previous post and reply.root stays the first post', async () => {
    const { client, post, getRecord } = createMockAtpClient();
    // Vary agent.post return per call so we can assert the chain references the
    // PREVIOUS post's returned uri/cid (not a static value).
    post
      .mockResolvedValueOnce({
        uri: 'at://did:plc:self/app.bsky.feed.post/p1',
        cid: 'bafycidp0001',
      })
      .mockResolvedValueOnce({
        uri: 'at://did:plc:self/app.bsky.feed.post/p2',
        cid: 'bafycidp0002',
      })
      .mockResolvedValueOnce({
        uri: 'at://did:plc:self/app.bsky.feed.post/p3',
        cid: 'bafycidp0003',
      });

    const tool = new CreateThreadTool(client);

    const result = await tool.handler({
      posts: [{ text: 'one' }, { text: 'two' }, { text: 'three' }],
    });

    expect(result.success).toBe(true);
    expect(result.totalPosts).toBe(3);
    expect(result.thread).toHaveLength(3);
    expect(result.rootPost).toEqual({
      uri: 'at://did:plc:self/app.bsky.feed.post/p1',
      cid: 'bafycidp0001',
    });

    expect(post).toHaveBeenCalledTimes(3);
    // Thread chaining uses the previous post's returned ref, not getRecord.
    expect(getRecord).not.toHaveBeenCalled();

    const first = post.mock.calls[0]![0];
    const second = post.mock.calls[1]![0];
    const third = post.mock.calls[2]![0];

    // Root post carries no reply.
    expect(first.reply).toBeUndefined();
    expect(first).toMatchObject({ text: 'one' });

    // Second replies to the first; root + parent both point at post 1.
    expect(second.reply).toEqual({
      root: { uri: 'at://did:plc:self/app.bsky.feed.post/p1', cid: 'bafycidp0001' },
      parent: { uri: 'at://did:plc:self/app.bsky.feed.post/p1', cid: 'bafycidp0001' },
    });

    // Third's root stays pinned to post 1, parent advances to post 2.
    expect(third.reply).toEqual({
      root: { uri: 'at://did:plc:self/app.bsky.feed.post/p1', cid: 'bafycidp0001' },
      parent: { uri: 'at://did:plc:self/app.bsky.feed.post/p2', cid: 'bafycidp0002' },
    });
  });

  it('applies post-specific langs and falls back to thread-wide langs', async () => {
    const { client, post } = createMockAtpClient();
    post
      .mockResolvedValueOnce({
        uri: 'at://did:plc:self/app.bsky.feed.post/p1',
        cid: 'bafycidp0001',
      })
      .mockResolvedValueOnce({
        uri: 'at://did:plc:self/app.bsky.feed.post/p2',
        cid: 'bafycidp0002',
      });

    const tool = new CreateThreadTool(client);

    await tool.handler({
      langs: ['en'],
      posts: [{ text: 'one', langs: ['fr'] }, { text: 'two' }],
    });

    // Post 1 uses its own langs; post 2 inherits thread-wide langs.
    expect(post.mock.calls[0]![0].langs).toEqual(['fr']);
    expect(post.mock.calls[1]![0].langs).toEqual(['en']);
  });
});
