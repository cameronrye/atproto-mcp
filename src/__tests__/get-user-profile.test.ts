/**
 * Unit tests for GetUserProfileTool.getProfiles batching.
 *
 * app.bsky.actor.getProfiles caps `actors` at 25 per call, so requests with
 * more than 25 actors must be chunked or the whole call fails at the API.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetUserProfileTool } from '../tools/implementations/get-user-profile-tool.js';
import type { AtpClient } from '../utils/atp-client.js';

const createMockAtpClient = () => {
  const getProfiles = vi.fn().mockImplementation(async ({ actors }: { actors: string[] }) => ({
    data: {
      profiles: actors.map(actor => ({
        did: `did:plc:${actor}`,
        handle: `${actor}.bsky.social`,
      })),
    },
  }));

  const mockAgent = { getProfiles };

  const client = {
    getAgent: vi.fn().mockReturnValue(mockAgent),
    isAuthenticated: vi.fn().mockReturnValue(true),
    hasCredentials: vi.fn().mockReturnValue(true),
    executeAuthenticatedRequest: vi.fn().mockImplementation(async (operation: () => unknown) => {
      try {
        return { success: true, data: await operation() };
      } catch (error) {
        return { success: false, error };
      }
    }),
    executePublicRequest: vi.fn().mockImplementation(async (operation: () => unknown) => {
      try {
        return { success: true, data: await operation() };
      } catch (error) {
        return { success: false, error };
      }
    }),
  } as unknown as AtpClient;

  return { client, getProfiles };
};

describe('GetUserProfileTool.getProfiles batching', () => {
  beforeEach(() => vi.clearAllMocks());

  it('chunks requests of more than 25 actors into multiple API calls', async () => {
    const { client, getProfiles } = createMockAtpClient();
    const tool = new GetUserProfileTool(client);

    const actors = Array.from({ length: 30 }, (_, i) => `user${i}.bsky.social`);
    const result = await tool.getProfiles(actors);

    // 30 actors -> two calls (25 + 5), never a single >25 call.
    expect(getProfiles).toHaveBeenCalledTimes(2);
    for (const call of getProfiles.mock.calls) {
      expect(call[0].actors.length).toBeLessThanOrEqual(25);
    }
    expect(result.profiles).toHaveLength(30);
  });

  it('makes a single call for 25 or fewer actors', async () => {
    const { client, getProfiles } = createMockAtpClient();
    const tool = new GetUserProfileTool(client);

    const actors = Array.from({ length: 25 }, (_, i) => `user${i}.bsky.social`);
    const result = await tool.getProfiles(actors);

    expect(getProfiles).toHaveBeenCalledTimes(1);
    expect(result.profiles).toHaveLength(25);
  });
});
