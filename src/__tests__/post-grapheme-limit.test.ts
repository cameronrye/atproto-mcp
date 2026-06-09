/**
 * Regression test: post text limits are graphemes (AT Protocol's real limit is
 * 300 graphemes / 3000 bytes), not UTF-16 code units. A 300-emoji post (600 code
 * units) is valid and must not be rejected client-side; >300 graphemes is.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreatePostTool } from '../tools/implementations/create-post-tool.js';
import { ValidationError } from '../types/index.js';
import type { AtpClient } from '../utils/atp-client.js';

const SELF = 'did:plc:self';

function mockClient() {
  const post = vi
    .fn()
    .mockResolvedValue({ uri: `at://${SELF}/app.bsky.feed.post/abc`, cid: 'bafyreiabc' });
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
  return { client, post };
}

describe('post text grapheme limits', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts a 300-emoji post (300 graphemes / 600 UTF-16 code units)', async () => {
    const { client, post } = mockClient();
    const tool = new CreatePostTool(client);

    const result = await tool.handler({ text: '😀'.repeat(300) });

    expect(post).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });

  it('rejects text exceeding 300 graphemes', async () => {
    const { client, post } = mockClient();
    const tool = new CreatePostTool(client);

    await expect(tool.handler({ text: 'a'.repeat(301) })).rejects.toBeInstanceOf(ValidationError);
    expect(post).not.toHaveBeenCalled();
  });
});
