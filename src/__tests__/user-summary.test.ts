/**
 * Unit tests for the get_user_summary composite tool (composite-tools.ts).
 *
 * These lock the composed-call contract: getProfile is always fetched,
 * getAuthorFeed is fetched only when recent posts or engagement stats are
 * requested (with postLimit and the posts_no_replies filter forwarded), the
 * engagement statistics are computed over the fetched page, and a failure in
 * either sub-call fails the WHOLE call (the current contract has no partial
 * results). ENHANCED tool: works unauthenticated via executePublicRequest.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetUserSummaryTool } from '../tools/implementations/composite-tools.js';
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

const ACTOR = 'target.bsky.social';

const sampleProfile = () => ({
  did: 'did:plc:target',
  handle: ACTOR,
  displayName: 'Target User',
  avatar: 'https://cdn.example/avatar.jpg',
  description: 'bio',
  followersCount: 100,
  followsCount: 50,
  postsCount: 200,
  indexedAt: '2026-01-01T00:00:00.000Z',
  viewer: { muted: false, following: 'at://follow' },
});

const feedPost = (rkey: string, counts: { likes: number; reposts: number; replies: number }) => ({
  post: {
    uri: `at://did:plc:target/app.bsky.feed.post/${rkey}`,
    cid: `cid-${rkey}`,
    author: {
      did: 'did:plc:target',
      handle: ACTOR,
      displayName: 'Target User',
      avatar: 'https://cdn.example/avatar.jpg',
      description: 'bio',
      followersCount: 100,
      followsCount: 50,
      postsCount: 200,
    },
    record: { text: `post ${rkey}`, createdAt: '2026-02-01T00:00:00.000Z' },
    replyCount: counts.replies,
    repostCount: counts.reposts,
    likeCount: counts.likes,
    indexedAt: '2026-02-01T01:00:00.000Z',
  },
});

describe('GetUserSummaryTool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('composes getProfile + getAuthorFeed (posts_no_replies, default postLimit 10) into one summary', async () => {
    const getProfile = vi.fn().mockResolvedValue({ data: sampleProfile() });
    const getAuthorFeed = vi.fn().mockResolvedValue({
      data: {
        feed: [
          feedPost('a', { likes: 10, reposts: 1, replies: 0 }),
          feedPost('b', { likes: 30, reposts: 2, replies: 0 }),
          feedPost('c', { likes: 20, reposts: 3, replies: 3 }),
        ],
      },
    });
    const tool = new GetUserSummaryTool(makeClient({ getProfile, getAuthorFeed }));

    const result = await tool.handler({ actor: ACTOR });

    expect(getProfile).toHaveBeenCalledWith({ actor: ACTOR });
    expect(getAuthorFeed).toHaveBeenCalledWith({
      actor: ACTOR,
      limit: 10,
      filter: 'posts_no_replies',
    });

    expect(result.success).toBe(true);
    // Profile is passed through, including viewer context.
    expect(result.profile).toMatchObject({
      did: 'did:plc:target',
      handle: ACTOR,
      followersCount: 100,
      viewer: { muted: false, following: 'at://follow' },
    });
    expect(result.recentPosts).toHaveLength(3);
    expect(result.recentPosts[0]).toMatchObject({
      uri: 'at://did:plc:target/app.bsky.feed.post/a',
      cid: 'cid-a',
      record: { text: 'post a' },
      likeCount: 10,
    });
    expect(result.summary).toEqual({
      handle: ACTOR,
      displayName: 'Target User',
      followersCount: 100,
      followsCount: 50,
      postsCount: 200,
      isAuthenticated: true,
    });
  });

  it('computes engagement statistics (totals, averages, most-liked / most-reposted) over the fetched page', async () => {
    const getProfile = vi.fn().mockResolvedValue({ data: sampleProfile() });
    const getAuthorFeed = vi.fn().mockResolvedValue({
      data: {
        feed: [
          feedPost('a', { likes: 10, reposts: 1, replies: 0 }),
          feedPost('b', { likes: 30, reposts: 2, replies: 0 }),
          feedPost('c', { likes: 20, reposts: 3, replies: 3 }),
        ],
      },
    });
    const tool = new GetUserSummaryTool(makeClient({ getProfile, getAuthorFeed }));

    const result = await tool.handler({ actor: ACTOR, postLimit: 3 });

    expect(getAuthorFeed.mock.calls[0]![0].limit).toBe(3);
    expect(result.engagementStats).toMatchObject({
      totalPosts: 3,
      totalLikes: 60,
      totalReposts: 6,
      totalReplies: 3,
      averageLikesPerPost: 20,
      averageRepostsPerPost: 2,
      averageRepliesPerPost: 1,
    });
    expect(result.engagementStats.mostLikedPost.uri).toBe(
      'at://did:plc:target/app.bsky.feed.post/b'
    );
    expect(result.engagementStats.mostRepostedPost.uri).toBe(
      'at://did:plc:target/app.bsky.feed.post/c'
    );
  });

  it('skips the author-feed call entirely when neither posts nor stats are requested', async () => {
    const getProfile = vi.fn().mockResolvedValue({ data: sampleProfile() });
    const getAuthorFeed = vi.fn();
    const tool = new GetUserSummaryTool(makeClient({ getProfile, getAuthorFeed }));

    const result = await tool.handler({
      actor: ACTOR,
      includeRecentPosts: false,
      includeEngagementStats: false,
    });

    expect(getAuthorFeed).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result).not.toHaveProperty('recentPosts');
    expect(result).not.toHaveProperty('engagementStats');
    expect(result.summary.handle).toBe(ACTOR);
  });

  it('fetches the feed for stats only (no recentPosts in the output) when includeRecentPosts=false', async () => {
    const getProfile = vi.fn().mockResolvedValue({ data: sampleProfile() });
    const getAuthorFeed = vi.fn().mockResolvedValue({
      data: { feed: [feedPost('a', { likes: 4, reposts: 0, replies: 0 })] },
    });
    const tool = new GetUserSummaryTool(makeClient({ getProfile, getAuthorFeed }));

    const result = await tool.handler({
      actor: ACTOR,
      includeRecentPosts: false,
      includeEngagementStats: true,
    });

    expect(getAuthorFeed).toHaveBeenCalledTimes(1);
    expect(result).not.toHaveProperty('recentPosts');
    expect(result.engagementStats).toMatchObject({ totalPosts: 1, totalLikes: 4 });
  });

  it('omits engagementStats when the user has no posts, even though stats were requested', async () => {
    const getProfile = vi.fn().mockResolvedValue({ data: sampleProfile() });
    const getAuthorFeed = vi.fn().mockResolvedValue({ data: { feed: [] } });
    const tool = new GetUserSummaryTool(makeClient({ getProfile, getAuthorFeed }));

    const result = await tool.handler({ actor: ACTOR, includeEngagementStats: true });

    expect(result.success).toBe(true);
    expect(result.recentPosts).toEqual([]);
    expect(result).not.toHaveProperty('engagementStats');
  });

  it('fails the WHOLE call when the author-feed sub-call fails (current contract: no partial result)', async () => {
    const getProfile = vi.fn().mockResolvedValue({ data: sampleProfile() });
    const getAuthorFeed = vi.fn().mockRejectedValue(new Error('author feed unavailable'));
    const tool = new GetUserSummaryTool(makeClient({ getProfile, getAuthorFeed }));

    await expect(tool.handler({ actor: ACTOR })).rejects.toThrow('author feed unavailable');
    // The profile sub-call had already happened; its result is discarded.
    expect(getProfile).toHaveBeenCalledTimes(1);
  });

  it('fails before the feed call when the profile sub-call fails', async () => {
    const getProfile = vi.fn().mockRejectedValue(new Error('profile not found'));
    const getAuthorFeed = vi.fn();
    const tool = new GetUserSummaryTool(makeClient({ getProfile, getAuthorFeed }));

    await expect(tool.handler({ actor: ACTOR })).rejects.toThrow('profile not found');
    expect(getAuthorFeed).not.toHaveBeenCalled();
  });

  it('works unauthenticated via executePublicRequest and reports isAuthenticated=false (ENHANCED mode)', async () => {
    const getProfile = vi.fn().mockResolvedValue({ data: sampleProfile() });
    const getAuthorFeed = vi.fn().mockResolvedValue({ data: { feed: [] } });
    const client = makeClient({ getProfile, getAuthorFeed }, { authenticated: false });
    const tool = new GetUserSummaryTool(client);

    const result = await tool.handler({ actor: ACTOR });

    expect(client.executePublicRequest).toHaveBeenCalled();
    expect(client.executeAuthenticatedRequest).not.toHaveBeenCalled();
    expect(result.summary.isAuthenticated).toBe(false);
  });

  it('rejects an invalid actor identifier before any sub-call', async () => {
    const getProfile = vi.fn();
    const tool = new GetUserSummaryTool(makeClient({ getProfile }));

    await expect(tool.handler({ actor: 'not a handle' })).rejects.toThrow(/valid DID/);
    expect(getProfile).not.toHaveBeenCalled();
  });
});
