/**
 * find_influential_users must hydrate ALL unique authors from the search
 * sample before filtering/ranking. Previously candidates were truncated to
 * maxResults*2 in arbitrary (search-result) order BEFORE the minFollowers
 * filter and sort, so a top influencer appearing late in the sample was
 * silently dropped.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FindInfluentialUsersTool } from '../tools/implementations/analytics-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

const FOLLOWERS: Record<string, number> = {
  'did:a': 100,
  'did:b': 200,
  'did:c': 300,
  'did:d': 400,
  'did:e': 500,
  'did:f': 99999,
};

function mockClient() {
  const searchPosts = vi.fn().mockResolvedValue({
    data: {
      posts: Object.keys(FOLLOWERS).map(did => ({ author: { did } })),
    },
  });
  const getProfiles = vi.fn().mockImplementation(({ actors }: { actors: string[] }) =>
    Promise.resolve({
      data: {
        profiles: actors.map(did => ({
          did,
          handle: `${did.replace('did:', '')}.test`,
          followersCount: FOLLOWERS[did],
          followsCount: 10,
          postsCount: 50,
        })),
      },
    })
  );
  const agent = {
    app: { bsky: { feed: { searchPosts } } },
    getProfiles,
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
    isAuthenticated: vi.fn().mockReturnValue(true),
    hasCredentials: vi.fn().mockReturnValue(true),
    executeAuthenticatedRequest: vi.fn().mockImplementation(wrap),
    executePublicRequest: vi.fn().mockImplementation(wrap),
  } as unknown as AtpClient;

  return { client, getProfiles };
}

describe('find_influential_users candidate ranking', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hydrates all unique authors, then filters/sorts/slices — late top influencers are kept', async () => {
    const { client, getProfiles } = mockClient();
    const tool = new FindInfluentialUsersTool(client);

    // did:f (99999 followers) is the 6th unique author; with maxResults=2 the
    // old maxResults*2 pre-truncation dropped it before ranking.
    const result = await tool.handler({
      topic: 'cats',
      minFollowers: 0,
      maxResults: 2,
      sortBy: 'followers',
    });

    const requestedActors = getProfiles.mock.calls.flatMap(
      call => (call[0] as { actors: string[] }).actors
    );
    expect(new Set(requestedActors)).toEqual(new Set(Object.keys(FOLLOWERS)));

    expect(result.users).toHaveLength(2);
    expect(result.users[0].did).toBe('did:f');
    expect(result.users[1].did).toBe('did:e');
  });
});
