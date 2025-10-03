/**
 * Tests for LikePostTool and UnlikePostTool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LikePostTool, UnlikePostTool } from '../like-post-tool.js';
import { AtpClient } from '../../../utils/atp-client.js';
import { ValidationError } from '../../../types/index.js';

// Mock AtpClient
vi.mock('../../../utils/atp-client.js');

describe('LikePostTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: LikePostTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      com: {
        atproto: {
          repo: {
            createRecord: vi.fn(),
            listRecords: vi.fn(),
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

    tool = new LikePostTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('like_post');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Like a post');
    });

    it('should require authentication', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      expect(tool.isAvailable()).toBe(false);
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty URI', async () => {
      await expect(tool.handler({ uri: '', cid: 'bafytest' })).rejects.toThrow(ValidationError);
    });

    it('should reject empty CID', async () => {
      await expect(
        tool.handler({ uri: 'at://did:plc:user123/app.bsky.feed.post/abc123', cid: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('should validate URI format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => {
        try {
          await fn();
        } catch (error) {
          throw error;
        }
      });

      await expect(tool.handler({ uri: 'invalid-uri', cid: 'bafytest' })).rejects.toThrow();
    });

    it('should validate CID format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => {
        try {
          await fn();
        } catch (error) {
          throw error;
        }
      });

      await expect(
        tool.handler({ uri: 'at://did:plc:user123/app.bsky.feed.post/abc123', cid: 'invalid@cid' })
      ).rejects.toThrow();
    });
  });

  describe('Like Post', () => {
    it('should like a post successfully', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.listRecords.mockResolvedValue({
        data: { records: [] },
      });

      mockAgent.com.atproto.repo.createRecord.mockResolvedValue({
        data: {
          uri: 'at://did:plc:test123/app.bsky.feed.like/like123',
          cid: 'bafylikeabc123',
        },
      });

      const result = await tool.handler({
        uri: 'at://did:plc:user123/app.bsky.feed.post/post123',
        cid: 'bafypostcid',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Post liked successfully');
      expect(result.uri).toBe('at://did:plc:test123/app.bsky.feed.like/like123');
      expect(result.likedPost.uri).toBe('at://did:plc:user123/app.bsky.feed.post/post123');
      expect(mockAgent.com.atproto.repo.createRecord).toHaveBeenCalled();
    });

    it('should handle already liked post', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.listRecords.mockResolvedValue({
        data: {
          records: [
            {
              uri: 'at://did:plc:test123/app.bsky.feed.like/existing',
              cid: 'bafyexisting',
              value: {
                subject: {
                  uri: 'at://did:plc:user123/app.bsky.feed.post/post123',
                  cid: 'bafypostcid',
                },
              },
            },
          ],
        },
      });

      const result = await tool.handler({
        uri: 'at://did:plc:user123/app.bsky.feed.post/post123',
        cid: 'bafypostcid',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Post was already liked');
      expect(result.uri).toBe('at://did:plc:test123/app.bsky.feed.like/existing');
      expect(mockAgent.com.atproto.repo.createRecord).not.toHaveBeenCalled();
    });

    it('should create like record with correct structure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.listRecords.mockResolvedValue({
        data: { records: [] },
      });

      mockAgent.com.atproto.repo.createRecord.mockResolvedValue({
        data: {
          uri: 'at://did:plc:test123/app.bsky.feed.like/like123',
          cid: 'bafylikeabc123',
        },
      });

      await tool.handler({
        uri: 'at://did:plc:user123/app.bsky.feed.post/post123',
        cid: 'bafypostcid',
      });

      expect(mockAgent.com.atproto.repo.createRecord).toHaveBeenCalledWith({
        repo: 'did:plc:test123',
        collection: 'app.bsky.feed.like',
        record: expect.objectContaining({
          $type: 'app.bsky.feed.like',
          subject: {
            uri: 'at://did:plc:user123/app.bsky.feed.post/post123',
            cid: 'bafypostcid',
          },
          createdAt: expect.any(String),
        }),
      });
    });

    it('should handle like creation failure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.listRecords.mockResolvedValue({
        data: { records: [] },
      });

      mockAgent.com.atproto.repo.createRecord.mockRejectedValue(new Error('Failed to create like'));

      await expect(
        tool.handler({
          uri: 'at://did:plc:user123/app.bsky.feed.post/post123',
          cid: 'bafypostcid',
        })
      ).rejects.toThrow();
    });

    it('should check for existing likes', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.listRecords.mockResolvedValue({
        data: { records: [] },
      });

      mockAgent.com.atproto.repo.createRecord.mockResolvedValue({
        data: {
          uri: 'at://did:plc:test123/app.bsky.feed.like/like123',
          cid: 'bafylikeabc123',
        },
      });

      await tool.handler({
        uri: 'at://did:plc:user123/app.bsky.feed.post/post123',
        cid: 'bafypostcid',
      });

      expect(mockAgent.com.atproto.repo.listRecords).toHaveBeenCalledWith({
        repo: 'did:plc:test123',
        collection: 'app.bsky.feed.like',
        limit: 100,
      });
    });
  });
});

describe('UnlikePostTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: UnlikePostTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      com: {
        atproto: {
          repo: {
            deleteRecord: vi.fn(),
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

    tool = new UnlikePostTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('unlike_post');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Remove a like');
    });

    it('should require authentication', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      expect(tool.isAvailable()).toBe(false);
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty like URI', async () => {
      await expect(tool.handler({ likeUri: '' })).rejects.toThrow(ValidationError);
    });

    it('should validate like URI format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => {
        try {
          await fn();
        } catch (error) {
          throw error;
        }
      });

      await expect(tool.handler({ likeUri: 'invalid-uri' })).rejects.toThrow();
    });
  });

  describe('Unlike Post', () => {
    it('should unlike a post successfully', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.deleteRecord.mockResolvedValue({});

      const result = await tool.handler({
        likeUri: 'at://did:plc:test123/app.bsky.feed.like/like123',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Post unliked successfully');
      expect(result.deletedLike.uri).toBe('at://did:plc:test123/app.bsky.feed.like/like123');
      expect(mockAgent.com.atproto.repo.deleteRecord).toHaveBeenCalled();
    });

    it('should parse like URI correctly', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.deleteRecord.mockResolvedValue({});

      await tool.handler({
        likeUri: 'at://did:plc:test123/app.bsky.feed.like/like123',
      });

      expect(mockAgent.com.atproto.repo.deleteRecord).toHaveBeenCalledWith({
        repo: 'did:plc:test123',
        collection: 'app.bsky.feed.like',
        rkey: 'like123',
      });
    });

    it('should handle unlike failure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.deleteRecord.mockRejectedValue(new Error('Failed to delete like'));

      await expect(
        tool.handler({
          likeUri: 'at://did:plc:test123/app.bsky.feed.like/like123',
        })
      ).rejects.toThrow();
    });

    it('should handle invalid URI format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      await expect(tool.handler({ likeUri: 'at://invalid' })).rejects.toThrow();
    });
  });
});
