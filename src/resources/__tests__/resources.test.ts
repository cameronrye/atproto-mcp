/**
 * Tests for MCP Resources
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimelineResource, ProfileResource, NotificationsResource } from '../index.js';
import type { AtpClient } from '../../utils/atp-client.js';
import type { BskyAgent } from '@atproto/api';

// Mock AtpClient
const createMockAtpClient = (authenticated = true) => {
  const mockAgent = {
    getTimeline: vi.fn(),
    session: { did: 'did:plc:test123', handle: 'test.bsky.social' },
    getProfile: vi.fn(),
    listNotifications: vi.fn(),
  } as unknown as BskyAgent;

  return {
    isAuthenticated: vi.fn().mockReturnValue(authenticated),
    getAgent: vi.fn().mockReturnValue(mockAgent),
  } as unknown as AtpClient;
};

describe('TimelineResource', () => {
  let resource: TimelineResource;
  let mockClient: AtpClient;
  let mockAgent: BskyAgent;

  beforeEach(() => {
    mockClient = createMockAtpClient();
    mockAgent = mockClient.getAgent();
    resource = new TimelineResource(mockClient);
  });

  describe('Schema', () => {
    it('should have correct URI', () => {
      expect(resource.uri).toBe('atproto://timeline');
    });

    it('should have name', () => {
      expect(resource.name).toBe('User Timeline');
    });

    it('should have description', () => {
      expect(resource.description).toBeTruthy();
      expect(resource.description).toContain('timeline');
    });

    it('should have JSON mime type', () => {
      expect(resource.mimeType).toBe('application/json');
    });
  });

  describe('Read', () => {
    it('should require authentication', async () => {
      const unauthClient = createMockAtpClient(false);
      const unauthResource = new TimelineResource(unauthClient);

      await expect(unauthResource.read()).rejects.toThrow('Authentication required');
    });

    it('should read timeline data', async () => {
      const mockFeed = {
        feed: [
          {
            post: {
              uri: 'at://did:plc:test/app.bsky.feed.post/123',
              cid: 'bafytest123',
              author: {
                did: 'did:plc:author',
                handle: 'author.bsky.social',
                displayName: 'Author',
                avatar: 'https://example.com/avatar.jpg',
              },
              record: {
                text: 'Test post',
                createdAt: '2024-01-01T00:00:00Z',
              },
              replyCount: 5,
              repostCount: 10,
              likeCount: 20,
              viewer: { like: 'at://like/123' },
            },
          },
        ],
        cursor: 'next-cursor',
      };

      mockAgent.getTimeline = vi.fn().mockResolvedValue({ data: mockFeed });

      const result = await resource.read();

      expect(result.uri).toBe('atproto://timeline');
      expect(result.mimeType).toBe('application/json');
      expect(result.text).toBeTruthy();

      const data = JSON.parse(result.text);
      expect(data.posts).toHaveLength(1);
      expect(data.posts[0].text).toBe('Test post');
      expect(data.posts[0].isLiked).toBe(true);
      expect(data.cursor).toBe('next-cursor');
    });

    it('should handle empty timeline', async () => {
      mockAgent.getTimeline = vi.fn().mockResolvedValue({ data: { feed: [] } });

      const result = await resource.read();
      const data = JSON.parse(result.text);
      expect(data.posts).toHaveLength(0);
    });
  });
});

describe('ProfileResource', () => {
  let resource: ProfileResource;
  let mockClient: AtpClient;
  let mockAgent: BskyAgent;

  beforeEach(() => {
    mockClient = createMockAtpClient();
    mockAgent = mockClient.getAgent();
    resource = new ProfileResource(mockClient);
  });

  describe('Schema', () => {
    it('should have correct URI', () => {
      expect(resource.uri).toBe('atproto://profile');
    });

    it('should have name', () => {
      expect(resource.name).toBe('User Profile');
    });

    it('should have JSON mime type', () => {
      expect(resource.mimeType).toBe('application/json');
    });
  });

  describe('Read', () => {
    it('should require authentication', async () => {
      const unauthClient = createMockAtpClient(false);
      const unauthResource = new ProfileResource(unauthClient);

      await expect(unauthResource.read()).rejects.toThrow('Authentication required');
    });

    it('should read profile data', async () => {
      const mockProfile = {
        did: 'did:plc:test123',
        handle: 'test.bsky.social',
        displayName: 'Test User',
        description: 'Test bio',
        followersCount: 100,
        followsCount: 50,
        postsCount: 200,
      };

      mockAgent.getProfile = vi.fn().mockResolvedValue({ data: mockProfile });

      const result = await resource.read();

      expect(result.uri).toBe('atproto://profile');
      expect(result.mimeType).toBe('application/json');

      const data = JSON.parse(result.text);
      expect(data.profile.did).toBe('did:plc:test123');
      expect(data.profile.handle).toBe('test.bsky.social');
      expect(data.session.did).toBe('did:plc:test123');
    });
  });
});

describe('NotificationsResource', () => {
  let resource: NotificationsResource;
  let mockClient: AtpClient;

  beforeEach(() => {
    mockClient = createMockAtpClient();
    resource = new NotificationsResource(mockClient);
  });

  describe('Schema', () => {
    it('should have correct URI', () => {
      expect(resource.uri).toBe('atproto://notifications');
    });

    it('should have name', () => {
      expect(resource.name).toBeTruthy();
    });
  });
});
