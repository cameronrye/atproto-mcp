/**
 * Regression test: the single repost tool must be idempotent, matching the
 * duplicate-action protection that like/follow/batch-repost already have. An LLM
 * that retries on timeout should not create a second repost record. The
 * authoritative signal is viewer.repost from getPosts.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepostTool } from '../tools/implementations/repost-tool.js';
import type { AtpClient } from '../utils/atp-client.js';

const SELF = 'did:plc:self';
const POST_URI = 'at://did:plc:author/app.bsky.feed.post/1';

function mockClient(viewerRepost?: string) {
  const getPosts = vi.fn().mockResolvedValue({
    data: { posts: [{ uri: POST_URI, cid: 'bafyreiabc123', viewer: { repost: viewerRepost } }] },
  });
  const createRecord = vi
    .fn()
    .mockResolvedValue({ data: { uri: 'at://new-repost', cid: 'cidnew' } });
  const agent = {
    getPosts,
    com: { atproto: { repo: { createRecord } } },
    session: { did: SELF },
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

  return { client, getPosts, createRecord };
}

describe('single repost idempotency', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not create a duplicate when the post is already reposted', async () => {
    const existing = `at://${SELF}/app.bsky.feed.repost/existing`;
    const { client, createRecord } = mockClient(existing);
    const tool = new RepostTool(client);

    const result = await tool.handler({ uri: POST_URI, cid: 'bafyreiabc123' });

    expect(createRecord).not.toHaveBeenCalled();
    expect(result.alreadyReposted).toBe(true);
    expect(result.uri).toBe(existing);
    expect(result.success).toBe(true);
  });

  it('creates a repost when the post has not been reposted yet', async () => {
    const { client, createRecord } = mockClient(undefined);
    const tool = new RepostTool(client);

    const result = await tool.handler({ uri: POST_URI, cid: 'bafyreiabc123' });

    expect(createRecord).toHaveBeenCalledTimes(1);
    expect(result.alreadyReposted).toBe(false);
    expect(result.success).toBe(true);
  });
});
