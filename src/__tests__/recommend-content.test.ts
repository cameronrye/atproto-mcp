/**
 * Regression test: recommend_content's `excludeReposts` flag must actually
 * exclude reposts. The repost indicator lives on the feed item's `reason`
 * (app.bsky.feed.defs#reasonRepost), not on the post record, so the previous
 * `record.repost` check was a silent no-op.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecommendContentTool } from '../tools/implementations/content-discovery-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

function feedItem(uri: string, opts: { repost?: boolean } = {}) {
  const post = {
    uri,
    cid: `cid-${uri}`,
    author: { did: 'did:plc:author', handle: 'author.test', displayName: 'Author' },
    record: { text: 'hello world', createdAt: new Date().toISOString() },
    likeCount: 10,
    replyCount: 0,
    repostCount: 0,
    indexedAt: new Date().toISOString(),
    viewer: {},
  };
  return opts.repost ? { post, reason: { $type: 'app.bsky.feed.defs#reasonRepost' } } : { post };
}

function mockClient() {
  const getTimeline = vi.fn().mockResolvedValue({
    data: { feed: [feedItem('at://normal'), feedItem('at://repost', { repost: true })] },
  });
  const getProfile = vi.fn().mockResolvedValue({ data: { did: 'did:plc:self', handle: 'self' } });
  const agent = { session: { did: 'did:plc:self' }, getTimeline, getProfile };

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

  return { client };
}

describe('recommend_content excludeReposts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('excludes reposted feed items when excludeReposts is true', async () => {
    const { client } = mockClient();
    const tool = new RecommendContentTool(client);

    const result = await tool.handler({ excludeReposts: true });
    const uris = result.recommendations.map((r: { uri: string }) => r.uri);

    expect(uris).toContain('at://normal');
    expect(uris).not.toContain('at://repost');
  });

  it('includes reposted feed items when excludeReposts is false', async () => {
    const { client } = mockClient();
    const tool = new RecommendContentTool(client);

    const result = await tool.handler({ excludeReposts: false });
    const uris = result.recommendations.map((r: { uri: string }) => r.uri);

    expect(uris).toContain('at://normal');
    expect(uris).toContain('at://repost');
  });
});
