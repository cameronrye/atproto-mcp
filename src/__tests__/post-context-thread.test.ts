/**
 * Regression test: get_post_context must report the TRUE thread root (the topmost
 * ancestor, not the grandparent) and a real depth (not always 0).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetPostContextTool } from '../tools/implementations/composite-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

function node(uri: string, parent?: unknown) {
  return {
    post: {
      uri,
      cid: `cid-${uri}`,
      author: { did: 'did:plc:a', handle: 'a.test' },
      record: { text: uri, createdAt: '2026-01-01T00:00:00.000Z' },
      likeCount: 0,
      repostCount: 0,
      replyCount: 0,
    },
    ...(parent ? { parent } : {}),
  };
}

function mockClient(thread: unknown) {
  const getPostThread = vi.fn().mockResolvedValue({ data: { thread } });
  const agent = { getPostThread, session: { did: 'did:plc:self' } };
  const wrap = async (op: () => unknown) => {
    try {
      return { success: true, data: await op() };
    } catch (error) {
      return { success: false, error };
    }
  };
  return {
    getAgent: vi.fn().mockReturnValue(agent),
    isAuthenticated: vi.fn().mockReturnValue(true),
    hasCredentials: vi.fn().mockReturnValue(true),
    executeAuthenticatedRequest: vi.fn().mockImplementation(wrap),
    executePublicRequest: vi.fn().mockImplementation(wrap),
  } as unknown as AtpClient;
}

describe('get_post_context thread root/depth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('walks the full parent chain for the true root and a real depth', async () => {
    // child -> parent -> grandparent -> root (depth 3); the true root is beyond
    // the grandparent, so the old "root = grandparent" shortcut is wrong.
    const root = node('at://root');
    const grandparent = node('at://grandparent', root);
    const parent = node('at://parent', grandparent);
    const child = node('at://child', parent);
    const tool = new GetPostContextTool(mockClient(child));

    const result = await tool.handler({
      uri: 'at://child',
      includeThread: true,
      includeAuthorProfile: false,
      includeEngagement: false,
    });

    expect(result.thread.root.uri).toBe('at://root');
    expect(result.thread.depth).toBe(3);
  });
});
