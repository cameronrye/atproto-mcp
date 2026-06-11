/**
 * discover (mode='trending') `limit` semantics: `limit` must govern how many
 * items are RETURNED per category (capped at 25), while the timeline sample
 * analyzed is a fixed 100 posts. Previously `limit` was passed as the timeline
 * sample size and every category was hard-capped at 10.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoverTool } from '../tools/implementations/discover-tool.js';
import type { AtpClient } from '../utils/atp-client.js';

function feedOf(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    post: {
      uri: `at://post-${i}`,
      cid: `cid-${i}`,
      author: { did: `did:plc:a${i}`, handle: `a${i}.test` },
      record: { text: `post number ${i} #tag${i}`, createdAt: new Date().toISOString() },
      likeCount: count - i,
      replyCount: 0,
      repostCount: 0,
      indexedAt: new Date().toISOString(),
    },
  }));
}

function mockClient(feedCount: number) {
  const getTimeline = vi.fn().mockResolvedValue({ data: { feed: feedOf(feedCount) } });
  const agent = { session: { did: 'did:plc:self' }, getTimeline };

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

  return { client, getTimeline };
}

describe('discover trending limit semantics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns `limit` items per category while sampling a fixed 100 timeline posts', async () => {
    const { client, getTimeline } = mockClient(30);
    const tool = new DiscoverTool(client);

    const result = await tool.handler({ mode: 'trending', limit: 12 });

    expect(getTimeline).toHaveBeenCalledWith({ limit: 100 });
    expect(result.trendingPosts).toHaveLength(12);
    expect(result.trendingHashtags).toHaveLength(12);
  });

  it('caps the per-category result count at 25', async () => {
    const { client } = mockClient(30);
    const tool = new DiscoverTool(client);

    const result = await tool.handler({ mode: 'trending', limit: 40 });

    expect(result.trendingPosts).toHaveLength(25);
    expect(result.trendingHashtags).toHaveLength(25);
  });

  it('defaults to 10 items per category when limit is omitted', async () => {
    const { client, getTimeline } = mockClient(30);
    const tool = new DiscoverTool(client);

    const result = await tool.handler({ mode: 'trending' });

    expect(getTimeline).toHaveBeenCalledWith({ limit: 100 });
    expect(result.trendingPosts).toHaveLength(10);
    expect(result.trendingHashtags).toHaveLength(10);
  });
});
