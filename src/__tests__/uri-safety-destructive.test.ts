/**
 * Regression tests: destructive tools must never delete an arbitrary record type
 * chosen by an (untrusted) caller-supplied URI.
 *
 * unlike_post / unrepost / delete_post previously took the `collection` (and
 * `repo`) straight from the supplied URI and passed them to deleteRecord without
 * pinning the expected NSID. A crafted URI such as
 * at://<self-did>/app.bsky.graph.follow/<rkey> handed to unlike_post would delete
 * one of the user's follows. The fix pins the collection (via the SDK
 * deleteLike/deleteRepost helpers, or an explicit assertion for delete_post).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnlikePostTool } from '../tools/implementations/like-post-tool.js';
import { UnrepostTool } from '../tools/implementations/repost-tool.js';
import { DeletePostTool } from '../tools/implementations/content-management-tools.js';
import { ValidationError } from '../types/index.js';
import type { AtpClient } from '../utils/atp-client.js';

const SELF = 'did:plc:self';

function mockClient() {
  const deleteLike = vi.fn().mockResolvedValue(undefined);
  const deleteRepost = vi.fn().mockResolvedValue(undefined);
  const deleteRecord = vi.fn().mockResolvedValue({ data: {} });
  const getRecord = vi.fn().mockResolvedValue({ data: { uri: '', cid: 'cid', value: {} } });

  const agent = {
    deleteLike,
    deleteRepost,
    com: { atproto: { repo: { deleteRecord, getRecord } } },
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

  return { client, deleteLike, deleteRepost, deleteRecord, getRecord };
}

describe('destructive-tool URI safety', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('unlike_post', () => {
    it('refuses a URI whose collection is not app.bsky.feed.like', async () => {
      const { client, deleteLike, deleteRecord } = mockClient();
      const tool = new UnlikePostTool(client);

      await expect(
        tool.handler({ likeUri: `at://${SELF}/app.bsky.feed.post/abc` })
      ).rejects.toBeInstanceOf(ValidationError);

      expect(deleteLike).not.toHaveBeenCalled();
      expect(deleteRecord).not.toHaveBeenCalled();
    });

    it('deletes a genuine like via the collection-pinned helper', async () => {
      const { client, deleteLike } = mockClient();
      const tool = new UnlikePostTool(client);
      const likeUri = `at://${SELF}/app.bsky.feed.like/abc`;

      const result = await tool.handler({ likeUri });

      expect(deleteLike).toHaveBeenCalledWith(likeUri);
      expect(result.success).toBe(true);
    });
  });

  describe('unrepost', () => {
    it('refuses a URI whose collection is not app.bsky.feed.repost', async () => {
      const { client, deleteRepost, deleteRecord } = mockClient();
      const tool = new UnrepostTool(client);

      await expect(
        tool.handler({ repostUri: `at://${SELF}/app.bsky.graph.follow/abc` })
      ).rejects.toBeInstanceOf(ValidationError);

      expect(deleteRepost).not.toHaveBeenCalled();
      expect(deleteRecord).not.toHaveBeenCalled();
    });

    it('deletes a genuine repost via the collection-pinned helper', async () => {
      const { client, deleteRepost } = mockClient();
      const tool = new UnrepostTool(client);
      const repostUri = `at://${SELF}/app.bsky.feed.repost/abc`;

      const result = await tool.handler({ repostUri });

      expect(deleteRepost).toHaveBeenCalledWith(repostUri);
      expect(result.success).toBe(true);
    });
  });

  describe('delete_post', () => {
    it('refuses a non-post URI even when it belongs to the user', async () => {
      const { client, deleteRecord } = mockClient();
      const tool = new DeletePostTool(client);

      await expect(
        tool.handler({ uri: `at://${SELF}/app.bsky.graph.follow/abc` })
      ).rejects.toBeInstanceOf(ValidationError);

      expect(deleteRecord).not.toHaveBeenCalled();
    });

    it('deletes a genuine post, pinning repo to the session DID and the post collection', async () => {
      const { client, deleteRecord } = mockClient();
      const tool = new DeletePostTool(client);

      const result = await tool.handler({ uri: `at://${SELF}/app.bsky.feed.post/abc` });

      expect(deleteRecord).toHaveBeenCalledWith(
        expect.objectContaining({ repo: SELF, collection: 'app.bsky.feed.post', rkey: 'abc' })
      );
      expect(result.success).toBe(true);
    });
  });
});
