/**
 * Regression test: discover_communities must report REAL follower counts. Post
 * authors come back as ProfileViewBasic (no followersCount), so the tool has to
 * hydrate member DIDs via getProfiles before emitting coreMembers/metrics.
 * Previously every followersCount and avgFollowerCount was a fabricated 0.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoverCommunitiesTool } from '../tools/implementations/content-discovery-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

const A1 = 'did:plc:a1';
const A2 = 'did:plc:a2';

function mockClient() {
  const getProfiles = vi.fn().mockResolvedValue({
    data: {
      profiles: [
        { did: A1, handle: 'a1.bsky.social', displayName: 'A1', followersCount: 5000 },
        { did: A2, handle: 'a2.bsky.social', displayName: 'A2', followersCount: 3000 },
      ],
    },
  });
  const searchPosts = vi.fn().mockResolvedValue({
    data: {
      posts: [
        {
          uri: `at://${A1}/app.bsky.feed.post/1`,
          record: { text: 'AI thoughts' },
          author: { did: A1, handle: 'a1.bsky.social' },
          likeCount: 10,
          replyCount: 1,
        },
        {
          uri: `at://${A2}/app.bsky.feed.post/2`,
          record: { text: 'reply', reply: { parent: { uri: `at://${A1}/app.bsky.feed.post/1` } } },
          author: { did: A2, handle: 'a2.bsky.social' },
          likeCount: 5,
        },
      ],
    },
  });

  const agent = {
    getProfiles,
    app: { bsky: { feed: { searchPosts } } },
    session: { did: A1 },
  };

  const client = {
    getAgent: vi.fn().mockReturnValue(agent),
    isAuthenticated: vi.fn().mockReturnValue(true),
    executeAuthenticatedRequest: vi.fn().mockImplementation(async (op: () => unknown) => {
      try {
        return { success: true, data: await op() };
      } catch (error) {
        return { success: false, error };
      }
    }),
  } as unknown as AtpClient;

  return { client, getProfiles };
}

describe('discover_communities follower hydration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports real follower counts hydrated via getProfiles', async () => {
    const { client, getProfiles } = mockClient();
    const tool = new DiscoverCommunitiesTool(client);

    const result = await tool.handler({ topic: 'AI', minCommunitySize: 2, includeMetrics: true });

    expect(getProfiles).toHaveBeenCalled();
    expect(result.communities.length).toBeGreaterThan(0);
    const community = result.communities[0];
    const maxFollowers = Math.max(...community.coreMembers.map((m: any) => m.followersCount));
    expect(maxFollowers).toBeGreaterThan(0);
    expect(community.metrics.avgFollowerCount).toBeGreaterThan(0);
  });
});
