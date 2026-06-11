/**
 * Regression tests for analyze_account: getAuthorFeed includes the actor's
 * reposts, where the feed item's `post` is the ORIGINAL post by a different
 * author (flagged via `reason.$type === 'app.bsky.feed.defs#reasonRepost'`).
 * Those posts carry the original author's engagement counts, so both the
 * engagement and strategy dimensions must exclude them before aggregating —
 * otherwise totals/averages/topPosts are attributed to the wrong account.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyzeAccountTool } from '../tools/implementations/analyze-account-tool.js';
import type { AtpClient } from '../utils/atp-client.js';

const SELF = 'did:plc:self';
const OTHER = 'did:plc:someone-else';

function mockClient(feed: unknown[]) {
  const getAuthorFeed = vi.fn().mockResolvedValue({ data: { feed } });
  const agent = { getAuthorFeed, session: { did: SELF } };
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
  return { client, getAuthorFeed };
}

function ownPost(rkey: string, likeCount: number) {
  return {
    post: {
      uri: `at://${SELF}/app.bsky.feed.post/${rkey}`,
      cid: `cid-${rkey}`,
      author: { did: SELF },
      record: { text: `own post ${rkey}`, createdAt: '2026-01-01T00:00:00.000Z' },
      indexedAt: '2026-01-01T00:00:00.000Z',
      likeCount,
      repostCount: 1,
      replyCount: 1,
    },
  };
}

// A repost feed item: `post` is someone else's viral original.
function repostedItem() {
  return {
    post: {
      uri: `at://${OTHER}/app.bsky.feed.post/viral`,
      cid: 'cid-viral',
      author: { did: OTHER },
      record: { text: 'viral post by someone else', createdAt: '2026-01-01T00:00:00.000Z' },
      indexedAt: '2026-01-01T00:00:00.000Z',
      likeCount: 90000,
      repostCount: 5000,
      replyCount: 3000,
    },
    reason: { $type: 'app.bsky.feed.defs#reasonRepost', by: { did: SELF } },
  };
}

describe('analyze_account repost exclusion', () => {
  beforeEach(() => vi.clearAllMocks());

  it("engagement: excludes other authors' reposted posts from totals and topPosts", async () => {
    const { client } = mockClient([ownPost('1', 10), repostedItem(), ownPost('2', 20)]);
    const tool = new AnalyzeAccountTool(client);

    const result = await tool.handler({ dimension: 'engagement' });

    expect(result.success).toBe(true);
    expect(result.summary.totalPosts).toBe(2);
    expect(result.summary.totalLikes).toBe(30);
    expect(result.summary.totalReposts).toBe(2);
    expect(result.summary.totalReplies).toBe(2);
    expect(result.summary.averageLikes).toBe(15);
    const topUris = result.topPosts.map((p: { uri: string }) => p.uri);
    expect(topUris).not.toContain(`at://${OTHER}/app.bsky.feed.post/viral`);
    expect(result.topPosts[0]?.uri).toBe(`at://${SELF}/app.bsky.feed.post/2`);
  });

  it("strategy: excludes other authors' reposted posts from best/worst performing posts", async () => {
    const { client } = mockClient([ownPost('1', 10), repostedItem(), ownPost('2', 20)]);
    const tool = new AnalyzeAccountTool(client);

    const result = await tool.handler({ dimension: 'strategy', actor: SELF });

    expect(result.success).toBe(true);
    expect(result.analysis.totalPostsAnalyzed).toBe(2);
    const bestUris = result.analysis.bestPerformingPosts.map((p: { uri: string }) => p.uri);
    const worstUris = result.analysis.worstPerformingPosts.map((p: { uri: string }) => p.uri);
    expect(bestUris).not.toContain(`at://${OTHER}/app.bsky.feed.post/viral`);
    expect(worstUris).not.toContain(`at://${OTHER}/app.bsky.feed.post/viral`);
    expect(result.analysis.bestPerformingPosts[0]?.uri).toBe(`at://${SELF}/app.bsky.feed.post/2`);
  });
});
