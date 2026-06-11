/**
 * Tests for content discovery tools
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DiscoverCommunitiesTool,
  FindSimilarUsersTool,
} from '../tools/implementations/content-discovery-tools.js';
import { DiscoverTool } from '../tools/implementations/discover-tool.js';
import type { AtpClient } from '../utils/atp-client.js';

// Mock AtpClient
const createMockAtpClient = () => {
  const mockAgent = {
    getProfile: vi.fn().mockResolvedValue({
      data: {
        did: 'did:plc:test',
        handle: 'test.bsky.social',
        displayName: 'Test User',
        description: 'AI researcher and developer',
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
            followersCount: 800,
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
            followersCount: 1200,
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
              record: { text: 'AI and machine learning post' },
              likeCount: 50,
              repostCount: 10,
            },
          },
        ],
      },
    }),
    getTimeline: vi.fn().mockResolvedValue({
      data: {
        feed: [
          {
            post: {
              uri: 'at://did:plc:user1/app.bsky.feed.post/1',
              record: { text: 'Timeline post' },
              author: {
                did: 'did:plc:user1',
                handle: 'user1.bsky.social',
              },
              likeCount: 50,
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
              description: 'AI researcher and developer',
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
                  followersCount: 800,
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
                  followersCount: 1200,
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
                    record: { text: 'AI and machine learning post' },
                    likeCount: 50,
                    repostCount: 10,
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
                  record: { text: 'Interesting AI content' },
                  author: {
                    did: 'did:plc:user1',
                    handle: 'user1.bsky.social',
                    displayName: 'User 1',
                  },
                  likeCount: 100,
                  repostCount: 20,
                },
                {
                  uri: 'at://did:plc:user2/app.bsky.feed.post/2',
                  record: { text: 'Machine learning tutorial' },
                  author: {
                    did: 'did:plc:user2',
                    handle: 'user2.bsky.social',
                    displayName: 'User 2',
                  },
                  likeCount: 80,
                  repostCount: 15,
                },
              ],
            },
          }),
          getTimeline: vi.fn().mockResolvedValue({
            data: {
              feed: [
                {
                  post: {
                    uri: 'at://did:plc:user1/app.bsky.feed.post/1',
                    record: { text: 'Timeline post' },
                    author: {
                      did: 'did:plc:user1',
                      handle: 'user1.bsky.social',
                    },
                    likeCount: 50,
                  },
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

describe('FindSimilarUsersTool', () => {
  let tool: FindSimilarUsersTool;
  let mockClient: AtpClient;

  beforeEach(() => {
    mockClient = createMockAtpClient();
    tool = new FindSimilarUsersTool(mockClient);
  });

  it('should find similar users based on profile', async () => {
    const result = await tool.handler({
      actor: 'test.bsky.social',
      maxResults: 10,
      similarityFactors: ['content', 'followers'],
    });

    expect(result.success).toBe(true);
    expect(result.similarUsers).toBeDefined();
    expect(Array.isArray(result.similarUsers)).toBe(true);
  });

  it('should calculate similarity scores', async () => {
    const result = await tool.handler({
      actor: 'test.bsky.social',
      maxResults: 5,
      similarityFactors: ['content', 'followers', 'engagement'],
    });

    expect(result.success).toBe(true);
    if (result.similarUsers.length > 0) {
      expect(result.similarUsers[0].similarityScore).toBeGreaterThanOrEqual(0);
      expect(result.similarUsers[0].similarityScore).toBeLessThanOrEqual(100);
    }
  });

  it('should respect maxResults parameter', async () => {
    const result = await tool.handler({
      actor: 'test.bsky.social',
      maxResults: 3,
    });

    expect(result.success).toBe(true);
    expect(result.similarUsers.length).toBeLessThanOrEqual(3);
  });
});

describe('DiscoverTool (mode=recommended)', () => {
  let tool: DiscoverTool;
  let mockClient: AtpClient;

  beforeEach(() => {
    mockClient = createMockAtpClient();
    tool = new DiscoverTool(mockClient);
  });

  it('should recommend content based on interests', async () => {
    const result = await tool.handler({
      mode: 'recommended',
      topics: ['AI', 'machine learning'],
      limit: 10,
    });

    expect(result.success).toBe(true);
    expect(result.mode).toBe('recommended');
    expect(result.recommendations).toBeDefined();
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it('should score recommendations', async () => {
    const result = await tool.handler({
      mode: 'recommended',
      topics: ['technology'],
      limit: 5,
    });

    expect(result.success).toBe(true);
    if (result.recommendations.length > 0) {
      expect(result.recommendations[0].recommendationScore).toBeGreaterThanOrEqual(0);
    }
  });

  it('should work with no topics at all', async () => {
    // Since topics is optional, we test with no topics at all
    const result = await tool.handler({ mode: 'recommended', limit: 10 });
    expect(result.success).toBe(true);
    expect(result.recommendations).toBeDefined();
  });
});

describe('DiscoverTool (mode=trending)', () => {
  let tool: DiscoverTool;
  let mockClient: AtpClient;

  beforeEach(() => {
    mockClient = createMockAtpClient();
    tool = new DiscoverTool(mockClient);
  });

  it('should surface trending content from the timeline', async () => {
    const result = await tool.handler({ mode: 'trending', limit: 50 });

    expect(result.success).toBe(true);
    expect(result.mode).toBe('trending');
    expect(result.trendingHashtags).toBeDefined();
    expect(Array.isArray(result.trendingHashtags)).toBe(true);
    expect(result.trendingTopics).toBeDefined();
    expect(result.trendingPosts).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it('should honor the timeWindow parameter', async () => {
    const result = await tool.handler({ mode: 'trending', timeWindow: '7d' });

    expect(result.success).toBe(true);
    expect(result.timeWindow).toBe('7d');
  });

  it('should default the time window to 24h', async () => {
    const result = await tool.handler({ mode: 'trending' });

    expect(result.success).toBe(true);
    expect(result.timeWindow).toBe('24h');
  });
});

describe('DiscoverCommunitiesTool', () => {
  let tool: DiscoverCommunitiesTool;
  let mockClient: AtpClient;

  beforeEach(() => {
    mockClient = createMockAtpClient();
    tool = new DiscoverCommunitiesTool(mockClient);
  });

  it('should discover communities by topic', async () => {
    const result = await tool.handler({
      topic: 'AI',
      maxResults: 10,
    });

    expect(result.success).toBe(true);
    expect(result.communities).toBeDefined();
    expect(Array.isArray(result.communities)).toBe(true);
  });

  it('should identify community characteristics', async () => {
    const result = await tool.handler({
      topic: 'technology',
      maxResults: 5,
    });

    expect(result.success).toBe(true);
    if (result.communities.length > 0) {
      const community = result.communities[0];
      expect(community.topic).toBeDefined();
      expect(community.coreMembers).toBeDefined();
      expect(Array.isArray(community.coreMembers)).toBe(true);
    }
  });

  it('should provide insights about communities', async () => {
    const result = await tool.handler({
      topic: 'science',
      maxResults: 3,
    });

    expect(result.success).toBe(true);
    expect(result.insights).toBeDefined();
    expect(Array.isArray(result.insights)).toBe(true);
  });
});
