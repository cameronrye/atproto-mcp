/**
 * Perf regression test: batch_action with action=like / action=repost already fetch each post via
 * getPosts (for viewer state), and that response carries the post CID. They must
 * reuse it for the like/repost subject instead of issuing a second per-item
 * getRecord round-trip (getCidFromUri).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchActionTool } from '../tools/implementations/batch-operations-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

const URI = 'at://did:plc:x/app.bsky.feed.post/p';

function mockClient(posts: unknown[]) {
  const getPosts = vi.fn().mockResolvedValue({ data: { posts } });
  const getRecord = vi.fn();
  const createRecord = vi.fn().mockResolvedValue({ data: { uri: 'at://rec', cid: 'reccid' } });
  const agent = {
    getPosts,
    com: { atproto: { repo: { getRecord, createRecord } } },
    session: { did: 'did:plc:self' },
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
  return { client, getPosts, getRecord, createRecord };
}

describe('batch tools reuse the getPosts CID (no redundant getRecord)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('batch_action like uses the post CID from getPosts and never calls getRecord', async () => {
    const { client, getPosts, getRecord, createRecord } = mockClient([
      { uri: URI, cid: 'postcid', viewer: {} },
    ]);
    const result = await new BatchActionTool(client).handler({ action: 'like', targets: [URI] });

    expect(getRecord).not.toHaveBeenCalled();
    expect(getPosts).toHaveBeenCalledTimes(1);
    expect(createRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'app.bsky.feed.like',
        record: expect.objectContaining({ subject: { uri: URI, cid: 'postcid' } }),
      })
    );
    expect(result.summary.succeeded).toBe(1);
  });

  it('batch_action like reports alreadyLiked from viewer.like without creating a record', async () => {
    const { client, createRecord } = mockClient([
      { uri: URI, cid: 'postcid', viewer: { like: 'at://like/1' } },
    ]);
    const result = await new BatchActionTool(client).handler({ action: 'like', targets: [URI] });

    expect(createRecord).not.toHaveBeenCalled();
    expect(result.results[0]?.alreadyLiked).toBe(true);
  });

  it('batch_action repost uses the post CID from getPosts and never calls getRecord', async () => {
    const { client, getRecord, createRecord } = mockClient([
      { uri: URI, cid: 'postcid', viewer: {} },
    ]);
    await new BatchActionTool(client).handler({ action: 'repost', targets: [URI] });

    expect(getRecord).not.toHaveBeenCalled();
    expect(createRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'app.bsky.feed.repost',
        record: expect.objectContaining({ subject: { uri: URI, cid: 'postcid' } }),
      })
    );
  });
});
