/**
 * Tests for analytics and insights tools
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyzeAccountTool } from '../tools/implementations/analyze-account-tool.js';
import { FindInfluentialUsersTool } from '../tools/implementations/analytics-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

// Mock AtpClient
const createMockAtpClient = () => {
  const mockAgent = {
    getProfile: vi.fn().mockResolvedValue({
      data: {
        did: 'did:plc:test',
        handle: 'test.bsky.social',
        displayName: 'Test User',
        followersCount: 1000,
        followsCount: 500,
        postsCount: 250,
      },
    }),
    getFollowers: vi.fn().mockResolvedValue({
      data: {
        followers: [
          {
            did: 'did:plc:follower1',
            handle: 'follower1.bsky.social',
            displayName: 'Follower 1',
            followersCount: 5000,
          },
          {
            did: 'did:plc:follower2',
            handle: 'follower2.bsky.social',
            displayName: 'Follower 2',
            followersCount: 2000,
          },
        ],
      },
    }),
    getFollows: vi.fn().mockResolvedValue({
      data: {
        follows: [
          {
            did: 'did:plc:following1',
            handle: 'following1.bsky.social',
            displayName: 'Following 1',
            followersCount: 3000,
          },
        ],
      },
    }),
    getAuthorFeed: vi.fn().mockResolvedValue({
      data: {
        feed: [
          {
            post: {
              uri: 'at://did:plc:test/app.bsky.feed.post/1',
              cid: 'cid1',
              likeCount: 50,
              repostCount: 10,
              replyCount: 5,
              indexedAt: '2024-01-01T00:00:00Z',
              record: {
                text: 'Test post 1 with some content',
                createdAt: '2024-01-01T00:00:00Z',
              },
            },
          },
          {
            post: {
              uri: 'at://did:plc:test/app.bsky.feed.post/2',
              cid: 'cid2',
              likeCount: 100,
              repostCount: 20,
              replyCount: 15,
              indexedAt: '2024-01-02T00:00:00Z',
              record: {
                text: 'Test post 2 with more content',
                createdAt: '2024-01-02T00:00:00Z',
              },
            },
          },
        ],
      },
    }),
    app: {
      bsky: {
        actor: {
          getProfile: vi.fn().mockResolvedValue({
            data: {
              did: 'did:plc:test',
              handle: 'test.bsky.social',
              displayName: 'Test User',
              followersCount: 1000,
              followsCount: 500,
              postsCount: 250,
            },
          }),
        },
        graph: {
          getFollowers: vi.fn().mockResolvedValue({
            data: {
              followers: [
                {
                  did: 'did:plc:follower1',
                  handle: 'follower1.bsky.social',
                  displayName: 'Follower 1',
                  followersCount: 5000,
                },
                {
                  did: 'did:plc:follower2',
                  handle: 'follower2.bsky.social',
                  displayName: 'Follower 2',
                  followersCount: 2000,
                },
              ],
            },
          }),
          getFollows: vi.fn().mockResolvedValue({
            data: {
              follows: [
                {
                  did: 'did:plc:following1',
                  handle: 'following1.bsky.social',
                  displayName: 'Following 1',
                  followersCount: 3000,
                },
              ],
            },
          }),
        },
        feed: {
          getAuthorFeed: vi.fn().mockResolvedValue({
            data: {
              feed: [
                {
                  post: {
                    uri: 'at://did:plc:test/app.bsky.feed.post/1',
                    likeCount: 50,
                    repostCount: 10,
                    replyCount: 5,
                    indexedAt: '2024-01-02T00:00:00Z',
                  },
                },
                {
                  post: {
                    uri: 'at://did:plc:test/app.bsky.feed.post/2',
                    likeCount: 100,
                    repostCount: 20,
                    replyCount: 15,
                    indexedAt: '2024-01-02T00:00:00Z',
                  },
                },
              ],
            },
          }),
          searchPosts: vi.fn().mockResolvedValue({
            data: {
              posts: [
                {
                  uri: 'at://did:plc:user1/app.bsky.feed.post/1',
                  author: {
                    did: 'did:plc:user1',
                    handle: 'user1.bsky.social',
                    displayName: 'User 1',
                    followersCount: 10000,
                    followsCount: 500,
                    postsCount: 1000,
                  },
                  likeCount: 200,
                  repostCount: 50,
                },
              ],
            },
          }),
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

describe("analyze_account dimension:'network'", () => {
  let tool: AnalyzeAccountTool;
  let mockClient: AtpClient;

  beforeEach(() => {
    mockClient = createMockAtpClient();
    tool = new AnalyzeAccountTool(mockClient);
  });

  it('should analyze network successfully', async () => {
    const result = await tool.handler({
      dimension: 'network',
      actor: 'test.bsky.social',
      includeFollowers: true,
      includeFollows: true,
      maxSampleSize: 10,
    });

    expect(result.success).toBe(true);
    expect(result.dimension).toBe('network');
    expect(result.network).toBeDefined();
    expect(result.network.followersCount).toBe(1000);
    expect(result.network.followsCount).toBe(500);
    expect(result.analysis).toBeDefined();
    expect(result.analysis.networkType).toBeDefined();
  });

  it('should determine network type correctly', async () => {
    const result = await tool.handler({
      dimension: 'network',
      actor: 'test.bsky.social',
      includeFollowers: false,
      includeFollows: false,
    });

    expect(result.success).toBe(true);
    expect(['broadcaster', 'connector', 'balanced', 'new_user']).toContain(
      result.analysis.networkType
    );
  });
});

describe("analyze_account dimension:'strategy'", () => {
  let tool: AnalyzeAccountTool;
  let mockClient: AtpClient;

  beforeEach(() => {
    mockClient = createMockAtpClient();
    tool = new AnalyzeAccountTool(mockClient);
  });

  it('should suggest content strategy based on engagement', async () => {
    const result = await tool.handler({
      dimension: 'strategy',
      actor: 'test.bsky.social',
      analyzePosts: 20,
    });

    expect(result.success).toBe(true);
    expect(result.dimension).toBe('strategy');
    expect(result.recommendations).toBeDefined();
    expect(result.recommendations.optimizationTips).toBeDefined();
    expect(Array.isArray(result.recommendations.optimizationTips)).toBe(true);
    expect(result.analysis).toBeDefined();
  });

  it('should analyze engagement metrics', async () => {
    const result = await tool.handler({
      dimension: 'strategy',
      actor: 'test.bsky.social',
      analyzePosts: 10,
    });

    expect(result.success).toBe(true);
    expect(result.analysis.totalPostsAnalyzed).toBeGreaterThan(0);
    expect(result.analysis.avgEngagementRate).toBeGreaterThanOrEqual(0);
    expect(result.analysis.bestPerformingPosts).toBeDefined();
    expect(Array.isArray(result.analysis.bestPerformingPosts)).toBe(true);
  });
});

describe('FindInfluentialUsersTool', () => {
  let tool: FindInfluentialUsersTool;
  let mockClient: AtpClient;

  beforeEach(() => {
    mockClient = createMockAtpClient();
    tool = new FindInfluentialUsersTool(mockClient);
  });

  it('should find influential users by topic', async () => {
    const result = await tool.handler({
      topic: 'AI',
      minFollowers: 1000,
      maxResults: 10,
      sortBy: 'followers',
    });

    expect(result.success).toBe(true);
    expect(result.users).toBeDefined();
    expect(Array.isArray(result.users)).toBe(true);
    expect(result.insights).toBeDefined();
  });

  it('should sort users by different criteria', async () => {
    const resultByFollowers = await tool.handler({
      searchQuery: 'technology',
      sortBy: 'followers',
      maxResults: 5,
    });

    expect(resultByFollowers.success).toBe(true);
    expect(resultByFollowers.users).toBeDefined();

    const resultByEngagement = await tool.handler({
      searchQuery: 'technology',
      sortBy: 'engagement',
      maxResults: 5,
    });

    expect(resultByEngagement.success).toBe(true);
    expect(resultByEngagement.users).toBeDefined();
  });

  it('should require either topic or searchQuery', async () => {
    await expect(tool.handler({ maxResults: 10 })).rejects.toThrow();
  });

  it('reports a missing topic/searchQuery as a zod ValidationError, not a runtime error', async () => {
    // Enforced via the schema (.refine) so MCP clients receive a proper
    // parameter-validation error instead of a generic tool-execution failure.
    await expect(tool.handler({ maxResults: 10 })).rejects.toMatchObject({
      name: 'ValidationError',
      message: expect.stringContaining('Either topic or searchQuery must be provided'),
    });
  });
});
