/**
 * Tests for get_post_context, the single post-reader that folds in the former
 * get_thread (depth/parentHeight control over getPostThread) and
 * extract_media_from_post (includeMedia embed extraction).
 *
 * Regression coverage: it must report the TRUE thread root (the topmost
 * ancestor, not the grandparent) and a real depth (not always 0).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetPostContextTool } from '../tools/implementations/composite-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

function node(uri: string, parent?: unknown, extra: Record<string, unknown> = {}) {
  return {
    post: {
      uri,
      cid: `cid-${uri}`,
      author: { did: 'did:plc:a', handle: 'a.test' },
      record: { text: uri, createdAt: '2026-01-01T00:00:00.000Z' },
      likeCount: 0,
      repostCount: 0,
      replyCount: 0,
      ...extra,
    },
    ...(parent ? { parent } : {}),
  };
}

function mockClient(thread: unknown) {
  const getPostThread = vi.fn().mockResolvedValue({ data: { thread } });
  const getProfile = vi
    .fn()
    .mockResolvedValue({ data: { did: 'did:plc:a', handle: 'a.test', displayName: 'A' } });
  const agent = { getPostThread, getProfile, session: { did: 'did:plc:self' } };
  const wrap = async (op: () => unknown) => {
    try {
      return { success: true, data: await op() };
    } catch (error) {
      return { success: false, error };
    }
  };
  const client = {
    getAgent: vi.fn().mockReturnValue(agent),
    isAuthenticated: vi.fn().mockReturnValue(true),
    hasCredentials: vi.fn().mockReturnValue(true),
    executeAuthenticatedRequest: vi.fn().mockImplementation(wrap),
    executePublicRequest: vi.fn().mockImplementation(wrap),
  } as unknown as AtpClient;
  return { client, getPostThread };
}

describe('get_post_context thread root/depth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('walks the full parent chain for the true root and a real depth', async () => {
    // child -> parent -> grandparent -> root (depth 3); the true root is beyond
    // the grandparent, so the old "root = grandparent" shortcut is wrong.
    const root = node('at://root');
    const grandparent = node('at://grandparent', root);
    const parent = node('at://parent', grandparent);
    const child = node('at://child', parent);
    const { client } = mockClient(child);
    const tool = new GetPostContextTool(client);

    const result = await tool.handler({
      uri: 'at://child',
      includeThread: true,
      includeAuthorProfile: false,
      includeEngagement: false,
    });

    expect(result.thread.root.uri).toBe('at://root');
    expect(result.thread.depth).toBe(3);
  });
});

describe('get_post_context depth/parentHeight passthrough (former get_thread)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes the supplied depth and parentHeight through to getPostThread', async () => {
    const { client, getPostThread } = mockClient(node('at://post'));
    const tool = new GetPostContextTool(client);

    await tool.handler({
      uri: 'at://post',
      depth: 3,
      parentHeight: 10,
      includeAuthorProfile: false,
      includeEngagement: false,
    });

    expect(getPostThread).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'at://post', depth: 3, parentHeight: 10 })
    );
  });

  it('falls back to the former get_thread defaults (depth 6, parentHeight 80) when omitted', async () => {
    const { client, getPostThread } = mockClient(node('at://post'));
    const tool = new GetPostContextTool(client);

    await tool.handler({
      uri: 'at://post',
      includeAuthorProfile: false,
      includeEngagement: false,
    });

    expect(getPostThread).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'at://post', depth: 6, parentHeight: 80 })
    );
  });
});

describe('get_post_context media extraction (former extract_media_from_post)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('extracts images, videos, external links, and quote posts when includeMedia is true', async () => {
    const post = node('at://post', undefined, {
      embed: {
        $type: 'app.bsky.embed.images#view',
        images: [
          {
            fullsize: 'https://cdn.example.com/full.jpg',
            thumb: 'https://cdn.example.com/thumb.jpg',
            alt: 'a sunset',
            aspectRatio: { width: 1200, height: 800 },
          },
        ],
      },
    });
    const { client } = mockClient(post);
    const tool = new GetPostContextTool(client);

    const result = await tool.handler({
      uri: 'at://post',
      includeMedia: true,
      includeThread: false,
      includeAuthorProfile: false,
      includeEngagement: false,
    });

    expect(result.media).toBeDefined();
    expect(result.media.images).toHaveLength(1);
    expect(result.media.images[0]).toEqual(
      expect.objectContaining({
        uri: 'https://cdn.example.com/full.jpg',
        alt: 'a sunset',
        aspectRatio: { width: 1200, height: 800 },
      })
    );
    expect(result.media.videos).toHaveLength(0);
    expect(result.media.externalLinks).toHaveLength(0);
    expect(result.media.quotePosts).toHaveLength(0);
  });

  it('extracts an external link embed into media.externalLinks', async () => {
    const post = node('at://post', undefined, {
      embed: {
        $type: 'app.bsky.embed.external#view',
        external: {
          uri: 'https://news.example.com/story',
          title: 'Headline',
          description: 'A description',
          thumb: 'https://news.example.com/thumb.jpg',
        },
      },
    });
    const { client } = mockClient(post);
    const tool = new GetPostContextTool(client);

    const result = await tool.handler({
      uri: 'at://post',
      includeMedia: true,
      includeThread: false,
      includeAuthorProfile: false,
      includeEngagement: false,
    });

    expect(result.media.externalLinks).toHaveLength(1);
    expect(result.media.externalLinks[0]).toEqual(
      expect.objectContaining({
        uri: 'https://news.example.com/story',
        title: 'Headline',
        description: 'A description',
      })
    );
    expect(result.media.images).toHaveLength(0);
  });

  it('does NOT extract media by default (includeMedia omitted -> no media field)', async () => {
    const post = node('at://post', undefined, {
      embed: {
        $type: 'app.bsky.embed.images#view',
        images: [{ fullsize: 'https://cdn.example.com/full.jpg', alt: 'x' }],
      },
    });
    const { client } = mockClient(post);
    const tool = new GetPostContextTool(client);

    const result = await tool.handler({
      uri: 'at://post',
      includeThread: false,
      includeAuthorProfile: false,
      includeEngagement: false,
    });

    expect(result.media).toBeUndefined();
  });
});

describe('get_post_context existing thread/author/engagement flags still work', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns author profile and engagement alongside the post', async () => {
    const post = node('at://post', undefined, {
      likeCount: 5,
      repostCount: 2,
      replyCount: 1,
    });
    const { client } = mockClient(post);
    const tool = new GetPostContextTool(client);

    const result = await tool.handler({
      uri: 'at://post',
      includeThread: true,
      includeAuthorProfile: true,
      includeEngagement: true,
    });

    expect(result.success).toBe(true);
    expect(result.authorProfile).toBeDefined();
    expect(result.authorProfile.handle).toBe('a.test');
    expect(result.engagement).toBeDefined();
    expect(result.engagement.likeCount).toBe(5);
    expect(result.engagement.totalEngagement).toBe(8);
    expect(result.thread).toBeDefined();
  });
});
