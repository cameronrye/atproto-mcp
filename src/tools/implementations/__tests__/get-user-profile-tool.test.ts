/**
 * Tests for GetUserProfileTool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetUserProfileTool } from '../get-user-profile-tool.js';
import { AtpClient } from '../../../utils/atp-client.js';
import { ValidationError } from '../../../types/index.js';

// Mock AtpClient
vi.mock('../../../utils/atp-client.js');

describe('GetUserProfileTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: GetUserProfileTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      getProfile: vi.fn(),
      getProfiles: vi.fn(),
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    tool = new GetUserProfileTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('get_user_profile');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Retrieve a user profile');
    });

    it('should work in both authenticated and unauthenticated modes', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      expect(tool.isAvailable()).toBe(true);

      mockAtpClient.isAuthenticated.mockReturnValue(true);
      expect(tool.isAvailable()).toBe(true);
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
          displayName: 'Test User',
          followersCount: 100,
          followsCount: 50,
          postsCount: 25,
        },
      });

      const result = await tool.handler({ actor: 'user.bsky.social' });
      expect(result.success).toBe(true);
    });
  });

  describe('Get Profile - Authenticated Mode', () => {
    it('should retrieve user profile by handle', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getProfile.mockResolvedValue({
        data: {
          did: 'did:plc:user123',
          handle: 'user.bsky.social',
          displayName: 'Test User',
          description: 'A test user',
          avatar: 'https://example.com/avatar.jpg',
          banner: 'https://example.com/banner.jpg',
          followersCount: 100,
          followsCount: 50,
          postsCount: 25,
          indexedAt: '2024-01-01T00:00:00Z',
          viewer: {
            muted: false,
            blockedBy: false,
            blocking: undefined,
            following: 'at://did:plc:test123/app.bsky.graph.follow/abc123',
            followedBy: 'at://did:plc:user123/app.bsky.graph.follow/def456',
          },
        },
      });

      const result = await tool.handler({ actor: 'user.bsky.social' });

      expect(result.success).toBe(true);
      expect(result.profile.did).toBe('did:plc:user123');
      expect(result.profile.handle).toBe('user.bsky.social');
      expect(result.profile.displayName).toBe('Test User');
      expect(result.profile.description).toBe('A test user');
      expect(result.profile.followersCount).toBe(100);
      expect(result.profile.followsCount).toBe(50);
      expect(result.profile.postsCount).toBe(25);
      expect(result.profile.viewer).toBeDefined();
      expect(result.profile.viewer?.following).toBe(
        'at://did:plc:test123/app.bsky.graph.follow/abc123'
      );
    });

    it('should retrieve user profile by DID', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getProfile.mockResolvedValue({
        data: {
          did: 'did:plc:user123',
          handle: 'user.bsky.social',
          displayName: 'Test User',
          followersCount: 100,
          followsCount: 50,
          postsCount: 25,
        },
      });

      const result = await tool.handler({ actor: 'did:plc:user123' });

      expect(result.success).toBe(true);
      expect(result.profile.did).toBe('did:plc:user123');
      expect(mockAgent.getProfile).toHaveBeenCalledWith({ actor: 'did:plc:user123' });
    });

    it('should include viewer data when authenticated', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getProfile.mockResolvedValue({
        data: {
          did: 'did:plc:user123',
          handle: 'user.bsky.social',
          displayName: 'Test User',
          followersCount: 100,
          followsCount: 50,
          postsCount: 25,
          viewer: {
            muted: true,
            blockedBy: false,
            blocking: 'at://did:plc:test123/app.bsky.graph.block/xyz789',
            following: undefined,
            followedBy: undefined,
          },
        },
      });

      const result = await tool.handler({ actor: 'user.bsky.social' });

      expect(result.profile.viewer).toBeDefined();
      expect(result.profile.viewer?.muted).toBe(true);
      expect(result.profile.viewer?.blocking).toBe(
        'at://did:plc:test123/app.bsky.graph.block/xyz789'
      );
    });

    it('should include labels when present', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getProfile.mockResolvedValue({
        data: {
          did: 'did:plc:user123',
          handle: 'user.bsky.social',
          displayName: 'Test User',
          followersCount: 100,
          followsCount: 50,
          postsCount: 25,
          labels: [
            {
              src: 'did:plc:labeler123',
              uri: 'at://did:plc:user123/app.bsky.actor.profile/self',
              cid: 'bafylabel123',
              val: 'verified',
              cts: '2024-01-01T00:00:00Z',
            },
          ],
        },
      });

      const result = await tool.handler({ actor: 'user.bsky.social' });

      expect(result.profile.labels).toBeDefined();
      expect(result.profile.labels).toHaveLength(1);
      expect(result.profile.labels?.[0].val).toBe('verified');
    });
  });

  describe('Get Profile - Unauthenticated Mode', () => {
    it('should retrieve profile without viewer data when unauthenticated', async () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      mockAtpClient.executePublicRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getProfile.mockResolvedValue({
        data: {
          did: 'did:plc:user123',
          handle: 'user.bsky.social',
          displayName: 'Test User',
          followersCount: 100,
          followsCount: 50,
          postsCount: 25,
        },
      });

      const result = await tool.handler({ actor: 'user.bsky.social' });

      expect(result.success).toBe(true);
      expect(result.profile.did).toBe('did:plc:user123');
      expect(result.profile.viewer).toBeUndefined();
    });
  });

  describe('Get Multiple Profiles', () => {
    it('should retrieve multiple profiles', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getProfiles.mockResolvedValue({
        data: {
          profiles: [
            {
              did: 'did:plc:user1',
              handle: 'user1.bsky.social',
              displayName: 'User 1',
              followersCount: 100,
              followsCount: 50,
              postsCount: 25,
            },
            {
              did: 'did:plc:user2',
              handle: 'user2.bsky.social',
              displayName: 'User 2',
              followersCount: 200,
              followsCount: 75,
              postsCount: 50,
            },
          ],
        },
      });

      const result = await tool.getProfiles(['user1.bsky.social', 'user2.bsky.social']);

      expect(result.success).toBe(true);
      expect(result.profiles).toHaveLength(2);
      expect(result.profiles[0].handle).toBe('user1.bsky.social');
      expect(result.profiles[1].handle).toBe('user2.bsky.social');
    });

    it('should validate all actors in batch request', async () => {
      await expect(tool.getProfiles(['user1.bsky.social', ''])).rejects.toThrow();
    });

    it('should include viewer data for multiple profiles when authenticated', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getProfiles.mockResolvedValue({
        data: {
          profiles: [
            {
              did: 'did:plc:user1',
              handle: 'user1.bsky.social',
              displayName: 'User 1',
              followersCount: 100,
              followsCount: 50,
              postsCount: 25,
              viewer: {
                following: 'at://did:plc:test123/app.bsky.graph.follow/abc123',
              },
            },
          ],
        },
      });

      const result = await tool.getProfiles(['user1.bsky.social']);

      expect(result.profiles[0].viewer).toBeDefined();
      expect(result.profiles[0].viewer?.following).toBe(
        'at://did:plc:test123/app.bsky.graph.follow/abc123'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle profile not found', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getProfile.mockRejectedValue(new Error('Profile not found'));

      await expect(tool.handler({ actor: 'nonexistent.bsky.social' })).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getProfile.mockRejectedValue(new Error('Network error'));

      await expect(tool.handler({ actor: 'user.bsky.social' })).rejects.toThrow();
    });

    it('should handle batch request errors', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getProfiles.mockRejectedValue(new Error('Batch request failed'));

      await expect(tool.getProfiles(['user1.bsky.social', 'user2.bsky.social'])).rejects.toThrow();
    });
  });

  describe('Profile Data Transformation', () => {
    it('should handle optional fields correctly', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.getProfile.mockResolvedValue({
        data: {
          did: 'did:plc:user123',
          handle: 'user.bsky.social',
          followersCount: 0,
          followsCount: 0,
          postsCount: 0,
        },
      });

      const result = await tool.handler({ actor: 'user.bsky.social' });

      expect(result.success).toBe(true);
      expect(result.profile.displayName).toBeUndefined();
      expect(result.profile.description).toBeUndefined();
      expect(result.profile.avatar).toBeUndefined();
      expect(result.profile.banner).toBeUndefined();
    });

    it('should preserve all profile fields', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      const profileData = {
        did: 'did:plc:user123',
        handle: 'user.bsky.social',
        displayName: 'Test User',
        description: 'Bio text',
        avatar: 'https://example.com/avatar.jpg',
        banner: 'https://example.com/banner.jpg',
        followersCount: 100,
        followsCount: 50,
        postsCount: 25,
        indexedAt: '2024-01-01T00:00:00Z',
      };

      mockAgent.getProfile.mockResolvedValue({ data: profileData });

      const result = await tool.handler({ actor: 'user.bsky.social' });

      expect(result.profile.did).toBe(profileData.did);
      expect(result.profile.handle).toBe(profileData.handle);
      expect(result.profile.displayName).toBe(profileData.displayName);
      expect(result.profile.description).toBe(profileData.description);
      expect(result.profile.avatar).toBe(profileData.avatar);
      expect(result.profile.banner).toBe(profileData.banner);
      expect(result.profile.followersCount).toBe(profileData.followersCount);
      expect(result.profile.followsCount).toBe(profileData.followsCount);
      expect(result.profile.postsCount).toBe(profileData.postsCount);
      expect(result.profile.indexedAt).toBe(profileData.indexedAt);
    });
  });
});
