/**
 * Regression test: analyze_network must rank top followers over the WHOLE sample,
 * not just the first 25. Previously hydrateProfiles sliced to 25, so the most
 * influential follower beyond index 25 was invisible to the ranking even though
 * maxSampleSize advertises up to 100.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyzeNetworkTool } from '../tools/implementations/analytics-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

const SELF = 'did:plc:self';

function mockClient() {
  // 30 followers as ProfileView (no follower counts).
  const followers = Array.from({ length: 30 }, (_, i) => ({
    did: `did:plc:f${i}`,
    handle: `f${i}.test`,
  }));
  // The most-followed account sits at index 27 (beyond the old 25 cutoff).
  const detailed = followers.map((f, i) => ({
    ...f,
    followersCount: i === 27 ? 999_999 : 10,
  }));

  const agent = {
    session: { did: SELF },
    getProfile: vi.fn().mockResolvedValue({
      data: { did: SELF, handle: 'self.test', followersCount: 30, followsCount: 0 },
    }),
    getFollowers: vi.fn().mockResolvedValue({ data: { followers } }),
    getFollows: vi.fn().mockResolvedValue({ data: { follows: [] } }),
    getProfiles: vi.fn().mockImplementation(async ({ actors }: { actors: string[] }) => ({
      data: { profiles: detailed.filter(d => actors.includes(d.did)) },
    })),
  };

  const client = {
    getAgent: vi.fn().mockReturnValue(agent),
    isAuthenticated: vi.fn().mockReturnValue(true),
    hasCredentials: vi.fn().mockReturnValue(true),
    executeAuthenticatedRequest: vi.fn().mockImplementation(async (op: () => unknown) => {
      try {
        return { success: true, data: await op() };
      } catch (error) {
        return { success: false, error };
      }
    }),
  } as unknown as AtpClient;

  return { client, agent };
}

describe('analyze_network top-N over full sample', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ranks the most-followed account even when it is beyond the first 25 sampled', async () => {
    const { client, agent } = mockClient();
    const tool = new AnalyzeNetworkTool(client);

    const result = await tool.handler({
      actor: 'self.test',
      includeFollowers: true,
      includeFollows: false,
      maxSampleSize: 30,
    });

    expect(result.analysis.topFollowers[0].did).toBe('did:plc:f27');
    // The full sample was hydrated (ceil(30/25) = 2 getProfiles calls).
    expect(agent.getProfiles.mock.calls.length).toBe(2);
  });
});
