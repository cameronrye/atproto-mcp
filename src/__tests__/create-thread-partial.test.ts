/**
 * Regression test: when create_thread fails partway, the posts already published
 * are live on the network. The tool must return their URIs so the caller can
 * delete or resume, instead of discarding them (which orphans the half-thread
 * and invites a duplicate retry).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateThreadTool } from '../tools/implementations/create-thread-tool.js';
import type { AtpClient } from '../utils/atp-client.js';

const SELF = 'did:plc:self';

function mockClient(post: ReturnType<typeof vi.fn>) {
  const agent = { post, session: { did: SELF } };
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

const threeposts = {
  posts: [{ text: 'Post 1' }, { text: 'Post 2' }, { text: 'Post 3' }],
};

describe('create_thread partial-failure recovery', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the created posts when a later post fails', async () => {
    let calls = 0;
    const post = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls === 3) throw new Error('rate limited');
      return { uri: `at://${SELF}/app.bsky.feed.post/${calls}`, cid: `cid${calls}` };
    });
    const { client } = mockClient(post);
    const tool = new CreateThreadTool(client);

    const result = await tool.handler(threeposts);

    expect(result.success).toBe(false);
    expect(result.thread).toHaveLength(2);
    expect(result.failedAtPosition).toBe(3);
    expect(result.rootPost.uri).toBe(`at://${SELF}/app.bsky.feed.post/1`);
  });

  it('throws cleanly when the very first post fails (nothing orphaned)', async () => {
    const post = vi.fn().mockRejectedValue(new Error('boom'));
    const { client } = mockClient(post);
    const tool = new CreateThreadTool(client);

    await expect(tool.handler(threeposts)).rejects.toBeTruthy();
  });
});
