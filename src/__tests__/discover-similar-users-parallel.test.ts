/**
 * find_similar_users efficiency: the independent graph reads (base profile /
 * followers / follows, then the per-follow second-degree scans) must run in
 * parallel (bounded) instead of ~15+ strictly sequential round-trips, and
 * candidate hydration must use batched getProfiles — all WITHOUT changing the
 * result content, which is asserted exactly below.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FindSimilarUsersTool } from '../tools/implementations/content-discovery-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

const BASE = 'did:plc:base';
const G1 = 'did:plc:g1';
const G2 = 'did:plc:g2';
const C1 = 'did:plc:c1';
const C2 = 'did:plc:c2';

const c1Basic = { did: C1, handle: 'c1.test' };
const c2Basic = { did: C2, handle: 'c2.test' };

function mockClient() {
  let inFlight = 0;
  let maxInFlight = 0;
  const track = async <T>(value: T): Promise<T> => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise(resolve => setTimeout(resolve, 5));
    inFlight--;
    return value;
  };

  const getProfile = vi.fn().mockImplementation(() =>
    track({
      data: {
        did: BASE,
        handle: 'base.test',
        displayName: 'Base',
        followersCount: 1000,
        followsCount: 500,
      },
    })
  );
  const getFollowers = vi.fn().mockImplementation(({ actor }: { actor: string }) => {
    if (actor === 'base.test') return track({ data: { followers: [c1Basic] } });
    if (actor === G1) return track({ data: { followers: [c2Basic] } });
    if (actor === G2) return track({ data: { followers: [c1Basic] } });
    return track({ data: { followers: [] } });
  });
  const getFollows = vi.fn().mockImplementation(({ actor }: { actor: string }) => {
    if (actor === 'base.test') {
      return track({
        data: {
          follows: [
            { did: G1, handle: 'g1.test' },
            { did: G2, handle: 'g2.test' },
          ],
        },
      });
    }
    if (actor === G1) return track({ data: { follows: [c1Basic] } });
    if (actor === G2) return track({ data: { follows: [c2Basic] } });
    return track({ data: { follows: [] } });
  });
  const getProfiles = vi.fn().mockImplementation(() =>
    track({
      data: {
        profiles: [
          {
            did: C1,
            handle: 'c1.test',
            displayName: 'C1',
            description: 'c1 bio',
            avatar: 'https://cdn.test/c1.png',
            followersCount: 1000,
            followsCount: 500,
            postsCount: 10,
          },
          {
            did: C2,
            handle: 'c2.test',
            displayName: 'C2',
            description: 'c2 bio',
            avatar: 'https://cdn.test/c2.png',
            followersCount: 4000,
            followsCount: 1000,
            postsCount: 20,
          },
        ],
      },
    })
  );

  const agent = { session: { did: BASE }, getProfile, getProfiles, getFollowers, getFollows };

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

  return { client, getProfile, getProfiles, maxConcurrency: () => maxInFlight };
}

describe('find_similar_users parallel reads', () => {
  beforeEach(() => vi.clearAllMocks());

  it('overlaps independent graph reads instead of running them strictly sequentially', async () => {
    const { client, maxConcurrency } = mockClient();
    const tool = new FindSimilarUsersTool(client);

    await tool.handler({ actor: 'base.test' });

    expect(maxConcurrency()).toBeGreaterThan(1);
  });

  it('hydrates candidates via batched getProfiles, with a single base getProfile', async () => {
    const { client, getProfile, getProfiles } = mockClient();
    const tool = new FindSimilarUsersTool(client);

    await tool.handler({ actor: 'base.test' });

    expect(getProfile).toHaveBeenCalledTimes(1);
    expect(getProfiles).toHaveBeenCalledTimes(1);
    expect(getProfiles).toHaveBeenCalledWith({ actors: [C1, C2] });
  });

  it('preserves the result content exactly', async () => {
    const { client } = mockClient();
    const tool = new FindSimilarUsersTool(client);

    const result = await tool.handler({ actor: 'base.test' });

    expect(result.success).toBe(true);
    expect(result.baseUser).toEqual({ did: BASE, handle: 'base.test', displayName: 'Base' });
    expect(result.similarUsers).toEqual([
      {
        did: C1,
        handle: 'c1.test',
        displayName: 'C1',
        description: 'c1 bio',
        avatar: 'https://cdn.test/c1.png',
        followersCount: 1000,
        followsCount: 500,
        postsCount: 10,
        // connections (1 mutual-follow * 2 + 1 shared) * 10 + ratio 1 * 5 + follows-base 15
        similarityScore: 50,
        similarityReasons: [
          'Followed by 1 accounts you follow',
          'Follows 1 accounts you follow',
          'Follows the base user',
          'Similar follower/following ratio',
        ],
        metrics: { followsBaseUser: true, followerRatioSimilarity: 1 },
      },
      {
        did: C2,
        handle: 'c2.test',
        displayName: 'C2',
        description: 'c2 bio',
        avatar: 'https://cdn.test/c2.png',
        followersCount: 4000,
        followsCount: 1000,
        postsCount: 20,
        // connections 3 * 10 + ratio 0.5 * 5, not in the base follower sample
        similarityScore: 32.5,
        similarityReasons: ['Followed by 1 accounts you follow', 'Follows 1 accounts you follow'],
        metrics: { followsBaseUser: false, followerRatioSimilarity: 0.5 },
      },
    ]);
  });
});
