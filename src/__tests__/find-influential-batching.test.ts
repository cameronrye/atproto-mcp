/**
 * Regression/perf test: find_influential_users must hydrate author profiles via
 * the batched getProfiles endpoint (up to 25 actors per call) instead of issuing
 * one sequential getProfile round-trip per author.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FindInfluentialUsersTool } from '../tools/implementations/analytics-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

function mockClient() {
  const searchPosts = vi.fn().mockResolvedValue({
    data: {
      posts: [
        { author: { did: 'did:a' } },
        { author: { did: 'did:b' } },
        { author: { did: 'did:a' } },
      ],
    },
  });
  const getProfiles = vi.fn().mockResolvedValue({
    data: {
      profiles: [
        { did: 'did:a', handle: 'a.test', followersCount: 500, followsCount: 10, postsCount: 20 },
        { did: 'did:b', handle: 'b.test', followersCount: 300, followsCount: 5, postsCount: 8 },
      ],
    },
  });
  const getProfile = vi.fn();
  const agent = {
    app: { bsky: { feed: { searchPosts } } },
    getProfiles,
    getProfile,
    session: { did: 'did:self' },
  };

  const wrap = async (op: () => unknown) => {
    try {
      return { success: true, data: await op() };
    } catch (error) {
      return { success: false, error };
    }
  };
  const client = {
    getAgent: vi.fn().mockReturnValue(agent),
    isAuthenticated: vi.fn().mockReturnValue(false),
    hasCredentials: vi.fn().mockReturnValue(false),
    executePublicRequest: vi.fn().mockImplementation(wrap),
    executeAuthenticatedRequest: vi.fn().mockImplementation(wrap),
  } as unknown as AtpClient;

  return { client, getProfiles, getProfile };
}

describe('find_influential_users profile batching', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hydrates profiles via getProfiles, not per-author getProfile', async () => {
    const { client, getProfiles, getProfile } = mockClient();
    const tool = new FindInfluentialUsersTool(client);

    const result = await tool.handler({ topic: 'cats', minFollowers: 0, maxResults: 10 });

    expect(getProfiles).toHaveBeenCalled();
    expect(getProfile).not.toHaveBeenCalled();
    expect(result.users.length).toBe(2);
  });
});
