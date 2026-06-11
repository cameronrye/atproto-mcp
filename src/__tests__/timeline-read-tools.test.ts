/**
 * Unit tests for the timeline read tools: get_timeline (timeline-tools.ts) and
 * get_custom_feed (advanced-social-tools.ts).
 *
 * These lock the on-the-wire contract: limit/cursor/algorithm parameters are
 * forwarded to the right agent method, the returned feed items are mapped to
 * the documented post shape, the response cursor (and hasMore) is propagated,
 * and agent/auth/validation failures surface as errors instead of fabricated
 * results. GetTimeline is PRIVATE; GetCustomFeed is ENHANCED.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetTimelineTool } from '../tools/implementations/timeline-tools.js';
import { GetCustomFeedTool } from '../tools/implementations/advanced-social-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

const wrap = async (op: () => unknown) => {
  try {
    return { success: true, data: await op() };
  } catch (error) {
    return { success: false, error };
  }
};

function makeClient(agent: any, opts: { authenticated?: boolean } = {}): AtpClient {
  return {
    getAgent: vi.fn().mockReturnValue(agent),
    isAuthenticated: vi.fn().mockReturnValue(opts.authenticated ?? true),
    hasCredentials: vi.fn().mockReturnValue(true),
    executeAuthenticatedRequest: vi.fn().mockImplementation(wrap),
    executePublicRequest: vi.fn().mockImplementation(wrap),
  } as unknown as AtpClient;
}

const samplePostView = (n: number, extras: Record<string, unknown> = {}) => ({
  uri: `at://did:plc:author/app.bsky.feed.post/p${n}`,
  cid: `cid${n}`,
  author: {
    did: 'did:plc:author',
    handle: 'author.bsky.social',
    displayName: 'Author',
    description: 'bio',
    avatar: 'https://cdn.example/avatar.jpg',
    followersCount: 10,
    followsCount: 20,
    postsCount: 30,
  },
  record: { text: `post ${n}`, createdAt: '2026-01-01T00:00:00.000Z' },
  replyCount: n,
  repostCount: n + 1,
  likeCount: n + 2,
  indexedAt: '2026-01-02T00:00:00.000Z',
  ...extras,
});

describe('GetTimelineTool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards algorithm/limit/cursor to agent.getTimeline, maps posts, and propagates the cursor', async () => {
    const getTimeline = vi.fn().mockResolvedValue({
      data: { feed: [{ post: samplePostView(1) }, { post: samplePostView(2) }], cursor: 'next' },
    });
    const tool = new GetTimelineTool(makeClient({ getTimeline }));

    const result = await tool.handler({
      algorithm: 'reverse-chronological',
      limit: 25,
      cursor: 'page2',
    });

    expect(getTimeline).toHaveBeenCalledWith({
      limit: 25,
      cursor: 'page2',
      algorithm: 'reverse-chronological',
    });

    expect(result.success).toBe(true);
    expect(result.cursor).toBe('next');
    expect(result.hasMore).toBe(true);
    expect(result.algorithm).toBe('reverse-chronological');
    expect(result.posts).toHaveLength(2);
    expect(result.posts[0]).toMatchObject({
      uri: 'at://did:plc:author/app.bsky.feed.post/p1',
      cid: 'cid1',
      author: { did: 'did:plc:author', handle: 'author.bsky.social' },
      record: { text: 'post 1', createdAt: '2026-01-01T00:00:00.000Z' },
      replyCount: 1,
      repostCount: 2,
      likeCount: 3,
      indexedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it('applies the default limit of 50, omits cursor/algorithm keys, and reports hasMore=false without a cursor', async () => {
    const getTimeline = vi.fn().mockResolvedValue({
      data: { feed: [], cursor: undefined },
    });
    const tool = new GetTimelineTool(makeClient({ getTimeline }));

    const result = await tool.handler({});

    // Unset optional params are NOT passed through as undefined keys.
    expect(getTimeline).toHaveBeenCalledWith({ limit: 50 });
    expect(result.posts).toEqual([]);
    expect(result.cursor).toBeUndefined();
    expect(result.hasMore).toBe(false);
  });

  it('rejects an out-of-range limit via zod before calling the agent', async () => {
    const getTimeline = vi.fn();
    const tool = new GetTimelineTool(makeClient({ getTimeline }));

    await expect(tool.handler({ limit: 500 })).rejects.toThrow(/Invalid parameters/);
    expect(getTimeline).not.toHaveBeenCalled();
  });

  it('surfaces agent failures as a thrown error (no fabricated success)', async () => {
    const getTimeline = vi.fn().mockRejectedValue(new Error('Timeline service down'));
    const tool = new GetTimelineTool(makeClient({ getTimeline }));

    await expect(tool.handler({})).rejects.toThrow('Timeline service down');
  });

  it('requires authentication (PRIVATE tool): unauthenticated calls never reach the agent', async () => {
    const getTimeline = vi.fn();
    const tool = new GetTimelineTool(makeClient({ getTimeline }, { authenticated: false }));

    await expect(tool.handler({})).rejects.toThrow(/requires authentication/i);
    expect(getTimeline).not.toHaveBeenCalled();
  });
});

describe('GetCustomFeedTool', () => {
  beforeEach(() => vi.clearAllMocks());

  const FEED_URI = 'at://did:plc:feedgen/app.bsky.feed.generator/whats-hot';

  const makeAgent = (getFeed: any, getFeedGenerator: any) => ({
    app: { bsky: { feed: { getFeed, getFeedGenerator } } },
  });

  it('forwards feedUri/limit/cursor to getFeed, maps posts with viewer state, and merges generator metadata', async () => {
    const getFeed = vi.fn().mockResolvedValue({
      data: {
        feed: [{ post: samplePostView(1, { viewer: { like: 'at://like', repost: undefined } }) }],
        cursor: 'feedNext',
      },
    });
    const getFeedGenerator = vi.fn().mockResolvedValue({
      data: {
        view: {
          displayName: "What's Hot",
          description: 'Trending posts',
          creator: { did: 'did:plc:feedgen', handle: 'feedgen.bsky.social' },
        },
      },
    });
    const tool = new GetCustomFeedTool(makeClient(makeAgent(getFeed, getFeedGenerator)));

    const result = await tool.handler({ feedUri: FEED_URI, limit: 10, cursor: 'page3' });

    expect(getFeed).toHaveBeenCalledWith({ feed: FEED_URI, limit: 10, cursor: 'page3' });
    expect(getFeedGenerator).toHaveBeenCalledWith({ feed: FEED_URI });

    expect(result.success).toBe(true);
    expect(result.cursor).toBe('feedNext');
    expect(result.feed).toEqual({
      uri: FEED_URI,
      displayName: "What's Hot",
      description: 'Trending posts',
      creator: { did: 'did:plc:feedgen', handle: 'feedgen.bsky.social' },
    });
    expect(result.posts).toEqual([
      {
        uri: 'at://did:plc:author/app.bsky.feed.post/p1',
        cid: 'cid1',
        author: {
          did: 'did:plc:author',
          handle: 'author.bsky.social',
          displayName: 'Author',
          avatar: 'https://cdn.example/avatar.jpg',
        },
        text: 'post 1',
        createdAt: '2026-01-01T00:00:00.000Z',
        replyCount: 1,
        repostCount: 2,
        likeCount: 3,
        isLiked: true,
        isReposted: false,
      },
    ]);
  });

  it('applies the default limit of 50 and zeroes missing engagement counts', async () => {
    const bare = samplePostView(7);
    delete (bare as any).replyCount;
    delete (bare as any).repostCount;
    delete (bare as any).likeCount;
    const getFeed = vi.fn().mockResolvedValue({
      data: { feed: [{ post: bare }], cursor: undefined },
    });
    const getFeedGenerator = vi.fn().mockResolvedValue({ data: { view: undefined } });
    const tool = new GetCustomFeedTool(makeClient(makeAgent(getFeed, getFeedGenerator)));

    const result = await tool.handler({ feedUri: FEED_URI });

    expect(getFeed).toHaveBeenCalledWith({ feed: FEED_URI, limit: 50, cursor: undefined });
    expect(result.cursor).toBeUndefined();
    expect(result.posts[0]).toMatchObject({
      replyCount: 0,
      repostCount: 0,
      likeCount: 0,
      isLiked: false,
      isReposted: false,
    });
  });

  it('still succeeds with a bare feed.uri when generator metadata cannot be fetched', async () => {
    const getFeed = vi.fn().mockResolvedValue({
      data: { feed: [{ post: samplePostView(1) }], cursor: 'c' },
    });
    const getFeedGenerator = vi.fn().mockRejectedValue(new Error('generator offline'));
    const tool = new GetCustomFeedTool(makeClient(makeAgent(getFeed, getFeedGenerator)));

    const result = await tool.handler({ feedUri: FEED_URI });

    expect(result.success).toBe(true);
    // Metadata is best-effort: no fabricated displayName/description/creator keys.
    expect(result.feed).toEqual({ uri: FEED_URI });
    expect(result.posts).toHaveLength(1);
  });

  it('rejects a non-at:// feed URI before calling the agent', async () => {
    const getFeed = vi.fn();
    const tool = new GetCustomFeedTool(makeClient(makeAgent(getFeed, vi.fn())));

    await expect(tool.handler({ feedUri: 'https://bsky.app/feeds/hot' })).rejects.toThrow(
      /AT Protocol URI/
    );
    expect(getFeed).not.toHaveBeenCalled();
  });

  it('surfaces getFeed failures as a thrown error', async () => {
    const getFeed = vi.fn().mockRejectedValue(new Error('feed unavailable'));
    const tool = new GetCustomFeedTool(makeClient(makeAgent(getFeed, vi.fn())));

    await expect(tool.handler({ feedUri: FEED_URI })).rejects.toThrow('feed unavailable');
  });

  it('works unauthenticated via executePublicRequest (ENHANCED mode)', async () => {
    const getFeed = vi.fn().mockResolvedValue({
      data: { feed: [], cursor: undefined },
    });
    const getFeedGenerator = vi.fn().mockResolvedValue({ data: { view: undefined } });
    const client = makeClient(makeAgent(getFeed, getFeedGenerator), { authenticated: false });
    const tool = new GetCustomFeedTool(client);

    const result = await tool.handler({ feedUri: FEED_URI });

    expect(client.executePublicRequest).toHaveBeenCalled();
    expect(client.executeAuthenticatedRequest).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});
