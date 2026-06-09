/**
 * Tests for the notification-loop tools. Previously markAsRead() existed on
 * GetNotificationsTool but was bound to no MCP method (dead code), so an agent
 * re-processed the same notifications every run and could not poll unread count.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MarkNotificationsSeenTool,
  GetUnreadCountTool,
} from '../tools/implementations/social-graph-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

function mockClient() {
  const updateSeenNotifications = vi.fn().mockResolvedValue({});
  const countUnreadNotifications = vi.fn().mockResolvedValue({ data: { count: 7 } });
  const agent = {
    updateSeenNotifications,
    countUnreadNotifications,
    session: { did: 'did:plc:self' },
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
  return { client, updateSeenNotifications, countUnreadNotifications };
}

describe('mark_notifications_seen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks notifications seen at a provided timestamp', async () => {
    const { client, updateSeenNotifications } = mockClient();
    const tool = new MarkNotificationsSeenTool(client);

    const result = await tool.handler({ seenAt: '2026-01-01T00:00:00.000Z' });

    expect(updateSeenNotifications).toHaveBeenCalledWith('2026-01-01T00:00:00.000Z');
    expect(result.success).toBe(true);
    expect(result.seenAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('defaults to now when no timestamp is given', async () => {
    const { client, updateSeenNotifications } = mockClient();
    const tool = new MarkNotificationsSeenTool(client);

    const result = await tool.handler({});

    expect(updateSeenNotifications).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(typeof result.seenAt).toBe('string');
  });
});

describe('get_unread_count', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the unread notification count', async () => {
    const { client, countUnreadNotifications } = mockClient();
    const tool = new GetUnreadCountTool(client);

    const result = await tool.handler({});

    expect(countUnreadNotifications).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.count).toBe(7);
  });
});
