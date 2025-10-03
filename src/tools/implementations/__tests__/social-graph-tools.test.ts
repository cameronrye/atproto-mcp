/**
 * Tests for Social Graph Tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetFollowersTool, GetFollowsTool, GetNotificationsTool } from '../social-graph-tools.js';
import { AtpClient } from '../../../utils/atp-client.js';
import { ValidationError } from '../../../types/index.js';

// Mock AtpClient
vi.mock('../../../utils/atp-client.js');

describe('GetFollowersTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: GetFollowersTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      getFollowers: vi.fn(),
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    tool = new GetFollowersTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('get_followers');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('followers');
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty actor', async () => {
      await expect(tool.handler({ actor: '' })).rejects.toThrow(ValidationError);
    });

    it('should validate limit range', async () => {
      await expect(tool.handler({ actor: 'user.bsky.social', limit: 0 })).rejects.toThrow(
        ValidationError
      );
      await expect(tool.handler({ actor: 'user.bsky.social', limit: 101 })).rejects.toThrow(
        ValidationError
      );
    });

    it('should accept limit at boundaries', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getFollowers.mockResolvedValue({
        data: { followers: [], cursor: undefined },
      });

      await tool.handler({ actor: 'user.bsky.social', limit: 1 });
      await tool.handler({ actor: 'user.bsky.social', limit: 100 });
    });
  });

  describe('Get Followers', () => {
    it('should retrieve followers', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getFollowers.mockResolvedValue({
        data: {
          followers: [
            {
              did: 'did:plc:follower1',
              handle: 'follower1.bsky.social',
              displayName: 'Follower 1',
              followersCount: 50,
              followsCount: 25,
              postsCount: 10,
            },
            {
              did: 'did:plc:follower2',
              handle: 'follower2.bsky.social',
              displayName: 'Follower 2',
              followersCount: 100,
              followsCount: 75,
              postsCount: 20,
            },
          ],
          cursor: undefined,
        },
      });

      const result = await tool.handler({ actor: 'user.bsky.social' });

      expect(result.success).toBe(true);
      expect(result.followers).toHaveLength(2);
      expect(result.followers[0].handle).toBe('follower1.bsky.social');
      expect(result.followers[1].handle).toBe('follower2.bsky.social');
      expect(result.actor).toBe('user.bsky.social');
      expect(result.hasMore).toBe(false);
    });

    it('should handle pagination', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getFollowers.mockResolvedValue({
        data: {
          followers: [],
          cursor: 'next-page-cursor',
        },
      });

      const result = await tool.handler({ actor: 'user.bsky.social', cursor: 'current-cursor' });

      expect(result.hasMore).toBe(true);
      expect(result.cursor).toBe('next-page-cursor');
      expect(mockAgent.getFollowers).toHaveBeenCalledWith({
        actor: 'user.bsky.social',
        limit: 50,
        cursor: 'current-cursor',
      });
    });

    it('should validate actor format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      await expect(tool.handler({ actor: 'invalid' })).rejects.toThrow();
    });
  });
});

describe('GetFollowsTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: GetFollowsTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      getFollows: vi.fn(),
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    tool = new GetFollowsTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('get_follows');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('follows');
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty actor', async () => {
      await expect(tool.handler({ actor: '' })).rejects.toThrow(ValidationError);
    });

    it('should validate limit range', async () => {
      await expect(tool.handler({ actor: 'user.bsky.social', limit: 0 })).rejects.toThrow(
        ValidationError
      );
      await expect(tool.handler({ actor: 'user.bsky.social', limit: 101 })).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('Get Follows', () => {
    it('should retrieve follows', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getFollows.mockResolvedValue({
        data: {
          follows: [
            {
              did: 'did:plc:following1',
              handle: 'following1.bsky.social',
              displayName: 'Following 1',
              followersCount: 50,
              followsCount: 25,
              postsCount: 10,
            },
          ],
          cursor: undefined,
        },
      });

      const result = await tool.handler({ actor: 'user.bsky.social' });

      expect(result.success).toBe(true);
      expect(result.follows).toHaveLength(1);
      expect(result.follows[0].handle).toBe('following1.bsky.social');
      expect(result.actor).toBe('user.bsky.social');
      expect(result.hasMore).toBe(false);
    });

    it('should handle pagination', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getFollows.mockResolvedValue({
        data: {
          follows: [],
          cursor: 'next-page-cursor',
        },
      });

      const result = await tool.handler({ actor: 'user.bsky.social', cursor: 'current-cursor' });

      expect(result.hasMore).toBe(true);
      expect(result.cursor).toBe('next-page-cursor');
    });
  });
});

describe('GetNotificationsTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: GetNotificationsTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      listNotifications: vi.fn(),
      updateSeenNotifications: vi.fn(),
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    tool = new GetNotificationsTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('get_notifications');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('notifications');
    });
  });

  describe('Get Notifications', () => {
    it('should retrieve notifications', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.listNotifications.mockResolvedValue({
        data: {
          notifications: [
            {
              uri: 'at://did:plc:user123/app.bsky.feed.like/abc123',
              cid: 'bafyabc123',
              author: {
                did: 'did:plc:user123',
                handle: 'user.bsky.social',
                displayName: 'Test User',
                followersCount: 100,
                followsCount: 50,
                postsCount: 25,
              },
              reason: 'like',
              record: {},
              isRead: false,
              indexedAt: '2024-01-01T00:00:00Z',
            },
          ],
          cursor: undefined,
          seenAt: '2024-01-01T00:00:00Z',
        },
      });

      const result = await tool.handler({});

      expect(result.success).toBe(true);
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].reason).toBe('like');
      expect(result.notifications[0].isRead).toBe(false);
      expect(result.hasMore).toBe(false);
    });

    it('should handle pagination', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.listNotifications.mockResolvedValue({
        data: {
          notifications: [],
          cursor: 'next-page-cursor',
        },
      });

      const result = await tool.handler({ cursor: 'current-cursor' });

      expect(result.hasMore).toBe(true);
      expect(result.cursor).toBe('next-page-cursor');
    });
  });

  describe('Mark As Read', () => {
    it('should mark notifications as read', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.updateSeenNotifications.mockResolvedValue({});

      const result = await tool.markAsRead('2024-01-01T00:00:00Z');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Notifications marked as read');
      expect(result.seenAt).toBe('2024-01-01T00:00:00Z');
      expect(mockAgent.updateSeenNotifications).toHaveBeenCalledWith('2024-01-01T00:00:00Z');
    });

    it('should use current timestamp if not provided', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.updateSeenNotifications.mockResolvedValue({});

      const result = await tool.markAsRead();

      expect(result.success).toBe(true);
      expect(result.seenAt).toBeDefined();
    });
  });
});
