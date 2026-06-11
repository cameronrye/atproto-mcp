/**
 * Tests for the notification-loop tools.
 *
 * - mark_notifications_seen: marks the seen cursor so an agent does not
 *   re-process the same notifications on every run.
 * - get_notifications (countOnly: true): cheap poll for the unread badge number
 *   without fetching the full notification list.
 * - get_notifications (full): returns the notification list plus the unread count.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MarkNotificationsSeenTool,
  GetNotificationsTool,
} from '../tools/implementations/social-graph-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

function mockClient() {
  const updateSeenNotifications = vi.fn().mockResolvedValue({});
  const countUnreadNotifications = vi.fn().mockResolvedValue({ data: { count: 7 } });
  const listNotifications = vi.fn().mockResolvedValue({
    data: { notifications: [], cursor: undefined, seenAt: undefined },
  });
  const agent = {
    updateSeenNotifications,
    countUnreadNotifications,
    listNotifications,
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
  return { client, updateSeenNotifications, countUnreadNotifications, listNotifications };
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

describe('get_notifications with countOnly: true', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns only unreadCount and does NOT fetch the notification list', async () => {
    const { client, countUnreadNotifications, listNotifications } = mockClient();
    const tool = new GetNotificationsTool(client);

    const result = await tool.handler({ countOnly: true });

    // Only the count endpoint should be called.
    expect(countUnreadNotifications).toHaveBeenCalledTimes(1);
    expect(listNotifications).not.toHaveBeenCalled();

    expect(result.success).toBe(true);
    expect(result.unreadCount).toBe(7);
    // Notification list fields must NOT be present.
    expect(result).not.toHaveProperty('notifications');
    expect(result).not.toHaveProperty('cursor');
    expect(result).not.toHaveProperty('hasMore');
  });
});

describe('get_notifications reason contract', () => {
  beforeEach(() => vi.clearAllMocks());

  // The reasons app.bsky.notification.listNotifications documents (the lexicon
  // union is open — `(string & {})` — so new values can appear at any time).
  const KNOWN_REASONS = [
    'like',
    'repost',
    'follow',
    'mention',
    'reply',
    'quote',
    'starterpack-joined',
    'verified',
    'unverified',
    'like-via-repost',
    'repost-via-repost',
    'subscribed-post',
  ];

  it('outputSchema accepts every documented notification reason (no narrow enum)', () => {
    const { client } = mockClient();
    const tool = new GetNotificationsTool(client);

    const reasonSchema = (tool.schema.outputSchema as any).properties.notifications.items.properties
      .reason;

    expect(reasonSchema.type).toBe('string');
    // The MCP SDK hard-fails structuredContent validation on out-of-enum
    // values, so an enum narrower than what the API returns is runtime
    // breakage. Either no enum at all, or one covering every known reason.
    for (const reason of KNOWN_REASONS) {
      if (Array.isArray(reasonSchema.enum)) {
        expect(reasonSchema.enum, `enum must include '${reason}'`).toContain(reason);
      }
    }
  });

  it('passes a non-classic reason through unchanged', async () => {
    const { client, listNotifications } = mockClient();
    listNotifications.mockResolvedValueOnce({
      data: {
        notifications: [
          {
            uri: 'at://did:plc:joiner/app.bsky.graph.starterpack/abc',
            cid: 'cidsp',
            author: { did: 'did:plc:joiner', handle: 'joiner.bsky.social' },
            reason: 'starterpack-joined',
            record: {},
            isRead: false,
            indexedAt: '2026-02-02T00:00:00.000Z',
          },
        ],
        cursor: undefined,
        seenAt: undefined,
      },
    });
    const tool = new GetNotificationsTool(client);

    const result = await tool.handler({});

    expect(result.notifications[0]?.reason).toBe('starterpack-joined');
  });
});

describe('get_notifications (full list)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns notifications list plus unreadCount when countOnly is absent', async () => {
    const sampleNotif = {
      uri: 'at://did:plc:liker/app.bsky.feed.like/abc',
      cid: 'cidnotif',
      author: {
        did: 'did:plc:liker',
        handle: 'liker.bsky.social',
        displayName: 'Liker',
        description: 'fan',
        avatar: 'https://cdn.example/liker.jpg',
        followersCount: 10,
        followsCount: 20,
        postsCount: 5,
      },
      reason: 'like',
      record: { $type: 'app.bsky.feed.like' },
      isRead: false,
      indexedAt: '2026-02-02T00:00:00.000Z',
      labels: [],
    };

    const countUnreadNotifications = vi.fn().mockResolvedValue({ data: { count: 3 } });
    const listNotifications = vi.fn().mockResolvedValue({
      data: {
        notifications: [sampleNotif],
        cursor: 'notifNext',
        seenAt: '2026-02-01T00:00:00.000Z',
      },
    });
    const agent = {
      countUnreadNotifications,
      listNotifications,
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

    const tool = new GetNotificationsTool(client);
    const result = await tool.handler({ limit: 10 });

    expect(listNotifications).toHaveBeenCalledWith({
      limit: 10,
      cursor: undefined,
      seenAt: undefined,
    });

    expect(result.success).toBe(true);
    expect(result.unreadCount).toBe(3);
    expect(result.notifications).toHaveLength(1);
    expect(result.cursor).toBe('notifNext');
    expect(result.hasMore).toBe(true);
    expect(result.seenAt).toBe('2026-02-01T00:00:00.000Z');
  });
});
