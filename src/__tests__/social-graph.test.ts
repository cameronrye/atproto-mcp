/**
 * Unit tests for the social graph read tools (get_user_connections /
 * get_notifications).
 *
 * These lock the on-the-wire contract for the AppView read calls: the actor,
 * limit, cursor, and direction params are passed through to the correct agent
 * method, the returned ProfileView entries are mapped to the documented output
 * shape, and the response cursor is propagated.
 * GetUserConnections is ENHANCED (works unauthenticated); GetNotifications is
 * PRIVATE (requires auth).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GetNotificationsTool,
  GetUserConnectionsTool,
} from '../tools/implementations/social-graph-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

const wrap = async (op: () => unknown) => {
  try {
    return { success: true, data: await op() };
  } catch (error) {
    return { success: false, error };
  }
};

function makeClient(agent: any, opts: { authenticated?: boolean } = {}): AtpClient {
  return {
    getAgent: vi.fn().mockReturnValue(agent),
    isAuthenticated: vi.fn().mockReturnValue(opts.authenticated ?? true),
    hasCredentials: vi.fn().mockReturnValue(true),
    executeAuthenticatedRequest: vi.fn().mockImplementation(wrap),
    executePublicRequest: vi.fn().mockImplementation(wrap),
  } as unknown as AtpClient;
}

const sampleProfile = (suffix: string) => ({
  did: `did:plc:${suffix}`,
  handle: `${suffix}.bsky.social`,
  displayName: `User ${suffix}`,
  description: `bio ${suffix}`,
  avatar: `https://cdn.example/${suffix}/avatar.jpg`,
  banner: `https://cdn.example/${suffix}/banner.jpg`,
  indexedAt: '2026-01-01T00:00:00.000Z',
  // Field that must NOT leak into the mapped output (ProfileView has no counts).
  viewer: { following: 'at://x' },
});

describe('GetUserConnectionsTool — direction: followers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls agent.getFollowers with actor/limit/cursor and maps results into connections', async () => {
    const getFollowers = vi.fn().mockResolvedValue({
      data: {
        followers: [sampleProfile('alice'), sampleProfile('bob')],
        cursor: 'next',
      },
    });
    const client = makeClient({ getFollowers });
    const tool = new GetUserConnectionsTool(client);

    const result = await tool.handler({
      actor: 'did:plc:target',
      direction: 'followers',
      limit: 25,
      cursor: 'page2',
    });

    // Params are forwarded verbatim to the AppView call.
    expect(getFollowers).toHaveBeenCalledWith({
      actor: 'did:plc:target',
      limit: 25,
      cursor: 'page2',
    });

    // ENHANCED tool authenticated -> routes through executeAuthenticatedRequest.
    expect(client.executeAuthenticatedRequest).toHaveBeenCalled();

    expect(result.success).toBe(true);
    expect(result.actor).toBe('did:plc:target');
    expect(result.direction).toBe('followers');
    expect(result.cursor).toBe('next');
    expect(result.connections).toHaveLength(2);

    const [first] = result.connections;
    expect(first).toEqual({
      did: 'did:plc:alice',
      handle: 'alice.bsky.social',
      displayName: 'User alice',
      description: 'bio alice',
      avatar: 'https://cdn.example/alice/avatar.jpg',
      banner: 'https://cdn.example/alice/banner.jpg',
      indexedAt: '2026-01-01T00:00:00.000Z',
    });
    // ProfileView extras (e.g. viewer / counts) are intentionally dropped.
    expect(first).not.toHaveProperty('viewer');
    expect(first).not.toHaveProperty('followersCount');
  });

  it('applies the default limit of 50 and returns an empty connections array when none found', async () => {
    const getFollowers = vi.fn().mockResolvedValue({
      data: { followers: [], cursor: undefined },
    });
    const client = makeClient({ getFollowers });
    const tool = new GetUserConnectionsTool(client);

    const result = await tool.handler({ actor: 'did:plc:target', direction: 'followers' });

    expect(getFollowers).toHaveBeenCalledWith({
      actor: 'did:plc:target',
      limit: 50,
      cursor: undefined,
    });
    expect(result.cursor).toBeUndefined();
    expect(result.connections).toEqual([]);
  });

  it('works unauthenticated via executePublicRequest (ENHANCED mode)', async () => {
    const getFollowers = vi.fn().mockResolvedValue({
      data: { followers: [sampleProfile('alice')], cursor: 'c' },
    });
    const client = makeClient({ getFollowers }, { authenticated: false });
    const tool = new GetUserConnectionsTool(client);

    const result = await tool.handler({
      actor: 'did:plc:target',
      direction: 'followers',
      limit: 10,
    });

    expect(client.executePublicRequest).toHaveBeenCalled();
    expect(client.executeAuthenticatedRequest).not.toHaveBeenCalled();
    expect(getFollowers).toHaveBeenCalledWith({
      actor: 'did:plc:target',
      limit: 10,
      cursor: undefined,
    });
    expect(result.success).toBe(true);
    expect(result.connections).toHaveLength(1);
  });
});

describe('GetUserConnectionsTool — direction: follows', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls agent.getFollows (not getFollowers) and maps results into connections', async () => {
    const getFollows = vi.fn().mockResolvedValue({
      data: {
        follows: [sampleProfile('carol')],
        cursor: 'more',
      },
    });
    const getFollowers = vi.fn();
    const client = makeClient({ getFollows, getFollowers });
    const tool = new GetUserConnectionsTool(client);

    const result = await tool.handler({
      actor: 'did:plc:target',
      direction: 'follows',
      limit: 5,
      cursor: 'startHere',
    });

    expect(getFollows).toHaveBeenCalledWith({
      actor: 'did:plc:target',
      limit: 5,
      cursor: 'startHere',
    });
    // getFollowers must NOT have been invoked for the 'follows' direction.
    expect(getFollowers).not.toHaveBeenCalled();

    expect(result.success).toBe(true);
    expect(result.actor).toBe('did:plc:target');
    expect(result.direction).toBe('follows');
    expect(result.cursor).toBe('more');
    expect(result.connections).toEqual([
      {
        did: 'did:plc:carol',
        handle: 'carol.bsky.social',
        displayName: 'User carol',
        description: 'bio carol',
        avatar: 'https://cdn.example/carol/avatar.jpg',
        banner: 'https://cdn.example/carol/banner.jpg',
        indexedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });
});

describe('GetNotificationsTool', () => {
  beforeEach(() => vi.clearAllMocks());

  const sampleNotification = () => ({
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
  });

  it('passes limit/cursor/seenAt to agent.listNotifications, maps items, and propagates cursor + seenAt', async () => {
    const listNotifications = vi.fn().mockResolvedValue({
      data: {
        notifications: [sampleNotification()],
        cursor: 'notifNext',
        seenAt: '2026-02-01T00:00:00.000Z',
      },
    });
    const client = makeClient({ listNotifications }, { authenticated: true });
    const tool = new GetNotificationsTool(client);

    const result = await tool.handler({
      limit: 30,
      cursor: 'notifPage',
      seenAt: '2026-01-15T00:00:00.000Z',
    });

    expect(listNotifications).toHaveBeenCalledWith({
      limit: 30,
      cursor: 'notifPage',
      seenAt: '2026-01-15T00:00:00.000Z',
    });
    // PRIVATE tool -> always authenticated path.
    expect(client.executeAuthenticatedRequest).toHaveBeenCalled();
    expect(client.executePublicRequest).not.toHaveBeenCalled();

    expect(result.success).toBe(true);
    expect(result.cursor).toBe('notifNext');
    expect(result.hasMore).toBe(true);
    expect(result.seenAt).toBe('2026-02-01T00:00:00.000Z');
    expect(result.notifications).toHaveLength(1);

    const [notif] = result.notifications;
    expect(notif).toEqual({
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
    });
  });

  it('applies default limit 50 and reports hasMore=false when no cursor is returned', async () => {
    const listNotifications = vi.fn().mockResolvedValue({
      data: { notifications: [], cursor: undefined, seenAt: undefined },
    });
    const client = makeClient({ listNotifications });
    const tool = new GetNotificationsTool(client);

    const result = await tool.handler({});

    expect(listNotifications).toHaveBeenCalledWith({
      limit: 50,
      cursor: undefined,
      seenAt: undefined,
    });
    expect(result.hasMore).toBe(false);
    expect(result.cursor).toBeUndefined();
    expect(result.notifications).toEqual([]);
  });

  it('rejects an out-of-range limit before calling the agent (zod validation)', async () => {
    const listNotifications = vi.fn();
    const client = makeClient({ listNotifications });
    const tool = new GetNotificationsTool(client);

    await expect(tool.handler({ limit: 500 })).rejects.toThrow();
    expect(listNotifications).not.toHaveBeenCalled();
  });
});
