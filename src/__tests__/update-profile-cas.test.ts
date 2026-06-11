/**
 * Regression test: update_profile is a read-modify-write on the single
 * app.bsky.actor.profile/self record, so it must use compare-and-swap
 * (swapRecord = the CID it read) to avoid clobbering a concurrent update.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateProfileTool } from '../tools/implementations/content-management-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

function mockClient() {
  const getRecord = vi
    .fn()
    .mockResolvedValue({ data: { value: { displayName: 'Old' }, cid: 'cidA' } });
  const putRecord = vi.fn().mockResolvedValue({ data: { uri: 'at://x', cid: 'cidB' } });
  const agent = {
    session: { did: 'did:plc:self' },
    com: { atproto: { repo: { getRecord, putRecord } } },
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

  return { client, getRecord, putRecord };
}

describe('update_profile compare-and-swap', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes swapRecord equal to the CID it read', async () => {
    const { client, putRecord } = mockClient();
    const tool = new UpdateProfileTool(client);

    await tool.handler({ displayName: 'New' });

    expect(putRecord).toHaveBeenCalledTimes(1);
    expect(putRecord).toHaveBeenCalledWith(expect.objectContaining({ swapRecord: 'cidA' }));
  });
});
