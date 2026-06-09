/**
 * Behavioral tests for analyze_engagement (previously ~3% covered):
 * - media detection must recognize video / recordWithMedia embeds (not just images)
 * - an empty author feed must not emit Infinity/-Infinity for optimalTextLength
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyzeEngagementTool } from '../tools/implementations/analyze-engagement-tool.js';
import type { AtpClient } from '../utils/atp-client.js';

const SELF = 'did:plc:self';

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

function postItem(embed: unknown, extra: Record<string, unknown> = {}) {
  return {
    post: {
      uri: `at://${SELF}/app.bsky.feed.post/1`,
      cid: 'cid1',
      record: { text: 'hello world', createdAt: '2026-01-01T00:00:00.000Z' },
      likeCount: 10,
      repostCount: 2,
      replyCount: 1,
      embed,
      ...extra,
    },
  };
}

describe('analyze_engagement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects a video embed as media', async () => {
    const { client } = mockClient([
      postItem({ $type: 'app.bsky.embed.video#view', cid: 'v', playlist: 'p.m3u8' }),
    ]);
    const tool = new AnalyzeEngagementTool(client);

    const result = await tool.handler({});

    expect(result.topPosts[0]?.hasMedia).toBe(true);
  });

  it('detects recordWithMedia (quote + image) as media', async () => {
    const { client } = mockClient([
      postItem({
        $type: 'app.bsky.embed.recordWithMedia#view',
        record: {},
        media: { $type: 'app.bsky.embed.images#view', images: [{}] },
      }),
    ]);
    const tool = new AnalyzeEngagementTool(client);

    const result = await tool.handler({});

    expect(result.topPosts[0]?.hasMedia).toBe(true);
  });

  it('returns finite optimalTextLength for an empty feed (no Infinity)', async () => {
    const { client } = mockClient([]);
    const tool = new AnalyzeEngagementTool(client);

    const result = await tool.handler({});

    expect(result.success).toBe(true);
    expect(result.summary.totalPosts).toBe(0);
    expect(Number.isFinite(result.insights.optimalTextLength.min)).toBe(true);
    expect(Number.isFinite(result.insights.optimalTextLength.max)).toBe(true);
  });
});
