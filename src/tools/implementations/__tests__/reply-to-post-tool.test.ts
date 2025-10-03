/**
 * Tests for ReplyToPostTool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReplyToPostTool } from '../reply-to-post-tool.js';
import { AtpClient } from '../../../utils/atp-client.js';
import { ValidationError } from '../../../types/index.js';

// Mock AtpClient
vi.mock('../../../utils/atp-client.js');

describe('ReplyToPostTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: ReplyToPostTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      post: vi.fn(),
      com: {
        atproto: {
          repo: {
            getRecord: vi.fn(),
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

    tool = new ReplyToPostTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('reply_to_post');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Reply to an existing post');
    });

    it('should require authentication', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      expect(tool.isAvailable()).toBe(false);
    });
  });

  describe('Text Validation', () => {
    it('should reject empty text', async () => {
      await expect(
        tool.handler({
          text: '',
          root: 'at://did:plc:user123/app.bsky.feed.post/root123',
          parent: 'at://did:plc:user123/app.bsky.feed.post/parent123',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject text over 300 characters', async () => {
      const longText = 'a'.repeat(301);
      await expect(
        tool.handler({
          text: longText,
          root: 'at://did:plc:user123/app.bsky.feed.post/root123',
          parent: 'at://did:plc:user123/app.bsky.feed.post/parent123',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should accept text at 300 characters', async () => {
      const text = 'a'.repeat(300);

      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: { cid: 'bafycid123' },
      });

      mockAgent.post.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.feed.post/reply123',
        cid: 'bafyreplycid',
      });

      const result = await tool.handler({
        text,
        root: 'at://did:plc:user123/app.bsky.feed.post/root123',
        parent: 'at://did:plc:user123/app.bsky.feed.post/parent123',
      });

      expect(result.success).toBe(true);
    });

    it('should accept text at 1 character', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: { cid: 'bafycid123' },
      });

      mockAgent.post.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.feed.post/reply123',
        cid: 'bafyreplycid',
      });

      const result = await tool.handler({
        text: 'a',
        root: 'at://did:plc:user123/app.bsky.feed.post/root123',
        parent: 'at://did:plc:user123/app.bsky.feed.post/parent123',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('URI Validation', () => {
    it('should reject empty root URI', async () => {
      await expect(
        tool.handler({
          text: 'Reply text',
          root: '',
          parent: 'at://did:plc:user123/app.bsky.feed.post/parent123',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject empty parent URI', async () => {
      await expect(
        tool.handler({
          text: 'Reply text',
          root: 'at://did:plc:user123/app.bsky.feed.post/root123',
          parent: '',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should validate root URI format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => {
        try {
          await fn();
        } catch (error) {
          throw error;
        }
      });

      await expect(
        tool.handler({
          text: 'Reply text',
          root: 'invalid-uri',
          parent: 'at://did:plc:user123/app.bsky.feed.post/parent123',
        })
      ).rejects.toThrow();
    });

    it('should validate parent URI format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => {
        try {
          await fn();
        } catch (error) {
          throw error;
        }
      });

      await expect(
        tool.handler({
          text: 'Reply text',
          root: 'at://did:plc:user123/app.bsky.feed.post/root123',
          parent: 'invalid-uri',
        })
      ).rejects.toThrow();
    });
  });

  describe('Reply Creation', () => {
    it('should create a reply successfully', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: { cid: 'bafycid123' },
      });

      mockAgent.post.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.feed.post/reply123',
        cid: 'bafyreplycid',
      });

      const result = await tool.handler({
        text: 'This is a reply',
        root: 'at://did:plc:user123/app.bsky.feed.post/root123',
        parent: 'at://did:plc:user123/app.bsky.feed.post/parent123',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Reply created successfully');
      expect(result.uri).toBe('at://did:plc:test123/app.bsky.feed.post/reply123');
      expect(result.cid).toBe('bafyreplycid');
      expect(result.replyTo.root).toBe('at://did:plc:user123/app.bsky.feed.post/root123');
      expect(result.replyTo.parent).toBe('at://did:plc:user123/app.bsky.feed.post/parent123');
    });

    it('should fetch CIDs for root and parent posts', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: { cid: 'bafycid123' },
      });

      mockAgent.post.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.feed.post/reply123',
        cid: 'bafyreplycid',
      });

      await tool.handler({
        text: 'Reply',
        root: 'at://did:plc:user123/app.bsky.feed.post/root123',
        parent: 'at://did:plc:user123/app.bsky.feed.post/parent123',
      });

      // Should be called twice - once for root, once for parent
      expect(mockAgent.com.atproto.repo.getRecord).toHaveBeenCalledTimes(2);
    });

    it('should create reply record with correct structure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: { cid: 'bafycid123' },
      });

      mockAgent.post.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.feed.post/reply123',
        cid: 'bafyreplycid',
      });

      await tool.handler({
        text: 'Reply text',
        root: 'at://did:plc:user123/app.bsky.feed.post/root123',
        parent: 'at://did:plc:user123/app.bsky.feed.post/parent123',
      });

      expect(mockAgent.post).toHaveBeenCalledWith(
        expect.objectContaining({
          $type: 'app.bsky.feed.post',
          text: 'Reply text',
          createdAt: expect.any(String),
          reply: {
            root: {
              uri: 'at://did:plc:user123/app.bsky.feed.post/root123',
              cid: 'bafycid123',
            },
            parent: {
              uri: 'at://did:plc:user123/app.bsky.feed.post/parent123',
              cid: 'bafycid123',
            },
          },
        })
      );
    });
  });

  describe('Language Tags', () => {
    it('should accept valid language tags', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: { cid: 'bafycid123' },
      });

      mockAgent.post.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.feed.post/reply123',
        cid: 'bafyreplycid',
      });

      await tool.handler({
        text: 'Reply',
        root: 'at://did:plc:user123/app.bsky.feed.post/root123',
        parent: 'at://did:plc:user123/app.bsky.feed.post/parent123',
        langs: ['en', 'es'],
      });

      expect(mockAgent.post).toHaveBeenCalledWith(
        expect.objectContaining({
          langs: ['en', 'es'],
        })
      );
    });

    it('should reject language codes not 2 characters', async () => {
      await expect(
        tool.handler({
          text: 'Reply',
          root: 'at://did:plc:user123/app.bsky.feed.post/root123',
          parent: 'at://did:plc:user123/app.bsky.feed.post/parent123',
          langs: ['eng'],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should accept single language tag', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: { cid: 'bafycid123' },
      });

      mockAgent.post.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.feed.post/reply123',
        cid: 'bafyreplycid',
      });

      await tool.handler({
        text: 'Reply',
        root: 'at://did:plc:user123/app.bsky.feed.post/root123',
        parent: 'at://did:plc:user123/app.bsky.feed.post/parent123',
        langs: ['en'],
      });

      expect(mockAgent.post).toHaveBeenCalledWith(
        expect.objectContaining({
          langs: ['en'],
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle reply creation failure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: { cid: 'bafycid123' },
      });

      mockAgent.post.mockRejectedValue(new Error('Failed to create reply'));

      await expect(
        tool.handler({
          text: 'Reply',
          root: 'at://did:plc:user123/app.bsky.feed.post/root123',
          parent: 'at://did:plc:user123/app.bsky.feed.post/parent123',
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
          text: 'Reply',
          root: 'at://did:plc:user123/app.bsky.feed.post/root123',
          parent: 'at://did:plc:user123/app.bsky.feed.post/parent123',
        })
      ).rejects.toThrow();
    });
  });
});
