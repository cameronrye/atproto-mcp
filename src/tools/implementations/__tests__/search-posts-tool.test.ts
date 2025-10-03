/**
 * Tests for SearchPostsTool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchPostsTool } from '../search-posts-tool.js';
import { AtpClient } from '../../../utils/atp-client.js';
import { ValidationError } from '../../../types/index.js';

// Mock AtpClient
vi.mock('../../../utils/atp-client.js');

describe('SearchPostsTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: SearchPostsTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      app: {
        bsky: {
          feed: {
            searchPosts: vi.fn(),
          },
        },
      },
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    tool = new SearchPostsTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('search_posts');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Search for posts');
    });

    it('should require authentication', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      expect(tool.isAvailable()).toBe(false);
    });
  });

  describe('Query Validation', () => {
    it('should reject empty query', async () => {
      await expect(tool.handler({ q: '' })).rejects.toThrow(ValidationError);
    });

    it('should reject query over 300 characters', async () => {
      const longQuery = 'a'.repeat(301);
      await expect(tool.handler({ q: longQuery })).rejects.toThrow(ValidationError);
    });

    it('should accept query at 300 characters', async () => {
      const query = 'a'.repeat(300);

      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.feed.searchPosts.mockResolvedValue({
        data: {
          posts: [],
          cursor: undefined,
        },
      });

      const result = await tool.handler({ q: query });
      expect(result.success).toBe(true);
    });

    it('should accept single character query', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.feed.searchPosts.mockResolvedValue({
        data: {
          posts: [],
          cursor: undefined,
        },
      });

      const result = await tool.handler({ q: 'a' });
      expect(result.success).toBe(true);
    });
  });

  describe('Basic Search', () => {
    it('should search posts with query', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.feed.searchPosts.mockResolvedValue({
        data: {
          posts: [
            {
              uri: 'at://did:plc:user123/app.bsky.feed.post/abc123',
              cid: 'bafyreiabc123',
              author: {
                did: 'did:plc:user123',
                handle: 'user.bsky.social',
                displayName: 'Test User',
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
          ],
          cursor: undefined,
        },
      });

      const result = await tool.handler({ q: 'test' });

      expect(result.success).toBe(true);
      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].record.text).toBe('Test post');
      expect(result.searchQuery).toBe('test');
      expect(result.hasMore).toBe(false);
    });

    it('should use default limit of 25', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.feed.searchPosts.mockResolvedValue({
        data: {
          posts: [],
          cursor: undefined,
        },
      });

      await tool.handler({ q: 'test' });

      expect(mockAgent.app.bsky.feed.searchPosts).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 25 })
      );
    });
  });

  describe('Limit Validation', () => {
    it('should accept custom limit', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.feed.searchPosts.mockResolvedValue({
        data: {
          posts: [],
          cursor: undefined,
        },
      });

      await tool.handler({ q: 'test', limit: 50 });

      expect(mockAgent.app.bsky.feed.searchPosts).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 })
      );
    });

    it('should reject limit below 1', async () => {
      await expect(tool.handler({ q: 'test', limit: 0 })).rejects.toThrow(ValidationError);
    });

    it('should reject limit above 100', async () => {
      await expect(tool.handler({ q: 'test', limit: 101 })).rejects.toThrow(ValidationError);
    });

    it('should accept limit at boundary (1)', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.feed.searchPosts.mockResolvedValue({
        data: {
          posts: [],
          cursor: undefined,
        },
      });

      await tool.handler({ q: 'test', limit: 1 });
      expect(mockAgent.app.bsky.feed.searchPosts).toHaveBeenCalled();
    });

    it('should accept limit at boundary (100)', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.feed.searchPosts.mockResolvedValue({
        data: {
          posts: [],
          cursor: undefined,
        },
      });

      await tool.handler({ q: 'test', limit: 100 });
      expect(mockAgent.app.bsky.feed.searchPosts).toHaveBeenCalled();
    });

    it('should reject non-integer limit', async () => {
      await expect(tool.handler({ q: 'test', limit: 25.5 })).rejects.toThrow(ValidationError);
    });
  });

  describe('Sort Options', () => {
    it('should use default sort of latest', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.feed.searchPosts.mockResolvedValue({
        data: {
          posts: [],
          cursor: undefined,
        },
      });

      await tool.handler({ q: 'test' });

      expect(mockAgent.app.bsky.feed.searchPosts).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'latest' })
      );
    });

    it('should accept sort by top', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.feed.searchPosts.mockResolvedValue({
        data: {
          posts: [],
          cursor: undefined,
        },
      });

      await tool.handler({ q: 'test', sort: 'top' });

      expect(mockAgent.app.bsky.feed.searchPosts).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'top' })
      );
    });

    it('should accept sort by latest', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.feed.searchPosts.mockResolvedValue({
        data: {
          posts: [],
          cursor: undefined,
        },
      });

      await tool.handler({ q: 'test', sort: 'latest' });

      expect(mockAgent.app.bsky.feed.searchPosts).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'latest' })
      );
    });

    it('should reject invalid sort option', async () => {
      await expect(tool.handler({ q: 'test', sort: 'invalid' as any })).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('Pagination', () => {
    it('should handle cursor for pagination', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.feed.searchPosts.mockResolvedValue({
        data: {
          posts: [],
          cursor: 'next-page-cursor',
        },
      });

      const result = await tool.handler({ q: 'test', cursor: 'current-cursor' });

      expect(result.hasMore).toBe(true);
      expect(result.cursor).toBe('next-page-cursor');
      expect(mockAgent.app.bsky.feed.searchPosts).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: 'current-cursor' })
      );
    });

    it('should indicate no more results when cursor is undefined', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.feed.searchPosts.mockResolvedValue({
        data: {
          posts: [],
          cursor: undefined,
        },
      });

      const result = await tool.handler({ q: 'test' });

      expect(result.hasMore).toBe(false);
      expect(result.cursor).toBeUndefined();
    });
  });

  describe('Language Filter', () => {
    it('should accept valid language code', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.feed.searchPosts.mockResolvedValue({
        data: {
          posts: [],
          cursor: undefined,
        },
      });

      await tool.handler({ q: 'test', lang: 'en' });

      expect(mockAgent.app.bsky.feed.searchPosts).toHaveBeenCalledWith(
        expect.objectContaining({ lang: 'en' })
      );
    });

    it('should reject language code not 2 characters', async () => {
      await expect(tool.handler({ q: 'test', lang: 'eng' })).rejects.toThrow(ValidationError);
    });
  });

  describe('Author Filter', () => {
    it('should accept valid author DID', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.feed.searchPosts.mockResolvedValue({
        data: {
          posts: [],
          cursor: undefined,
        },
      });

      await tool.handler({ q: 'test', author: 'did:plc:user123' });

      expect(mockAgent.app.bsky.feed.searchPosts).toHaveBeenCalledWith(
        expect.objectContaining({ author: 'did:plc:user123' })
      );
    });

    it('should accept valid author handle', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.feed.searchPosts.mockResolvedValue({
        data: {
          posts: [],
          cursor: undefined,
        },
      });

      await tool.handler({ q: 'test', author: 'user.bsky.social' });

      expect(mockAgent.app.bsky.feed.searchPosts).toHaveBeenCalled();
    });

    it('should validate author format', async () => {
      await expect(tool.handler({ q: 'test', author: 'invalid' })).rejects.toThrow();
    });
  });
});
