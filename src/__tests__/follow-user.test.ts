/**
 * Unit tests for FollowUserTool duplicate-follow detection.
 *
 * Regression guard for the bug where existing-follow detection scanned only the
 * first 100 follow records via listRecords, missing matches on accounts that
 * follow >100 users and creating duplicate follow records. Detection must use
 * the authoritative `viewer.following` signal from getProfile instead.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FollowUserTool } from '../tools/implementations/follow-user-tool.js';
import type { AtpClient } from '../utils/atp-client.js';

interface IMockOptions {
  following?: string; // viewer.following AT-URI, if already following
}

const createMockAtpClient = (opts: IMockOptions = {}) => {
  const createRecord = vi.fn().mockResolvedValue({
    data: {
      uri: 'at://did:plc:self/app.bsky.graph.follow/new',
      cid: 'cidnew',
    },
  });

  // listRecords intentionally returns an EMPTY page to simulate the target
  // follow living beyond the first 100 records (the original bug condition).
  const listRecords = vi.fn().mockResolvedValue({ data: { records: [] } });

  const getProfile = vi.fn().mockResolvedValue({
    data: {
      did: 'did:plc:target',
      handle: 'target.bsky.social',
      ...(opts.following ? { viewer: { following: opts.following } } : { viewer: {} }),
    },
  });

  const mockAgent = {
    getProfile,
    com: { atproto: { repo: { createRecord, listRecords } } },
    session: { did: 'did:plc:self' },
  };

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
  } as unknown as AtpClient;

  return { client, createRecord, listRecords, getProfile };
};

describe('FollowUserTool duplicate detection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not create a duplicate when viewer.following is set but listRecords is empty', async () => {
    const existingUri = 'at://did:plc:self/app.bsky.graph.follow/existing';
    const { client, createRecord } = createMockAtpClient({ following: existingUri });
    const tool = new FollowUserTool(client);

    const result = await tool.handler({ actor: 'target.bsky.social' });

    expect(createRecord).not.toHaveBeenCalled();
    expect(result.uri).toBe(existingUri);
    expect(result.message).toMatch(/already/i);
  });

  it('creates a follow when viewer.following is not set', async () => {
    const { client, createRecord } = createMockAtpClient({});
    const tool = new FollowUserTool(client);

    const result = await tool.handler({ actor: 'target.bsky.social' });

    expect(createRecord).toHaveBeenCalledTimes(1);
    expect(result.uri).toBe('at://did:plc:self/app.bsky.graph.follow/new');
    expect(result.message).toMatch(/followed successfully/i);
  });
});
