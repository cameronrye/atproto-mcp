/**
 * Tests for FollowUserTool and UnfollowUserTool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FollowUserTool, UnfollowUserTool } from '../follow-user-tool.js';
import { AtpClient } from '../../../utils/atp-client.js';
import { ValidationError } from '../../../types/index.js';

// Mock AtpClient
vi.mock('../../../utils/atp-client.js');

describe('FollowUserTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: FollowUserTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      getProfile: vi.fn(),
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

    tool = new FollowUserTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('follow_user');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Follow a user');
    });

    it('should require authentication', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      expect(tool.isAvailable()).toBe(false);
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty actor', async () => {
      await expect(tool.handler({ actor: '' })).rejects.toThrow(ValidationError);
    });

    it('should validate actor format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getProfile.mockResolvedValue({
        data: {
          did: 'did:plc:user123',
          handle: 'user.bsky.social',
        },
      });

      mockAgent.com.atproto.repo.listRecords.mockResolvedValue({
        data: { records: [] },
      });

      mockAgent.com.atproto.repo.createRecord.mockResolvedValue({
        data: {
          uri: 'at://did:plc:test123/app.bsky.graph.follow/follow123',
          cid: 'bafyfollowcid',
        },
      });

      const result = await tool.handler({ actor: 'user.bsky.social' });
      expect(result.success).toBe(true);
    });
  });

  describe('Follow User', () => {
    it('should follow a user by handle', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getProfile.mockResolvedValue({
        data: {
          did: 'did:plc:user123',
          handle: 'user.bsky.social',
        },
      });

      mockAgent.com.atproto.repo.listRecords.mockResolvedValue({
        data: { records: [] },
      });

      mockAgent.com.atproto.repo.createRecord.mockResolvedValue({
        data: {
          uri: 'at://did:plc:test123/app.bsky.graph.follow/follow123',
          cid: 'bafyfollowcid',
        },
      });

      const result = await tool.handler({ actor: 'user.bsky.social' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('User followed successfully');
      expect(result.uri).toBe('at://did:plc:test123/app.bsky.graph.follow/follow123');
      expect(result.followedUser.did).toBe('did:plc:user123');
      expect(result.followedUser.handle).toBe('user.bsky.social');
    });

    it('should follow a user by DID', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getProfile.mockResolvedValue({
        data: {
          did: 'did:plc:user123',
          handle: 'user.bsky.social',
        },
      });

      mockAgent.com.atproto.repo.listRecords.mockResolvedValue({
        data: { records: [] },
      });

      mockAgent.com.atproto.repo.createRecord.mockResolvedValue({
        data: {
          uri: 'at://did:plc:test123/app.bsky.graph.follow/follow123',
          cid: 'bafyfollowcid',
        },
      });

      const result = await tool.handler({ actor: 'did:plc:user123' });

      expect(result.success).toBe(true);
      expect(mockAgent.getProfile).toHaveBeenCalledWith({ actor: 'did:plc:user123' });
    });

    it('should create follow record with correct structure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getProfile.mockResolvedValue({
        data: {
          did: 'did:plc:user123',
          handle: 'user.bsky.social',
        },
      });

      mockAgent.com.atproto.repo.listRecords.mockResolvedValue({
        data: { records: [] },
      });

      mockAgent.com.atproto.repo.createRecord.mockResolvedValue({
        data: {
          uri: 'at://did:plc:test123/app.bsky.graph.follow/follow123',
          cid: 'bafyfollowcid',
        },
      });

      await tool.handler({ actor: 'user.bsky.social' });

      expect(mockAgent.com.atproto.repo.createRecord).toHaveBeenCalledWith({
        repo: 'did:plc:test123',
        collection: 'app.bsky.graph.follow',
        record: expect.objectContaining({
          $type: 'app.bsky.graph.follow',
          subject: 'did:plc:user123',
          createdAt: expect.any(String),
        }),
      });
    });

    it('should handle already following user', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getProfile.mockResolvedValue({
        data: {
          did: 'did:plc:user123',
          handle: 'user.bsky.social',
        },
      });

      mockAgent.com.atproto.repo.listRecords.mockResolvedValue({
        data: {
          records: [
            {
              uri: 'at://did:plc:test123/app.bsky.graph.follow/existing',
              cid: 'bafyexisting',
              value: {
                subject: 'did:plc:user123',
              },
            },
          ],
        },
      });

      const result = await tool.handler({ actor: 'user.bsky.social' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('User was already being followed');
      expect(result.uri).toBe('at://did:plc:test123/app.bsky.graph.follow/existing');
      expect(mockAgent.com.atproto.repo.createRecord).not.toHaveBeenCalled();
    });

    it('should check for existing follows', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getProfile.mockResolvedValue({
        data: {
          did: 'did:plc:user123',
          handle: 'user.bsky.social',
        },
      });

      mockAgent.com.atproto.repo.listRecords.mockResolvedValue({
        data: { records: [] },
      });

      mockAgent.com.atproto.repo.createRecord.mockResolvedValue({
        data: {
          uri: 'at://did:plc:test123/app.bsky.graph.follow/follow123',
          cid: 'bafyfollowcid',
        },
      });

      await tool.handler({ actor: 'user.bsky.social' });

      expect(mockAgent.com.atproto.repo.listRecords).toHaveBeenCalledWith({
        repo: 'did:plc:test123',
        collection: 'app.bsky.graph.follow',
        limit: 100,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle profile resolution failure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getProfile.mockRejectedValue(new Error('Profile not found'));

      await expect(tool.handler({ actor: 'nonexistent.bsky.social' })).rejects.toThrow();
    });

    it('should handle follow creation failure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getProfile.mockResolvedValue({
        data: {
          did: 'did:plc:user123',
          handle: 'user.bsky.social',
        },
      });

      mockAgent.com.atproto.repo.listRecords.mockResolvedValue({
        data: { records: [] },
      });

      mockAgent.com.atproto.repo.createRecord.mockRejectedValue(
        new Error('Failed to create follow')
      );

      await expect(tool.handler({ actor: 'user.bsky.social' })).rejects.toThrow();
    });
  });
});

describe('UnfollowUserTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: UnfollowUserTool;

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

    tool = new UnfollowUserTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('unfollow_user');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Unfollow a user');
    });

    it('should require authentication', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      expect(tool.isAvailable()).toBe(false);
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty follow URI', async () => {
      await expect(tool.handler({ followUri: '' })).rejects.toThrow(ValidationError);
    });

    it('should validate follow URI format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => {
        try {
          await fn();
        } catch (error) {
          throw error;
        }
      });

      await expect(tool.handler({ followUri: 'invalid-uri' })).rejects.toThrow();
    });
  });

  describe('Unfollow User', () => {
    it('should unfollow a user successfully', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.deleteRecord.mockResolvedValue({});

      const result = await tool.handler({
        followUri: 'at://did:plc:test123/app.bsky.graph.follow/follow123',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('User unfollowed successfully');
      expect(result.deletedFollow.uri).toBe('at://did:plc:test123/app.bsky.graph.follow/follow123');
    });

    it('should parse follow URI correctly', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.deleteRecord.mockResolvedValue({});

      await tool.handler({
        followUri: 'at://did:plc:test123/app.bsky.graph.follow/follow123',
      });

      expect(mockAgent.com.atproto.repo.deleteRecord).toHaveBeenCalledWith({
        repo: 'did:plc:test123',
        collection: 'app.bsky.graph.follow',
        rkey: 'follow123',
      });
    });

    it('should handle unfollow failure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.repo.deleteRecord.mockRejectedValue(
        new Error('Failed to delete follow')
      );

      await expect(
        tool.handler({
          followUri: 'at://did:plc:test123/app.bsky.graph.follow/follow123',
        })
      ).rejects.toThrow();
    });

    it('should handle invalid URI format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      await expect(tool.handler({ followUri: 'at://invalid' })).rejects.toThrow();
    });
  });
});
