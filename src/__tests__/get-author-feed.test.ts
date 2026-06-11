/**
 * Unit tests for GetAuthorFeedTool
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetAuthorFeedTool } from '../tools/implementations/get-author-feed-tool.js';
import type { AtpClient } from '../utils/atp-client.js';

const makeFeedItem = (n: number) => ({
  post: {
    uri: `at://did:plc:author/app.bsky.feed.post/${n}`,
    cid: `cid${n}`,
    author: {
      did: 'did:plc:author',
      handle: 'author.bsky.social',
      displayName: 'Author Name',
      avatar: 'https://cdn.bsky.app/img/avatar/author.jpg',
    },
    record: {
      text: `Post number ${n}`,
      createdAt: `2024-01-0${n}T00:00:00Z`,
    },
    replyCount: n,
    repostCount: n * 2,
    likeCount: n * 3,
    indexedAt: `2024-01-0${n}T00:00:01Z`,
    viewer: {
      like: n === 1 ? 'at://did:plc:me/app.bsky.feed.like/abc' : undefined,
      repost: undefined,
    },
  },
});

const createMockAtpClient = () => {
  const getAuthorFeed = vi.fn().mockResolvedValue({
    data: {
      feed: [makeFeedItem(1), makeFeedItem(2)],
      cursor: 'next-page-cursor',
    },
  });

  const mockAgent = {
    app: {
      bsky: {
        feed: {
          getAuthorFeed,
        },
      },
    },
  };

  const client = {
    getAgent: vi.fn().mockReturnValue(mockAgent),
    isAuthenticated: vi.fn().mockReturnValue(false),
    hasCredentials: vi.fn().mockReturnValue(false),
    executeAuthenticatedRequest: vi.fn().mockImplementation(async (operation: () => unknown) => {
      try {
        return { success: true, data: await operation() };
      } catch (error) {
        return { success: false, error };
      }
    }),
    executePublicRequest: vi.fn().mockImplementation(async (operation: () => unknown) => {
      try {
        return { success: true, data: await operation() };
      } catch (error) {
        return { success: false, error };
      }
    }),
  } as unknown as AtpClient;

  return { client, getAuthorFeed };
};

describe('GetAuthorFeedTool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes actor, limit, cursor, and filter to the API', async () => {
    const { client, getAuthorFeed } = createMockAtpClient();
    const tool = new GetAuthorFeedTool(client);

    await tool.handler({
      actor: 'author.bsky.social',
      limit: 20,
      cursor: 'some-cursor',
      filter: 'posts_no_replies',
    });

    expect(getAuthorFeed).toHaveBeenCalledOnce();
    const callArgs = getAuthorFeed.mock.calls[0]![0];
    expect(callArgs.actor).toBe('author.bsky.social');
    expect(callArgs.limit).toBe(20);
    expect(callArgs.cursor).toBe('some-cursor');
    expect(callArgs.filter).toBe('posts_no_replies');
  });

  it('maps feed items to normalized post shape', async () => {
    const { client } = createMockAtpClient();
    const tool = new GetAuthorFeedTool(client);

    const result = await tool.handler({ actor: 'author.bsky.social' });

    expect(result.success).toBe(true);
    expect(result.posts).toHaveLength(2);

    const post = result.posts[0];
    expect(post.uri).toBe('at://did:plc:author/app.bsky.feed.post/1');
    expect(post.cid).toBe('cid1');
    expect(post.author.did).toBe('did:plc:author');
    expect(post.author.handle).toBe('author.bsky.social');
    expect(post.author.displayName).toBe('Author Name');
    expect(post.author.avatar).toBe('https://cdn.bsky.app/img/avatar/author.jpg');
    expect(post.record.text).toBe('Post number 1');
    expect(post.record.createdAt).toBe('2024-01-01T00:00:00Z');
    expect(post.replyCount).toBe(1);
    expect(post.repostCount).toBe(2);
    expect(post.likeCount).toBe(3);
    expect(post.viewer?.like).toBe('at://did:plc:me/app.bsky.feed.like/abc');
    expect(post.viewer?.repost).toBeUndefined();
  });

  it('returns cursor from the API response', async () => {
    const { client } = createMockAtpClient();
    const tool = new GetAuthorFeedTool(client);

    const result = await tool.handler({ actor: 'author.bsky.social' });

    expect(result.cursor).toBe('next-page-cursor');
  });

  it('uses default limit of 50 when not provided', async () => {
    const { client, getAuthorFeed } = createMockAtpClient();
    const tool = new GetAuthorFeedTool(client);

    await tool.handler({ actor: 'author.bsky.social' });

    expect(getAuthorFeed.mock.calls[0]![0].limit).toBe(50);
  });

  it('omits cursor and filter from API call when not provided', async () => {
    const { client, getAuthorFeed } = createMockAtpClient();
    const tool = new GetAuthorFeedTool(client);

    await tool.handler({ actor: 'author.bsky.social' });

    const callArgs = getAuthorFeed.mock.calls[0]![0];
    expect(callArgs.cursor).toBeUndefined();
    expect(callArgs.filter).toBeUndefined();
  });

  it('returns empty posts array and no cursor when feed is empty', async () => {
    const { client, getAuthorFeed } = createMockAtpClient();
    getAuthorFeed.mockResolvedValueOnce({ data: { feed: [], cursor: undefined } });
    const tool = new GetAuthorFeedTool(client);

    const result = await tool.handler({ actor: 'author.bsky.social' });

    expect(result.success).toBe(true);
    expect(result.posts).toHaveLength(0);
    expect(result.cursor).toBeUndefined();
  });

  it('accepts all valid filter enum values', async () => {
    const { client, getAuthorFeed } = createMockAtpClient();
    const tool = new GetAuthorFeedTool(client);

    const filters = [
      'posts_with_replies',
      'posts_no_replies',
      'posts_with_media',
      'posts_and_author_threads',
    ] as const;

    for (const filter of filters) {
      await tool.handler({ actor: 'author.bsky.social', filter });
    }

    expect(getAuthorFeed).toHaveBeenCalledTimes(4);
    for (let i = 0; i < 4; i++) {
      expect(getAuthorFeed.mock.calls[i]![0].filter).toBe(filters[i]);
    }
  });
});
