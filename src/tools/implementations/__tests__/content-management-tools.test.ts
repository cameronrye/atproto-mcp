/**
 * Tests for Content Management Tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeletePostTool, UpdateProfileTool } from '../content-management-tools.js';
import { AtpClient } from '../../../utils/atp-client.js';
import { ValidationError } from '../../../types/index.js';

// Mock AtpClient
vi.mock('../../../utils/atp-client.js');

describe('DeletePostTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: DeletePostTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      com: {
        atproto: {
          repo: {
            deleteRecord: vi.fn(),
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

    tool = new DeletePostTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('delete_post');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Delete');
    });

    it('should require authentication', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      expect(tool.isAvailable()).toBe(false);
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty URI', async () => {
      await expect(tool.handler({ uri: '' })).rejects.toThrow(ValidationError);
    });

    it('should validate URI format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      await expect(tool.handler({ uri: 'invalid-uri' })).rejects.toThrow();
    });
  });

  describe('Delete Post', () => {
    it('should delete a post successfully', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: {
          value: {
            text: 'Test post',
            createdAt: '2024-01-01T00:00:00Z',
          },
        },
      });

      mockAgent.com.atproto.repo.deleteRecord.mockResolvedValue({});

      const result = await tool.handler({
        uri: 'at://did:plc:test123/app.bsky.feed.post/abc123',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Post deleted successfully');
      expect(result.deletedPost.uri).toBe('at://did:plc:test123/app.bsky.feed.post/abc123');
    });

    it('should parse URI correctly', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: { value: {} },
      });

      mockAgent.com.atproto.repo.deleteRecord.mockResolvedValue({});

      await tool.handler({
        uri: 'at://did:plc:test123/app.bsky.feed.post/abc123',
      });

      expect(mockAgent.com.atproto.repo.deleteRecord).toHaveBeenCalledWith({
        repo: 'did:plc:test123',
        collection: 'app.bsky.feed.post',
        rkey: 'abc123',
      });
    });

    it('should verify post ownership before deletion', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: { value: {} },
      });

      mockAgent.com.atproto.repo.deleteRecord.mockResolvedValue({});

      await tool.handler({
        uri: 'at://did:plc:test123/app.bsky.feed.post/abc123',
      });

      expect(mockAgent.com.atproto.repo.getRecord).toHaveBeenCalledWith({
        repo: 'did:plc:test123',
        collection: 'app.bsky.feed.post',
        rkey: 'abc123',
      });
    });

    it('should reject deleting another users post', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      await expect(
        tool.handler({
          uri: 'at://did:plc:otheruser/app.bsky.feed.post/abc123',
        })
      ).rejects.toThrow('Cannot delete post: post belongs to another user');
    });

    it('should handle invalid URI format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: { value: {} },
      });

      await expect(tool.handler({ uri: 'at://invalid' })).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle deletion failure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: { value: {} },
      });

      mockAgent.com.atproto.repo.deleteRecord.mockRejectedValue(
        new Error('Failed to delete record')
      );

      await expect(
        tool.handler({
          uri: 'at://did:plc:test123/app.bsky.feed.post/abc123',
        })
      ).rejects.toThrow();
    });

    it('should handle post not found', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockRejectedValue(new Error('Record not found'));

      await expect(
        tool.handler({
          uri: 'at://did:plc:test123/app.bsky.feed.post/abc123',
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
          uri: 'at://did:plc:test123/app.bsky.feed.post/abc123',
        })
      ).rejects.toThrow();
    });
  });
});

describe('UpdateProfileTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: UpdateProfileTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      com: {
        atproto: {
          repo: {
            putRecord: vi.fn(),
            getRecord: vi.fn(),
          },
        },
      },
      uploadBlob: vi.fn(),
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    tool = new UpdateProfileTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('update_profile');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Update');
    });

    it('should require authentication', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      expect(tool.isAvailable()).toBe(false);
    });
  });

  describe('Parameter Validation', () => {
    it('should reject display name over 64 characters', async () => {
      const longName = 'a'.repeat(65);
      await expect(tool.handler({ displayName: longName })).rejects.toThrow(ValidationError);
    });

    it('should accept display name at 64 characters', async () => {
      const name = 'a'.repeat(64);

      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: { value: {} },
      });

      mockAgent.com.atproto.repo.putRecord.mockResolvedValue({});

      const result = await tool.handler({ displayName: name });
      expect(result.success).toBe(true);
    });

    it('should reject description over 256 characters', async () => {
      const longDesc = 'a'.repeat(257);
      await expect(tool.handler({ description: longDesc })).rejects.toThrow(ValidationError);
    });

    it('should accept description at 256 characters', async () => {
      const desc = 'a'.repeat(256);

      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: { value: {} },
      });

      mockAgent.com.atproto.repo.putRecord.mockResolvedValue({});

      const result = await tool.handler({ description: desc });
      expect(result.success).toBe(true);
    });
  });

  describe('Update Profile', () => {
    it('should update display name', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: {
          value: {
            displayName: 'Old Name',
            description: 'Old bio',
          },
        },
      });

      mockAgent.com.atproto.repo.putRecord.mockResolvedValue({});

      const result = await tool.handler({ displayName: 'New Name' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Profile updated successfully');
      expect(result.updatedFields).toContain('displayName');
      expect(result.profile.displayName).toBe('New Name');
    });

    it('should update description', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: {
          value: {
            displayName: 'Test User',
            description: 'Old bio',
          },
        },
      });

      mockAgent.com.atproto.repo.putRecord.mockResolvedValue({});

      const result = await tool.handler({ description: 'New bio' });

      expect(result.success).toBe(true);
      expect(result.updatedFields).toContain('description');
      expect(result.profile.description).toBe('New bio');
    });

    it('should update multiple fields', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: { value: {} },
      });

      mockAgent.com.atproto.repo.putRecord.mockResolvedValue({});

      const result = await tool.handler({
        displayName: 'New Name',
        description: 'New bio',
      });

      expect(result.success).toBe(true);
      expect(result.updatedFields).toContain('displayName');
      expect(result.updatedFields).toContain('description');
      expect(result.profile.displayName).toBe('New Name');
      expect(result.profile.description).toBe('New bio');
    });

    it('should preserve existing fields when updating', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: {
          value: {
            displayName: 'Existing Name',
            description: 'Existing bio',
            avatar: { ref: 'avatar-ref' },
            banner: { ref: 'banner-ref' },
          },
        },
      });

      mockAgent.com.atproto.repo.putRecord.mockResolvedValue({});

      await tool.handler({ displayName: 'New Name' });

      expect(mockAgent.com.atproto.repo.putRecord).toHaveBeenCalledWith({
        repo: 'did:plc:test123',
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
        record: expect.objectContaining({
          $type: 'app.bsky.actor.profile',
          displayName: 'New Name',
          description: 'Existing bio',
          avatar: { ref: 'avatar-ref' },
          banner: { ref: 'banner-ref' },
        }),
      });
    });

    it('should handle profile creation when no existing profile', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockRejectedValue(new Error('Record not found'));

      mockAgent.com.atproto.repo.putRecord.mockResolvedValue({});

      const result = await tool.handler({
        displayName: 'New User',
        description: 'New bio',
      });

      expect(result.success).toBe(true);
      expect(result.profile.displayName).toBe('New User');
      expect(result.profile.description).toBe('New bio');
    });
  });

  describe('Error Handling', () => {
    it('should handle update failure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.getRecord.mockResolvedValue({
        data: { value: {} },
      });

      mockAgent.com.atproto.repo.putRecord.mockRejectedValue(new Error('Failed to update'));

      await expect(tool.handler({ displayName: 'New Name' })).rejects.toThrow();
    });

    it('should require authentication', async () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async () => {
        throw new Error('Authentication required');
      });

      await expect(tool.handler({ displayName: 'New Name' })).rejects.toThrow();
    });
  });
});
