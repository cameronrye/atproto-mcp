/**
 * discover (mode='recommended') `actor` param: when a different account is
 * given, interest seeding (likedTopics/likedAuthors) must come from THAT
 * actor's recent author feed (getAuthorFeed) instead of the session user's
 * timeline engagement. The old awaited-and-discarded getProfile call must be
 * gone in both paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscoverTool } from '../tools/implementations/discover-tool.js';
import type { AtpClient } from '../utils/atp-client.js';

const ALICE = 'did:plc:alice';
const BOB = 'did:plc:bob';

function timelinePost(uri: string, authorDid: string, text: string, liked = false) {
  return {
    post: {
      uri,
      cid: `cid-${uri}`,
      author: { did: authorDid, handle: `${authorDid.split(':').pop()}.test` },
      record: { text, createdAt: new Date().toISOString() },
      likeCount: 10,
      replyCount: 0,
      repostCount: 0,
      indexedAt: new Date().toISOString(),
      viewer: liked ? { like: 'at://like' } : {},
    },
  };
}

function mockClient() {
  const getTimeline = vi.fn().mockResolvedValue({
    data: {
      feed: [
        timelinePost('at://space-post', ALICE, 'exploring #space photos'),
        timelinePost('at://plain-post', BOB, 'just had lunch'),
      ],
    },
  });
  // The seed actor's author feed: a post authored by ALICE about #space.
  const getAuthorFeed = vi.fn().mockResolvedValue({
    data: {
      feed: [
        {
          post: {
            uri: 'at://seed-post',
            author: { did: ALICE, handle: 'alice.test' },
            record: { text: 'cool #space stuff', createdAt: new Date().toISOString() },
          },
        },
      ],
    },
  });
  const getProfile = vi.fn().mockResolvedValue({ data: { did: 'did:plc:self', handle: 'self' } });
  const agent = {
    session: { did: 'did:plc:self', handle: 'self.test' },
    getTimeline,
    getAuthorFeed,
    getProfile,
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

  return { client, getTimeline, getAuthorFeed, getProfile };
}

describe('discover recommended actor seeding', () => {
  beforeEach(() => vi.clearAllMocks());

  it('seeds interests from the given actor author feed, not the session timeline', async () => {
    const { client, getAuthorFeed, getProfile } = mockClient();
    const tool = new DiscoverTool(client);

    const result = await tool.handler({ mode: 'recommended', actor: 'other.test' });

    expect(getAuthorFeed).toHaveBeenCalledWith(expect.objectContaining({ actor: 'other.test' }));
    // The dead getProfile round-trip must be gone.
    expect(getProfile).not.toHaveBeenCalled();

    const spacePost = result.recommendations.find(
      (r: { uri: string }) => r.uri === 'at://space-post'
    );
    expect(spacePost).toBeDefined();
    // ALICE and #space were seeded from the actor's feed, so the timeline post
    // by ALICE about #space must carry both preference-derived reasons.
    expect(spacePost.recommendationReasons).toContain('From an author you frequently engage with');
    expect(spacePost.recommendationReasons).toContain('Matches 1 of your interests');

    const plainPost = result.recommendations.find(
      (r: { uri: string }) => r.uri === 'at://plain-post'
    );
    expect(plainPost.recommendationReasons).not.toContain(
      'From an author you frequently engage with'
    );
    expect(spacePost.recommendationScore).toBeGreaterThan(plainPost.recommendationScore);
  });

  it('keeps the default behavior (no actor): timeline inference, no author feed call', async () => {
    const { client, getAuthorFeed, getProfile } = mockClient();
    const tool = new DiscoverTool(client);

    const result = await tool.handler({ mode: 'recommended' });

    expect(result.success).toBe(true);
    expect(getAuthorFeed).not.toHaveBeenCalled();
    expect(getProfile).not.toHaveBeenCalled();
  });

  it('treats actor equal to the session user as the default path', async () => {
    const { client, getAuthorFeed } = mockClient();
    const tool = new DiscoverTool(client);

    await tool.handler({ mode: 'recommended', actor: 'did:plc:self' });

    expect(getAuthorFeed).not.toHaveBeenCalled();
  });
});
