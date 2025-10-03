/**
 * Tests for GetTimelineTool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetTimelineTool } from '../timeline-tools.js';
import { AtpClient } from '../../../utils/atp-client.js';
import { ValidationError } from '../../../types/index.js';

// Mock AtpClient
vi.mock('../../../utils/atp-client.js');

describe('GetTimelineTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: GetTimelineTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      getTimeline: vi.fn(),
      getAuthorFeed: vi.fn(),
      getActorLikes: vi.fn(),
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    tool = new GetTimelineTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('get_timeline');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('timeline');
    });

    it('should require authentication', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      expect(tool.isAvailable()).toBe(false);
    });
  });

  describe('Get Timeline', () => {
    it('should retrieve timeline with default parameters', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getTimeline.mockResolvedValue({
        data: {
          feed: [
            {
              post: {
                uri: 'at://did:plc:user123/app.bsky.feed.post/abc123',
                cid: 'bafyabc123',
                author: {
                  did: 'did:plc:user123',
                  handle: 'user.bsky.social',
                  displayName: 'Test User',
                  followersCount: 100,
                  followsCount: 50,
                  postsCount: 25,
                },
                record: {
                  text: 'Test post',
                  createdAt: '2024-01-01T00:00:00Z',
                },
                replyCount: 0,
                repostCount: 0,
                likeCount: 0,
                indexedAt: '2024-01-01T00:00:00Z',
              },
            },
          ],
          cursor: undefined,
        },
      });

      const result = await tool.handler({});

      expect(result.success).toBe(true);
      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].record.text).toBe('Test post');
      expect(result.hasMore).toBe(false);
      expect(mockAgent.getTimeline).toHaveBeenCalledWith({ limit: 50 });
    });

    it('should use custom limit', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getTimeline.mockResolvedValue({
        data: { feed: [], cursor: undefined },
      });

      await tool.handler({ limit: 25 });

      expect(mockAgent.getTimeline).toHaveBeenCalledWith({ limit: 25 });
    });

    it('should validate limit range', async () => {
      await expect(tool.handler({ limit: 0 })).rejects.toThrow(ValidationError);
      await expect(tool.handler({ limit: 101 })).rejects.toThrow(ValidationError);
    });

    it('should accept limit at boundaries', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getTimeline.mockResolvedValue({
        data: { feed: [], cursor: undefined },
      });

      await tool.handler({ limit: 1 });
      expect(mockAgent.getTimeline).toHaveBeenCalledWith({ limit: 1 });

      await tool.handler({ limit: 100 });
      expect(mockAgent.getTimeline).toHaveBeenCalledWith({ limit: 100 });
    });

    it('should handle pagination with cursor', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getTimeline.mockResolvedValue({
        data: {
          feed: [],
          cursor: 'next-page-cursor',
        },
      });

      const result = await tool.handler({ cursor: 'current-cursor' });

      expect(result.hasMore).toBe(true);
      expect(result.cursor).toBe('next-page-cursor');
      expect(mockAgent.getTimeline).toHaveBeenCalledWith({
        limit: 50,
        cursor: 'current-cursor',
      });
    });

    it('should use custom algorithm', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getTimeline.mockResolvedValue({
        data: { feed: [], cursor: undefined },
      });

      const result = await tool.handler({ algorithm: 'reverse-chronological' });

      expect(result.algorithm).toBe('reverse-chronological');
      expect(mockAgent.getTimeline).toHaveBeenCalledWith({
        limit: 50,
        algorithm: 'reverse-chronological',
      });
    });

    it('should transform post data correctly', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getTimeline.mockResolvedValue({
        data: {
          feed: [
            {
              post: {
                uri: 'at://did:plc:user123/app.bsky.feed.post/abc123',
                cid: 'bafyabc123',
                author: {
                  did: 'did:plc:user123',
                  handle: 'user.bsky.social',
                  displayName: 'Test User',
                  description: 'Bio text',
                  avatar: 'https://example.com/avatar.jpg',
                  followersCount: 100,
                  followsCount: 50,
                  postsCount: 25,
                },
                record: {
                  text: 'Test post',
                  createdAt: '2024-01-01T00:00:00Z',
                  langs: ['en'],
                },
                replyCount: 5,
                repostCount: 10,
                likeCount: 15,
                indexedAt: '2024-01-01T00:00:00Z',
                viewer: {
                  like: 'at://did:plc:test123/app.bsky.feed.like/xyz789',
                  repost: 'at://did:plc:test123/app.bsky.feed.repost/xyz790',
                },
              },
            },
          ],
          cursor: undefined,
        },
      });

      const result = await tool.handler({});

      expect(result.posts[0].uri).toBe('at://did:plc:user123/app.bsky.feed.post/abc123');
      expect(result.posts[0].author.handle).toBe('user.bsky.social');
      expect(result.posts[0].author.displayName).toBe('Test User');
      expect(result.posts[0].replyCount).toBe(5);
      expect(result.posts[0].repostCount).toBe(10);
      expect(result.posts[0].likeCount).toBe(15);
      expect(result.posts[0].viewer?.like).toBe('at://did:plc:test123/app.bsky.feed.like/xyz789');
    });
  });

  describe('Get Author Feed', () => {
    it('should retrieve author feed', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getAuthorFeed.mockResolvedValue({
        data: {
          feed: [
            {
              post: {
                uri: 'at://did:plc:user123/app.bsky.feed.post/abc123',
                cid: 'bafyabc123',
                author: {
                  did: 'did:plc:user123',
                  handle: 'user.bsky.social',
                  displayName: 'Test User',
                  followersCount: 100,
                  followsCount: 50,
                  postsCount: 25,
                },
                record: {
                  text: 'Author post',
                  createdAt: '2024-01-01T00:00:00Z',
                },
                replyCount: 0,
                repostCount: 0,
                likeCount: 0,
                indexedAt: '2024-01-01T00:00:00Z',
              },
            },
          ],
          cursor: undefined,
        },
      });

      const result = await tool.getAuthorFeed('user.bsky.social');

      expect(result.success).toBe(true);
      expect(result.posts).toHaveLength(1);
      expect(result.author).toBe('user.bsky.social');
      expect(mockAgent.getAuthorFeed).toHaveBeenCalledWith({
        actor: 'user.bsky.social',
        limit: 50,
      });
    });

    it('should validate actor parameter', async () => {
      await expect(tool.getAuthorFeed('')).rejects.toThrow();
      await expect(tool.getAuthorFeed('invalid')).rejects.toThrow();
    });

    it('should use filter option', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getAuthorFeed.mockResolvedValue({
        data: { feed: [], cursor: undefined },
      });

      await tool.getAuthorFeed('user.bsky.social', { filter: 'posts_with_media' });

      expect(mockAgent.getAuthorFeed).toHaveBeenCalledWith({
        actor: 'user.bsky.social',
        limit: 50,
        filter: 'posts_with_media',
      });
    });
  });

  describe('Get Likes', () => {
    it('should retrieve likes feed', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getActorLikes.mockResolvedValue({
        data: {
          feed: [
            {
              post: {
                uri: 'at://did:plc:user123/app.bsky.feed.post/abc123',
                cid: 'bafyabc123',
                author: {
                  did: 'did:plc:user123',
                  handle: 'user.bsky.social',
                  displayName: 'Test User',
                  followersCount: 100,
                  followsCount: 50,
                  postsCount: 25,
                },
                record: {
                  text: 'Liked post',
                  createdAt: '2024-01-01T00:00:00Z',
                },
                replyCount: 0,
                repostCount: 0,
                likeCount: 0,
                indexedAt: '2024-01-01T00:00:00Z',
              },
            },
          ],
          cursor: undefined,
        },
      });

      const result = await tool.getLikes('user.bsky.social');

      expect(result.success).toBe(true);
      expect(result.posts).toHaveLength(1);
      expect(result.actor).toBe('user.bsky.social');
      expect(mockAgent.getActorLikes).toHaveBeenCalledWith({
        actor: 'user.bsky.social',
        limit: 50,
      });
    });

    it('should validate actor parameter', async () => {
      await expect(tool.getLikes('')).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle timeline retrieval failure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getTimeline.mockRejectedValue(new Error('Timeline fetch failed'));

      await expect(tool.handler({})).rejects.toThrow();
    });

    it('should require authentication', async () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async () => {
        throw new Error('Authentication required');
      });

      await expect(tool.handler({})).rejects.toThrow();
    });
  });
});
