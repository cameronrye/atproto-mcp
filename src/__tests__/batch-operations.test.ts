/**
 * Tests for batch operation tools
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { BatchActionTool } from '../tools/implementations/batch-operations-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

// Mock AtpClient
const createMockAtpClient = () => {
  const mockAgent = {
    getProfile: vi.fn().mockImplementation(async ({ actor }: { actor: string }) => ({
      data: {
        did: `did:plc:${actor.replace('.bsky.social', '')}`,
        handle: actor,
        displayName: `User ${actor}`,
      },
    })),
    // batch action=follow hydrates all actors (DID + viewer.following) in one call.
    getProfiles: vi.fn().mockImplementation(async ({ actors }: { actors: string[] }) => ({
      data: {
        profiles: actors.map((actor: string) => ({
          did: `did:plc:${actor.replace('.bsky.social', '')}`,
          handle: actor,
          displayName: `User ${actor}`,
          viewer: {},
        })),
      },
    })),
    getPost: vi.fn().mockImplementation(async ({ uri }: { uri: string }) => ({
      data: {
        uri,
        cid: 'cid123',
        value: {
          text: 'Test post',
          createdAt: new Date().toISOString(),
        },
      },
    })),
    // batch action=like/repost fetch the post view (CID + viewer state) in one call.
    getPosts: vi.fn().mockImplementation(async ({ uris }: { uris: string[] }) => ({
      data: { posts: uris.map((uri: string) => ({ uri, cid: 'cid123', viewer: {} })) },
    })),
    com: {
      atproto: {
        repo: {
          createRecord: vi.fn().mockResolvedValue({
            data: {
              uri: 'at://did:plc:test/app.bsky.graph.follow/123',
              cid: 'cid123',
            },
          }),
          listRecords: vi.fn().mockResolvedValue({
            data: {
              records: [],
            },
          }),
          getRecord: vi.fn().mockImplementation(async ({ repo, collection, rkey }: any) => ({
            data: {
              uri: `at://${repo}/${collection}/${rkey}`,
              cid: 'cid123',
              value: {
                text: 'Test post',
                createdAt: new Date().toISOString(),
              },
            },
          })),
        },
      },
    },
    app: {
      bsky: {
        graph: {
          follow: {
            create: vi.fn().mockResolvedValue({
              uri: 'at://did:plc:test/app.bsky.graph.follow/123',
              cid: 'cid123',
            }),
          },
        },
        feed: {
          like: {
            create: vi.fn().mockResolvedValue({
              uri: 'at://did:plc:test/app.bsky.feed.like/123',
              cid: 'cid123',
            }),
          },
          repost: {
            create: vi.fn().mockResolvedValue({
              uri: 'at://did:plc:test/app.bsky.feed.repost/123',
              cid: 'cid123',
            }),
          },
        },
      },
    },
    session: { did: 'did:plc:test' },
  };

  return {
    getAgent: vi.fn().mockReturnValue(mockAgent),
    isAuthenticated: vi.fn().mockReturnValue(true),
    executeAuthenticatedRequest: vi.fn().mockImplementation(async operation => {
      try {
        const result = await operation();
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error };
      }
    }),
  } as unknown as AtpClient;
};

describe('BatchActionTool — continueOnError default', () => {
  it('defaults continueOnError to true via the schema and documents the default', () => {
    const tool = new BatchActionTool(createMockAtpClient());

    const parsed = tool.schema.params.parse({
      action: 'like',
      targets: ['at://did:plc:user1/app.bsky.feed.post/1'],
    });

    // The default must come from the zod schema (visible to MCP clients), not
    // from a hidden code-side fallback.
    expect(parsed.continueOnError).toBe(true);
    expect(tool.schema.params.shape.continueOnError.description).toMatch(/defaults to true/i);
  });
});

describe('BatchActionTool — action=follow', () => {
  let tool: BatchActionTool;
  let mockClient: AtpClient;

  beforeEach(() => {
    mockClient = createMockAtpClient();
    tool = new BatchActionTool(mockClient);
  });

  it('should follow multiple users successfully', async () => {
    const result = await tool.handler({
      action: 'follow',
      targets: ['user1.bsky.social', 'user2.bsky.social', 'user3.bsky.social'],
    });

    expect(result.success).toBe(true);
    expect(result.action).toBe('follow');
    expect(result.results).toHaveLength(3);
    expect(result.summary.succeeded).toBe(3);
    expect(result.summary.failed).toBe(0);
  });

  it('should handle partial failures gracefully', async () => {
    const agent = mockClient.getAgent();
    // The batched profile hydration returns no entry for the second user — a
    // target missing from the batched response is that target's failure.
    (agent.getProfiles as Mock).mockResolvedValueOnce({
      data: {
        profiles: [
          { did: 'did:plc:user1', handle: 'user1.bsky.social', displayName: 'User 1' },
          { did: 'did:plc:user3', handle: 'user3.bsky.social', displayName: 'User 3' },
        ],
      },
    });

    const result = await tool.handler({
      action: 'follow',
      targets: ['user1.bsky.social', 'invalid.user', 'user3.bsky.social'],
    });

    // A batch with any failed item reports top-level success: false (callers
    // read summary/results for per-item detail).
    expect(result.success).toBe(false);
    expect(result.action).toBe('follow');
    expect(result.summary.succeeded).toBe(2);
    expect(result.summary.failed).toBe(1);
    expect(result.results.filter((r: any) => !r.success)).toHaveLength(1);
  });

  it('should require at least one target', async () => {
    await expect(tool.handler({ action: 'follow', targets: [] })).rejects.toThrow();
  });
});

describe('BatchActionTool — action=like', () => {
  let tool: BatchActionTool;
  let mockClient: AtpClient;

  beforeEach(() => {
    mockClient = createMockAtpClient();
    tool = new BatchActionTool(mockClient);
  });

  it('should like multiple posts successfully', async () => {
    const result = await tool.handler({
      action: 'like',
      targets: [
        'at://did:plc:user1/app.bsky.feed.post/1',
        'at://did:plc:user2/app.bsky.feed.post/2',
        'at://did:plc:user3/app.bsky.feed.post/3',
      ],
    });

    expect(result.success).toBe(true);
    expect(result.action).toBe('like');
    expect(result.results).toHaveLength(3);
    expect(result.summary.succeeded).toBe(3);
    expect(result.summary.failed).toBe(0);
  });

  it('should handle invalid URIs', async () => {
    const agent = mockClient.getAgent();
    // The post lookup succeeds for the first URI and returns no post for the
    // second (not found), so that item fails.
    (agent.getPosts as Mock)
      .mockResolvedValueOnce({
        data: {
          posts: [{ uri: 'at://did:plc:user1/app.bsky.feed.post/1', cid: 'cid123', viewer: {} }],
        },
      })
      .mockResolvedValueOnce({ data: { posts: [] } });

    const result = await tool.handler({
      action: 'like',
      targets: [
        'at://did:plc:user1/app.bsky.feed.post/1',
        'at://did:plc:invalid/app.bsky.feed.post/999',
      ],
    });

    expect(result.success).toBe(false);
    expect(result.action).toBe('like');
    expect(result.summary.succeeded).toBe(1);
    expect(result.summary.failed).toBe(1);
  });
});

describe('BatchActionTool — action=repost', () => {
  let tool: BatchActionTool;
  let mockClient: AtpClient;

  beforeEach(() => {
    mockClient = createMockAtpClient();
    tool = new BatchActionTool(mockClient);
  });

  it('should repost multiple posts successfully', async () => {
    const result = await tool.handler({
      action: 'repost',
      targets: [
        'at://did:plc:user1/app.bsky.feed.post/1',
        'at://did:plc:user2/app.bsky.feed.post/2',
      ],
    });

    expect(result.success).toBe(true);
    expect(result.action).toBe('repost');
    expect(result.results).toHaveLength(2);
    expect(result.summary.succeeded).toBe(2);
    expect(result.summary.failed).toBe(0);
  });
});
