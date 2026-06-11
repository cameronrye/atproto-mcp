/**
 * Unit tests for the bookmark tools (app.bsky.bookmark.*).
 *
 * Bookmarks are private, server-side state keyed by the bookmarked post's URI —
 * there is no public bookmark record. The viewer.bookmarked flag from getPosts
 * is the authoritative pre-check (mirroring like_post's viewer.like pattern),
 * and the AppView treats duplicate creates / missing deletes as no-ops, so the
 * tools' alreadyBookmarked / wasBookmarked flags must stay honest.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AddBookmarkTool,
  GetBookmarksTool,
  RemoveBookmarkTool,
} from '../tools/implementations/bookmark-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

const POST_URI = 'at://did:plc:author/app.bsky.feed.post/3k001';
const POST_CID = 'bafyreipost001';

interface IMockOptions {
  bookmarked?: boolean;
  getPostsFails?: boolean;
  bookmarksPage?: { cursor?: string; bookmarks: unknown[] };
}

function mockClient(opts: IMockOptions = {}) {
  const getPosts = vi.fn().mockImplementation(async () => {
    if (opts.getPostsFails) {
      throw new Error('AppView unavailable');
    }
    return {
      data: {
        posts: [{ uri: POST_URI, cid: POST_CID, viewer: { bookmarked: opts.bookmarked } }],
      },
    };
  });
  const createBookmark = vi.fn().mockResolvedValue({ success: true });
  const deleteBookmark = vi.fn().mockResolvedValue({ success: true });
  const getBookmarks = vi.fn().mockResolvedValue({
    data: opts.bookmarksPage ?? { bookmarks: [] },
  });

  const agent = {
    getPosts,
    app: { bsky: { bookmark: { createBookmark, deleteBookmark, getBookmarks } } },
    session: { did: 'did:plc:self' },
  };

  const client = {
    getAgent: vi.fn().mockReturnValue(agent),
    isAuthenticated: vi.fn().mockReturnValue(true),
    hasCredentials: vi.fn().mockReturnValue(true),
    executeAuthenticatedRequest: vi.fn().mockImplementation(async (op: () => unknown) => {
      try {
        return { success: true, data: await op() };
      } catch (error) {
        return { success: false, error };
      }
    }),
  } as unknown as AtpClient;

  return { client, getPosts, createBookmark, deleteBookmark, getBookmarks };
}

// Built per-test: the global test setup resets mock implementations after
// every test, so a module-level mock client would lose its return values.
function unauthClient(): AtpClient {
  return {
    isAuthenticated: vi.fn().mockReturnValue(false),
    hasCredentials: vi.fn().mockReturnValue(false),
  } as unknown as AtpClient;
}

describe('bookmark tools are PRIVATE (require authentication)', () => {
  it('add_bookmark is unavailable without authentication', () => {
    expect(new AddBookmarkTool(unauthClient()).isAvailable()).toBe(false);
  });

  it('remove_bookmark is unavailable without authentication', () => {
    expect(new RemoveBookmarkTool(unauthClient()).isAvailable()).toBe(false);
  });

  it('get_bookmarks is unavailable without authentication', () => {
    expect(new GetBookmarksTool(unauthClient()).isAvailable()).toBe(false);
  });
});

describe('add_bookmark', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a bookmark and resolves the cid from the post view when cid is omitted', async () => {
    const { client, createBookmark } = mockClient({ bookmarked: false });
    const tool = new AddBookmarkTool(client);

    const result = await tool.handler({ uri: POST_URI });

    expect(createBookmark).toHaveBeenCalledTimes(1);
    expect(createBookmark).toHaveBeenCalledWith({ uri: POST_URI, cid: POST_CID });
    expect(result.success).toBe(true);
    expect(result.alreadyBookmarked).toBe(false);
    expect(result.bookmarkedPost).toEqual({ uri: POST_URI, cid: POST_CID });
  });

  it('does not create a duplicate when the post is already bookmarked', async () => {
    const { client, createBookmark } = mockClient({ bookmarked: true });
    const tool = new AddBookmarkTool(client);

    const result = await tool.handler({ uri: POST_URI });

    expect(createBookmark).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.alreadyBookmarked).toBe(true);
    expect(result.bookmarkedPost.cid).toBe(POST_CID);
  });

  it('honors an explicitly provided cid', async () => {
    const { client, createBookmark } = mockClient({ bookmarked: false });
    const tool = new AddBookmarkTool(client);

    await tool.handler({ uri: POST_URI, cid: 'bafyexplicit' });

    expect(createBookmark).toHaveBeenCalledWith({ uri: POST_URI, cid: 'bafyexplicit' });
  });

  it('rejects URIs that are not app.bsky.feed.post records', async () => {
    const { client, createBookmark } = mockClient();
    const tool = new AddBookmarkTool(client);

    await expect(
      tool.handler({ uri: 'at://did:plc:author/app.bsky.feed.like/3k001' })
    ).rejects.toThrow(/app\.bsky\.feed\.post/);
    expect(createBookmark).not.toHaveBeenCalled();
  });

  it('fails when cid is omitted and the post view cannot be fetched', async () => {
    const { client, createBookmark } = mockClient({ getPostsFails: true });
    const tool = new AddBookmarkTool(client);

    await expect(tool.handler({ uri: POST_URI })).rejects.toThrow();
    expect(createBookmark).not.toHaveBeenCalled();
  });

  it('still creates the bookmark with an explicit cid when the pre-check fails', async () => {
    const { client, createBookmark } = mockClient({ getPostsFails: true });
    const tool = new AddBookmarkTool(client);

    const result = await tool.handler({ uri: POST_URI, cid: POST_CID });

    expect(createBookmark).toHaveBeenCalledWith({ uri: POST_URI, cid: POST_CID });
    expect(result.success).toBe(true);
    expect(result.alreadyBookmarked).toBe(false);
  });
});

describe('remove_bookmark', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes the bookmark when the post is bookmarked', async () => {
    const { client, deleteBookmark } = mockClient({ bookmarked: true });
    const tool = new RemoveBookmarkTool(client);

    const result = await tool.handler({ uri: POST_URI });

    expect(deleteBookmark).toHaveBeenCalledTimes(1);
    expect(deleteBookmark).toHaveBeenCalledWith({ uri: POST_URI });
    expect(result.success).toBe(true);
    expect(result.wasBookmarked).toBe(true);
    expect(result.removedBookmark).toEqual({ uri: POST_URI });
  });

  it('skips the delete call when the post is not bookmarked', async () => {
    const { client, deleteBookmark } = mockClient({ bookmarked: false });
    const tool = new RemoveBookmarkTool(client);

    const result = await tool.handler({ uri: POST_URI });

    expect(deleteBookmark).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.wasBookmarked).toBe(false);
  });

  it('still issues the delete when the prior state cannot be determined', async () => {
    // The AppView treats deleting a missing bookmark as a no-op, so when the
    // pre-check fails the delete must still go through rather than silently
    // skipping the user's request. wasBookmarked stays false (unconfirmed).
    const { client, deleteBookmark } = mockClient({ getPostsFails: true });
    const tool = new RemoveBookmarkTool(client);

    const result = await tool.handler({ uri: POST_URI });

    expect(deleteBookmark).toHaveBeenCalledWith({ uri: POST_URI });
    expect(result.success).toBe(true);
    expect(result.wasBookmarked).toBe(false);
  });

  it('rejects URIs that are not app.bsky.feed.post records', async () => {
    const { client, deleteBookmark } = mockClient();
    const tool = new RemoveBookmarkTool(client);

    await expect(
      tool.handler({ uri: 'at://did:plc:author/app.bsky.graph.list/3k001' })
    ).rejects.toThrow(/app\.bsky\.feed\.post/);
    expect(deleteBookmark).not.toHaveBeenCalled();
  });
});

describe('get_bookmarks', () => {
  beforeEach(() => vi.clearAllMocks());

  const postViewItem = {
    $type: 'app.bsky.feed.defs#postView',
    uri: POST_URI,
    cid: POST_CID,
    author: { did: 'did:plc:author', handle: 'author.test', displayName: 'Author' },
    record: { text: 'hello bookmarks', createdAt: '2026-01-01T00:00:00.000Z' },
    replyCount: 1,
    repostCount: 2,
    likeCount: 3,
    indexedAt: '2026-01-02T00:00:00.000Z',
    viewer: { bookmarked: true },
  };

  it('maps viewable bookmarks into the house post shape with pagination', async () => {
    const { client, getBookmarks } = mockClient({
      bookmarksPage: {
        cursor: 'next-page',
        bookmarks: [
          {
            subject: { uri: POST_URI, cid: POST_CID },
            createdAt: '2026-02-01T00:00:00.000Z',
            item: postViewItem,
          },
          {
            subject: { uri: 'at://did:plc:gone/app.bsky.feed.post/404', cid: 'bafygone' },
            createdAt: '2026-02-02T00:00:00.000Z',
            item: {
              $type: 'app.bsky.feed.defs#notFoundPost',
              uri: 'at://did:plc:gone/app.bsky.feed.post/404',
              notFound: true,
            },
          },
        ],
      },
    });
    const tool = new GetBookmarksTool(client);

    const result = await tool.handler({ limit: 2 });

    expect(getBookmarks).toHaveBeenCalledWith({ limit: 2, cursor: undefined });
    expect(result.success).toBe(true);
    expect(result.bookmarks).toHaveLength(2);

    const [viewable, unavailable] = result.bookmarks;
    expect(viewable.uri).toBe(POST_URI);
    expect(viewable.bookmarkedAt).toBe('2026-02-01T00:00:00.000Z');
    expect(viewable.post.uri).toBe(POST_URI);
    expect(viewable.post.author.handle).toBe('author.test');
    expect(viewable.post.record.text).toBe('hello bookmarks');
    expect(viewable.unavailableReason).toBeUndefined();

    expect(unavailable.post).toBeUndefined();
    expect(unavailable.unavailableReason).toBe('not_found');

    expect(result.cursor).toBe('next-page');
    expect(result.hasMore).toBe(true);
  });

  it('marks blocked posts as unavailable with reason "blocked"', async () => {
    const { client } = mockClient({
      bookmarksPage: {
        bookmarks: [
          {
            subject: { uri: POST_URI, cid: POST_CID },
            item: {
              $type: 'app.bsky.feed.defs#blockedPost',
              uri: POST_URI,
              blocked: true,
              author: { did: 'did:plc:author' },
            },
          },
        ],
      },
    });
    const tool = new GetBookmarksTool(client);

    const result = await tool.handler({});

    expect(result.bookmarks[0].unavailableReason).toBe('blocked');
    expect(result.bookmarks[0].post).toBeUndefined();
    expect(result.hasMore).toBe(false);
  });

  it('defaults the page size to 50', async () => {
    const { client, getBookmarks } = mockClient();
    const tool = new GetBookmarksTool(client);

    await tool.handler({});

    expect(getBookmarks).toHaveBeenCalledWith({ limit: 50, cursor: undefined });
  });
});
