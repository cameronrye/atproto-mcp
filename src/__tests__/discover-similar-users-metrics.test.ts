/**
 * find_similar_users metrics honesty: the old `metrics.mutualFollowers` was a
 * mislabeled 0/1 flag that only encoded "candidate appears in the base user's
 * follower sample" — i.e. the candidate follows the base user. It is renamed
 * to the truthful boolean `followsBaseUser` (and the reason string updated)
 * rather than pretending to count mutual followers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FindSimilarUsersTool } from '../tools/implementations/content-discovery-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

const BASE = 'did:plc:base';
const G1 = 'did:plc:g1';
const C1 = 'did:plc:c1';
const C2 = 'did:plc:c2';

function mockClient() {
  const getProfile = vi.fn().mockResolvedValue({
    data: {
      did: BASE,
      handle: 'base.test',
      displayName: 'Base',
      followersCount: 1000,
      followsCount: 500,
    },
  });
  const getFollowers = vi.fn().mockImplementation(({ actor }: { actor: string }) => {
    if (actor === 'base.test') {
      // C1 follows the base user; C2 does not.
      return Promise.resolve({ data: { followers: [{ did: C1, handle: 'c1.test' }] } });
    }
    return Promise.resolve({ data: { followers: [] } });
  });
  const getFollows = vi.fn().mockImplementation(({ actor }: { actor: string }) => {
    if (actor === 'base.test') {
      return Promise.resolve({ data: { follows: [{ did: G1, handle: 'g1.test' }] } });
    }
    if (actor === G1) {
      return Promise.resolve({
        data: {
          follows: [
            { did: C1, handle: 'c1.test' },
            { did: C2, handle: 'c2.test' },
          ],
        },
      });
    }
    return Promise.resolve({ data: { follows: [] } });
  });
  const getProfiles = vi.fn().mockResolvedValue({
    data: {
      profiles: [
        { did: C1, handle: 'c1.test', followersCount: 900, followsCount: 450, postsCount: 10 },
        { did: C2, handle: 'c2.test', followersCount: 800, followsCount: 400, postsCount: 20 },
      ],
    },
  });

  const agent = {
    session: { did: BASE },
    getProfile,
    getProfiles,
    getFollowers,
    getFollows,
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

  return { client };
}

describe('find_similar_users followsBaseUser metric', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports a truthful followsBaseUser boolean instead of a fake mutualFollowers count', async () => {
    const { client } = mockClient();
    const tool = new FindSimilarUsersTool(client);

    const result = await tool.handler({ actor: 'base.test', includeMetrics: true });

    const c1 = result.similarUsers.find((u: { did: string }) => u.did === C1);
    const c2 = result.similarUsers.find((u: { did: string }) => u.did === C2);
    expect(c1).toBeDefined();
    expect(c2).toBeDefined();

    expect(c1.metrics.followsBaseUser).toBe(true);
    expect(c2.metrics.followsBaseUser).toBe(false);
    expect(c1.metrics).not.toHaveProperty('mutualFollowers');

    expect(c1.similarityReasons).toContain('Follows the base user');
    expect(c1.similarityReasons).not.toContain('Mutual follower');
    expect(c2.similarityReasons).not.toContain('Follows the base user');
  });

  it('declares followsBaseUser (not mutualFollowers) in the advertised outputSchema', () => {
    const { client } = mockClient();
    const tool = new FindSimilarUsersTool(client);

    const metricsSchema = (tool.schema.outputSchema as any).properties.similarUsers.items.properties
      .metrics;
    expect(metricsSchema.properties.followsBaseUser).toMatchObject({ type: 'boolean' });
    expect(metricsSchema.properties).not.toHaveProperty('mutualFollowers');
  });
});
