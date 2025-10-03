/**
 * Tests for RepostTool and UnrepostTool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RepostTool, UnrepostTool } from '../repost-tool.js';
import { AtpClient } from '../../../utils/atp-client.js';
import { ValidationError } from '../../../types/index.js';

// Mock AtpClient
vi.mock('../../../utils/atp-client.js');

describe('RepostTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: RepostTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      post: vi.fn(),
      com: {
        atproto: {
          repo: {
            createRecord: vi.fn(),
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

    tool = new RepostTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('repost');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Repost content');
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

    it('should reject quote text over 300 characters', async () => {
      const longText = 'a'.repeat(301);
      await expect(
        tool.handler({
          uri: 'at://did:plc:user123/app.bsky.feed.post/abc123',
          cid: 'bafytest',
          text: longText,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should accept quote text at 300 characters', async () => {
      const text = 'a'.repeat(300);

      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.post.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.feed.post/quote123',
        cid: 'bafyquotecid',
      });

      const result = await tool.handler({
        uri: 'at://did:plc:user123/app.bsky.feed.post/abc123',
        cid: 'bafytest',
        text,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Simple Repost', () => {
    it('should create a simple repost', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.createRecord.mockResolvedValue({
        data: {
          uri: 'at://did:plc:test123/app.bsky.feed.repost/repost123',
          cid: 'bafyrepostcid',
        },
      });

      const result = await tool.handler({
        uri: 'at://did:plc:user123/app.bsky.feed.post/post123',
        cid: 'bafypostcid',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Repost created successfully');
      expect(result.uri).toBe('at://did:plc:test123/app.bsky.feed.repost/repost123');
      expect(result.cid).toBe('bafyrepostcid');
      expect(result.isQuotePost).toBe(false);
      expect(result.repostedPost.uri).toBe('at://did:plc:user123/app.bsky.feed.post/post123');
      expect(result.repostedPost.cid).toBe('bafypostcid');
    });

    it('should create repost record with correct structure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.createRecord.mockResolvedValue({
        data: {
          uri: 'at://did:plc:test123/app.bsky.feed.repost/repost123',
          cid: 'bafyrepostcid',
        },
      });

      await tool.handler({
        uri: 'at://did:plc:user123/app.bsky.feed.post/post123',
        cid: 'bafypostcid',
      });

      expect(mockAgent.com.atproto.repo.createRecord).toHaveBeenCalledWith({
        repo: 'did:plc:test123',
        collection: 'app.bsky.feed.repost',
        record: expect.objectContaining({
          $type: 'app.bsky.feed.repost',
          subject: {
            uri: 'at://did:plc:user123/app.bsky.feed.post/post123',
            cid: 'bafypostcid',
          },
          createdAt: expect.any(String),
        }),
      });
    });

    it('should not create quote post when text is empty string', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.createRecord.mockResolvedValue({
        data: {
          uri: 'at://did:plc:test123/app.bsky.feed.repost/repost123',
          cid: 'bafyrepostcid',
        },
      });

      const result = await tool.handler({
        uri: 'at://did:plc:user123/app.bsky.feed.post/post123',
        cid: 'bafypostcid',
        text: '',
      });

      expect(result.isQuotePost).toBe(false);
      expect(mockAgent.com.atproto.repo.createRecord).toHaveBeenCalled();
      expect(mockAgent.post).not.toHaveBeenCalled();
    });
  });

  describe('Quote Post', () => {
    it('should create a quote post with text', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.post.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.feed.post/quote123',
        cid: 'bafyquotecid',
      });

      const result = await tool.handler({
        uri: 'at://did:plc:user123/app.bsky.feed.post/post123',
        cid: 'bafypostcid',
        text: 'This is my quote',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Quote post created successfully');
      expect(result.uri).toBe('at://did:plc:test123/app.bsky.feed.post/quote123');
      expect(result.cid).toBe('bafyquotecid');
      expect(result.isQuotePost).toBe(true);
      expect(result.repostedPost.uri).toBe('at://did:plc:user123/app.bsky.feed.post/post123');
    });

    it('should create quote post record with correct structure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.post.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.feed.post/quote123',
        cid: 'bafyquotecid',
      });

      await tool.handler({
        uri: 'at://did:plc:user123/app.bsky.feed.post/post123',
        cid: 'bafypostcid',
        text: 'My quote text',
      });

      expect(mockAgent.post).toHaveBeenCalledWith(
        expect.objectContaining({
          $type: 'app.bsky.feed.post',
          text: 'My quote text',
          embed: {
            $type: 'app.bsky.embed.record',
            record: {
              uri: 'at://did:plc:user123/app.bsky.feed.post/post123',
              cid: 'bafypostcid',
            },
          },
          createdAt: expect.any(String),
        })
      );
    });

    it('should use agent.post for quote posts', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.post.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.feed.post/quote123',
        cid: 'bafyquotecid',
      });

      await tool.handler({
        uri: 'at://did:plc:user123/app.bsky.feed.post/post123',
        cid: 'bafypostcid',
        text: 'Quote',
      });

      expect(mockAgent.post).toHaveBeenCalled();
      expect(mockAgent.com.atproto.repo.createRecord).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle repost creation failure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.createRecord.mockRejectedValue(
        new Error('Failed to create repost')
      );

      await expect(
        tool.handler({
          uri: 'at://did:plc:user123/app.bsky.feed.post/post123',
          cid: 'bafypostcid',
        })
      ).rejects.toThrow();
    });

    it('should handle quote post creation failure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.post.mockRejectedValue(new Error('Failed to create quote post'));

      await expect(
        tool.handler({
          uri: 'at://did:plc:user123/app.bsky.feed.post/post123',
          cid: 'bafypostcid',
          text: 'Quote',
        })
      ).rejects.toThrow();
    });

    it('should require authentication', async () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async () => {
        throw new Error('Authentication required');
      });

      await expect(
        tool.handler({
          uri: 'at://did:plc:user123/app.bsky.feed.post/post123',
          cid: 'bafypostcid',
        })
      ).rejects.toThrow();
    });
  });
});

describe('UnrepostTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: UnrepostTool;

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

    tool = new UnrepostTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('unrepost');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Remove a repost');
    });

    it('should require authentication', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      expect(tool.isAvailable()).toBe(false);
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty repost URI', async () => {
      await expect(tool.handler({ repostUri: '' })).rejects.toThrow(ValidationError);
    });

    it('should validate repost URI format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => {
        try {
          await fn();
        } catch (error) {
          throw error;
        }
      });

      await expect(tool.handler({ repostUri: 'invalid-uri' })).rejects.toThrow();
    });
  });

  describe('Unrepost', () => {
    it('should remove a repost successfully', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.deleteRecord.mockResolvedValue({});

      const result = await tool.handler({
        repostUri: 'at://did:plc:test123/app.bsky.feed.repost/repost123',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Repost removed successfully');
      expect(result.deletedRepost.uri).toBe('at://did:plc:test123/app.bsky.feed.repost/repost123');
    });

    it('should parse repost URI correctly', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.deleteRecord.mockResolvedValue({});

      await tool.handler({
        repostUri: 'at://did:plc:test123/app.bsky.feed.repost/repost123',
      });

      expect(mockAgent.com.atproto.repo.deleteRecord).toHaveBeenCalledWith({
        repo: 'did:plc:test123',
        collection: 'app.bsky.feed.repost',
        rkey: 'repost123',
      });
    });

    it('should handle unrepost failure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.deleteRecord.mockRejectedValue(
        new Error('Failed to delete repost')
      );

      await expect(
        tool.handler({
          repostUri: 'at://did:plc:test123/app.bsky.feed.repost/repost123',
        })
      ).rejects.toThrow();
    });

    it('should handle invalid URI format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      await expect(tool.handler({ repostUri: 'at://invalid' })).rejects.toThrow();
    });
  });
});
