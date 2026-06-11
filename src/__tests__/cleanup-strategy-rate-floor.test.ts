/**
 * Regression test for analyze_account dimension:'strategy' engagement-rate
 * flooring. The engagement dimension already floors each post's age at 24h so
 * a minutes-old post (tiny denominator) cannot dominate rate-based rankings;
 * the strategy dimension must apply the same floor to its postsWithEngagement
 * engagementRate, which feeds avgEngagementRate and the bestPostingTimes
 * ranking.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyzeAccountTool } from '../tools/implementations/analyze-account-tool.js';
import type { AtpClient } from '../utils/atp-client.js';

const SELF = 'did:plc:self';
const NOW = '2026-06-01T12:00:00.000Z';
// Sub-hour post (30 minutes old) with modest counts: raw per-hour rate 6/0.5 = 12.
const FRESH_ISO = '2026-06-01T11:30:00.000Z';
// 732h-old post with 732 likes: true rate exactly 1/h regardless of flooring.
const OLD_ISO = '2026-05-02T00:00:00.000Z';

function mockClient(feed: unknown[]): AtpClient {
  const agent = {
    getAuthorFeed: vi.fn().mockResolvedValue({ data: { feed } }),
    session: { did: SELF },
  };
  return {
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
}

// The strategy dimension reads the post timestamp from indexedAt.
function item(rkey: string, indexedAt: string, likeCount: number) {
  return {
    post: {
      uri: `at://${SELF}/app.bsky.feed.post/${rkey}`,
      cid: `cid-${rkey}`,
      record: { text: `post ${rkey}` },
      indexedAt,
      likeCount,
      repostCount: 0,
      replyCount: 0,
    },
  };
}

// Mirrors the tool's bestPostingTimes label formatting for a local-time hour.
function hourLabel(iso: string): string {
  const hour = new Date(iso).getHours();
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:00 ${period}`;
}

describe("analyze_account dimension:'strategy' engagement-rate age floor", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('floors the rate denominator at 24h so a sub-hour post cannot dominate', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));

    const tool = new AnalyzeAccountTool(
      mockClient([item('fresh', FRESH_ISO, 6), item('old', OLD_ISO, 732)])
    );

    const result = await tool.handler({ dimension: 'strategy', actor: SELF });

    // Floored: fresh = 6/24 = 0.25, old = 732/732 = 1 -> avg 0.625 -> 0.63.
    // Unfloored the fresh post's raw rate (12/h) would push the avg to 6.5.
    expect(result.analysis.avgEngagementRate).toBeCloseTo(0.63, 2);

    // The established post's hour must win the rate-ranked bestPostingTimes;
    // without the floor the sub-hour post's inflated rate dominates.
    expect(result.recommendations.bestPostingTimes?.[0]).toBe(hourLabel(OLD_ISO));
  });
});
