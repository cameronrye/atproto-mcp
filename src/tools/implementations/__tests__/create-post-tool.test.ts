/**
 * Tests for CreatePostTool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreatePostTool } from '../create-post-tool.js';
import { AtpClient } from '../../../utils/atp-client.js';
import { ValidationError } from '../../../types/index.js';

// Mock AtpClient
vi.mock('../../../utils/atp-client.js');

describe('CreatePostTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: CreatePostTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      post: vi.fn(),
      uploadBlob: vi.fn(),
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

    tool = new CreatePostTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('create_post');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Create a new post');
    });

    it('should require authentication', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      expect(tool.isAvailable()).toBe(false);
    });
  });

  describe('Text Validation', () => {
    it('should reject empty text', async () => {
      await expect(tool.handler({ text: '' })).rejects.toThrow(ValidationError);
    });

    it('should reject text over 300 characters', async () => {
      const longText = 'a'.repeat(301);
      await expect(tool.handler({ text: longText })).rejects.toThrow(ValidationError);
    });

    it('should accept text at 300 characters', async () => {
      const text = 'a'.repeat(300);

      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.post.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.feed.post/abc123',
        cid: 'bafyreiabc123',
      });

      const result = await tool.handler({ text });
      expect(result.success).toBe(true);
    });

    it('should accept text at 1 character', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.post.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.feed.post/abc123',
        cid: 'bafyreiabc123',
      });

      const result = await tool.handler({ text: 'a' });
      expect(result.success).toBe(true);
    });
  });

  describe('Simple Post Creation', () => {
    it('should create a simple text post', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.post.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.feed.post/abc123',
        cid: 'bafyreiabc123',
      });

      const result = await tool.handler({ text: 'Hello, world!' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Post created successfully');
      expect(result.uri).toBe('at://did:plc:test123/app.bsky.feed.post/abc123');
      expect(result.cid).toBe('bafyreiabc123');
      expect(mockAgent.post).toHaveBeenCalled();
    });

    it('should include createdAt timestamp', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.post.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.feed.post/abc123',
        cid: 'bafyreiabc123',
      });

      await tool.handler({ text: 'Test post' });

      const postRecord = mockAgent.post.mock.calls[0][0];
      expect(postRecord.createdAt).toBeDefined();
      expect(postRecord.$type).toBe('app.bsky.feed.post');
    });
  });

  describe('Language Tags', () => {
    it('should accept valid language tags', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.post.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.feed.post/abc123',
        cid: 'bafyreiabc123',
      });

      await tool.handler({ text: 'Hello', langs: ['en', 'es'] });

      const postRecord = mockAgent.post.mock.calls[0][0];
      expect(postRecord.langs).toEqual(['en', 'es']);
    });

    it('should reject language codes not 2 characters', async () => {
      await expect(tool.handler({ text: 'Hello', langs: ['eng'] })).rejects.toThrow(
        ValidationError
      );
    });

    it('should accept single language tag', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.post.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.feed.post/abc123',
        cid: 'bafyreiabc123',
      });

      await tool.handler({ text: 'Hello', langs: ['en'] });

      const postRecord = mockAgent.post.mock.calls[0][0];
      expect(postRecord.langs).toEqual(['en']);
    });
  });

  describe('Reply Posts', () => {
    it('should create a reply with root and parent', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: { cid: 'bafyparentcid' },
      });

      mockAgent.post.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.feed.post/reply123',
        cid: 'bafyreplycid',
      });

      const result = await tool.handler({
        text: 'This is a reply',
        reply: {
          root: 'at://did:plc:user123/app.bsky.feed.post/root123',
          parent: 'at://did:plc:user123/app.bsky.feed.post/parent123',
        },
      });

      expect(result.success).toBe(true);
      expect(mockAgent.com.atproto.repo.getRecord).toHaveBeenCalledTimes(2);
    });

    it('should validate reply root URI', async () => {
      await expect(
        tool.handler({
          text: 'Reply',
          reply: {
            root: 'invalid-uri',
            parent: 'at://did:plc:user123/app.bsky.feed.post/parent123',
          },
        })
      ).rejects.toThrow();
    });

    it('should validate reply parent URI', async () => {
      await expect(
        tool.handler({
          text: 'Reply',
          reply: {
            root: 'at://did:plc:user123/app.bsky.feed.post/root123',
            parent: 'invalid-uri',
          },
        })
      ).rejects.toThrow();
    });

    it('should require both root and parent for reply', async () => {
      await expect(
        tool.handler({
          text: 'Reply',
          reply: {
            root: '',
            parent: 'at://did:plc:user123/app.bsky.feed.post/parent123',
          },
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('External Link Embeds', () => {
    it('should create post with external link', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.post.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.feed.post/abc123',
        cid: 'bafyreiabc123',
      });

      await tool.handler({
        text: 'Check this out',
        embed: {
          external: {
            uri: 'https://example.com',
            title: 'Example Site',
            description: 'An example website',
          },
        },
      });

      const postRecord = mockAgent.post.mock.calls[0][0];
      expect(postRecord.embed.$type).toBe('app.bsky.embed.external');
      expect(postRecord.embed.external.uri).toBe('https://example.com');
    });

    it('should validate external URI is valid URL', async () => {
      await expect(
        tool.handler({
          text: 'Test',
          embed: {
            external: {
              uri: 'not-a-url',
              title: 'Title',
              description: 'Description',
            },
          },
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should validate title length', async () => {
      const longTitle = 'a'.repeat(301);
      await expect(
        tool.handler({
          text: 'Test',
          embed: {
            external: {
              uri: 'https://example.com',
              title: longTitle,
              description: 'Description',
            },
          },
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should validate description length', async () => {
      const longDescription = 'a'.repeat(1001);
      await expect(
        tool.handler({
          text: 'Test',
          embed: {
            external: {
              uri: 'https://example.com',
              title: 'Title',
              description: longDescription,
            },
          },
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Error Handling', () => {
    it('should handle post creation failure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockResolvedValue({
        success: false,
        error: new Error('Post creation failed'),
      });

      await expect(tool.handler({ text: 'Test' })).rejects.toThrow();
    });

    it('should require authentication', async () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async () => {
        throw new Error('Authentication required');
      });

      await expect(tool.handler({ text: 'Test' })).rejects.toThrow();
    });
  });
});
