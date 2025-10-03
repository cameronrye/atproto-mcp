/**
 * Tests for MCP Resources
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BaseResource,
  TimelineResource,
  ProfileResource,
  NotificationsResource,
  createResources,
} from '../index.js';
import { AtpClient } from '../../utils/atp-client.js';

// Mock AtpClient
vi.mock('../../utils/atp-client.js');

describe('BaseResource', () => {
  let mockAtpClient: any;

  beforeEach(() => {
    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
    };
  });

  it('should check availability based on authentication', async () => {
    class TestResource extends BaseResource {
      uri = 'test://resource';
      name = 'Test';
      description = 'Test resource';
      mimeType = 'text/plain';
      async read() {
        return { uri: this.uri, mimeType: this.mimeType, text: 'test' };
      }
    }

    const resource = new TestResource(mockAtpClient, 'TestResource');
    expect(await resource.isAvailable()).toBe(true);
  });

  it('should return false when authentication check throws', async () => {
    mockAtpClient.isAuthenticated.mockImplementation(() => {
      throw new Error('Auth check failed');
    });

    class TestResource extends BaseResource {
      uri = 'test://resource';
      name = 'Test';
      description = 'Test resource';
      mimeType = 'text/plain';
      async read() {
        return { uri: this.uri, mimeType: this.mimeType, text: 'test' };
      }
    }

    const resource = new TestResource(mockAtpClient, 'TestResource');
    expect(await resource.isAvailable()).toBe(false);
  });
});

describe('TimelineResource', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let resource: TimelineResource;

  beforeEach(() => {
    mockAgent = {
      getTimeline: vi.fn(),
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    resource = new TimelineResource(mockAtpClient);
  });

  describe('Schema', () => {
    it('should have correct URI', () => {
      expect(resource.uri).toBe('atproto://timeline');
    });

    it('should have name', () => {
      expect(resource.name).toBe('User Timeline');
    });

    it('should have description', () => {
      expect(resource.description).toBeDefined();
      expect(resource.description).toContain('timeline');
    });

    it('should have JSON mime type', () => {
      expect(resource.mimeType).toBe('application/json');
    });
  });

  describe('Read', () => {
    it('should read timeline successfully', async () => {
      mockAgent.getTimeline.mockResolvedValue({
        data: {
          feed: [
            {
              post: {
                uri: 'at://did:plc:test/app.bsky.feed.post/123',
                cid: 'bafytest',
                author: {
                  did: 'did:plc:test',
                  handle: 'test.bsky.social',
                  displayName: 'Test User',
                  avatar: 'https://example.com/avatar.jpg',
                },
                record: {
                  text: 'Test post',
                  createdAt: '2024-01-01T00:00:00Z',
                },
                replyCount: 1,
                repostCount: 2,
                likeCount: 3,
                viewer: {
                  like: 'at://like',
                  repost: 'at://repost',
                },
              },
            },
          ],
          cursor: 'cursor123',
        },
      });

      const content = await resource.read();

      expect(content.uri).toBe('atproto://timeline');
      expect(content.mimeType).toBe('application/json');
      expect(content.text).toBeDefined();

      const data = JSON.parse(content.text!);
      expect(data.posts).toHaveLength(1);
      expect(data.posts[0].uri).toBe('at://did:plc:test/app.bsky.feed.post/123');
      expect(data.posts[0].author.handle).toBe('test.bsky.social');
      expect(data.posts[0].text).toBe('Test post');
      expect(data.posts[0].likeCount).toBe(3);
      expect(data.posts[0].isLiked).toBe(true);
      expect(data.posts[0].isReposted).toBe(true);
      expect(data.cursor).toBe('cursor123');
    });

    it('should handle posts without viewer data', async () => {
      mockAgent.getTimeline.mockResolvedValue({
        data: {
          feed: [
            {
              post: {
                uri: 'at://did:plc:test/app.bsky.feed.post/123',
                cid: 'bafytest',
                author: {
                  did: 'did:plc:test',
                  handle: 'test.bsky.social',
                },
                record: {
                  text: 'Test post',
                  createdAt: '2024-01-01T00:00:00Z',
                },
                viewer: {},
              },
            },
          ],
        },
      });

      const content = await resource.read();
      const data = JSON.parse(content.text!);

      expect(data.posts[0].isLiked).toBe(false);
      expect(data.posts[0].isReposted).toBe(false);
    });

    it('should require authentication', async () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);

      await expect(resource.read()).rejects.toThrow('Authentication required');
    });

    it('should handle timeline fetch errors', async () => {
      mockAgent.getTimeline.mockRejectedValue(new Error('Timeline fetch failed'));

      await expect(resource.read()).rejects.toThrow('Timeline fetch failed');
    });
  });
});

describe('ProfileResource', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let resource: ProfileResource;

  beforeEach(() => {
    mockAgent = {
      getProfile: vi.fn(),
      session: {
        did: 'did:plc:test',
        handle: 'test.bsky.social',
        active: true,
      },
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    resource = new ProfileResource(mockAtpClient);
  });

  describe('Schema', () => {
    it('should have correct URI', () => {
      expect(resource.uri).toBe('atproto://profile');
    });

    it('should have name', () => {
      expect(resource.name).toBe('User Profile');
    });

    it('should have description', () => {
      expect(resource.description).toBeDefined();
      expect(resource.description).toContain('profile');
    });

    it('should have JSON mime type', () => {
      expect(resource.mimeType).toBe('application/json');
    });
  });

  describe('Read', () => {
    it('should read profile successfully', async () => {
      mockAgent.getProfile.mockResolvedValue({
        data: {
          did: 'did:plc:test',
          handle: 'test.bsky.social',
          displayName: 'Test User',
          description: 'Test bio',
          avatar: 'https://example.com/avatar.jpg',
          banner: 'https://example.com/banner.jpg',
          followersCount: 100,
          followsCount: 50,
          postsCount: 25,
          indexedAt: '2024-01-01T00:00:00Z',
          createdAt: '2023-01-01T00:00:00Z',
          labels: [],
        },
      });

      const content = await resource.read();

      expect(content.uri).toBe('atproto://profile');
      expect(content.mimeType).toBe('application/json');
      expect(content.text).toBeDefined();

      const data = JSON.parse(content.text!);
      expect(data.profile.did).toBe('did:plc:test');
      expect(data.profile.handle).toBe('test.bsky.social');
      expect(data.profile.displayName).toBe('Test User');
      expect(data.profile.followersCount).toBe(100);
      expect(data.session.did).toBe('did:plc:test');
      expect(data.session.active).toBe(true);
    });

    it('should require authentication', async () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);

      await expect(resource.read()).rejects.toThrow('Authentication required');
    });

    it('should require active session', async () => {
      mockAgent.session = null;

      await expect(resource.read()).rejects.toThrow('No active session found');
    });

    it('should handle profile fetch errors', async () => {
      mockAgent.getProfile.mockRejectedValue(new Error('Profile fetch failed'));

      await expect(resource.read()).rejects.toThrow('Profile fetch failed');
    });
  });
});

describe('NotificationsResource', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let resource: NotificationsResource;

  beforeEach(() => {
    mockAgent = {
      listNotifications: vi.fn(),
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    resource = new NotificationsResource(mockAtpClient);
  });

  describe('Schema', () => {
    it('should have correct URI', () => {
      expect(resource.uri).toBe('atproto://notifications');
    });

    it('should have name', () => {
      expect(resource.name).toBe('User Notifications');
    });

    it('should have description', () => {
      expect(resource.description).toBeDefined();
      expect(resource.description).toContain('notifications');
    });

    it('should have JSON mime type', () => {
      expect(resource.mimeType).toBe('application/json');
    });
  });

  describe('Read', () => {
    it('should read notifications successfully', async () => {
      mockAgent.listNotifications.mockResolvedValue({
        data: {
          notifications: [
            {
              uri: 'at://did:plc:test/app.bsky.feed.like/123',
              cid: 'bafytest',
              author: {
                did: 'did:plc:other',
                handle: 'other.bsky.social',
                displayName: 'Other User',
                avatar: 'https://example.com/avatar.jpg',
              },
              reason: 'like',
              reasonSubject: 'at://did:plc:test/app.bsky.feed.post/456',
              record: { text: 'Test' },
              isRead: false,
              indexedAt: '2024-01-01T00:00:00Z',
              labels: [],
            },
          ],
          cursor: 'cursor123',
          seenAt: '2024-01-01T00:00:00Z',
        },
      });

      const content = await resource.read();

      expect(content.uri).toBe('atproto://notifications');
      expect(content.mimeType).toBe('application/json');
      expect(content.text).toBeDefined();

      const data = JSON.parse(content.text!);
      expect(data.notifications).toHaveLength(1);
      expect(data.notifications[0].reason).toBe('like');
      expect(data.notifications[0].author.handle).toBe('other.bsky.social');
      expect(data.notifications[0].isRead).toBe(false);
      expect(data.cursor).toBe('cursor123');
      expect(data.seenAt).toBe('2024-01-01T00:00:00Z');
    });

    it('should require authentication', async () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);

      await expect(resource.read()).rejects.toThrow('Authentication required');
    });

    it('should handle notifications fetch errors', async () => {
      mockAgent.listNotifications.mockRejectedValue(new Error('Notifications fetch failed'));

      await expect(resource.read()).rejects.toThrow('Notifications fetch failed');
    });
  });
});

describe('createResources', () => {
  let mockAtpClient: any;

  beforeEach(() => {
    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
    };
  });

  it('should create all resources', () => {
    const resources = createResources(mockAtpClient);

    expect(resources).toHaveLength(3);
    expect(resources[0]).toBeInstanceOf(TimelineResource);
    expect(resources[1]).toBeInstanceOf(ProfileResource);
    expect(resources[2]).toBeInstanceOf(NotificationsResource);
  });

  it('should handle errors during resource creation', () => {
    // Create a client that throws during construction
    const badClient = {
      isAuthenticated: () => {
        throw new Error('Test error');
      },
    } as any;

    // The factory catches errors and returns empty array
    const resources = createResources(badClient);

    // Even with errors, resources are created (error handling is in isAvailable)
    expect(resources).toHaveLength(3);
  });
});
