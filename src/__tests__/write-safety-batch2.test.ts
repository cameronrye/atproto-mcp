/**
 * Write-path safety regression tests (batch 2).
 *
 * - update_profile: a failed read of the current profile must abort the update
 *   (proceeding rebuilds the record from {} and wipes the profile); only a
 *   genuine RecordNotFound may fall through to "create fresh profile".
 * - update_profile: displayName/description limits are 64/256 GRAPHEMES per the
 *   lexicon, not UTF-16 code units — emoji-heavy values must not be rejected.
 * - create_thread: per-post text limits are predictable, so they are validated
 *   for ALL posts before any record is created (no orphaned partial threads).
 * - delete_post: an AT-URI whose authority is a handle must be resolved to a
 *   DID before the ownership comparison, not falsely rejected.
 * - reply_to_post: root/parent must reference app.bsky.feed.post records.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DeletePostTool,
  UpdateProfileTool,
} from '../tools/implementations/content-management-tools.js';
import { CreateThreadTool } from '../tools/implementations/create-thread-tool.js';
import { ReplyToPostTool } from '../tools/implementations/reply-to-post-tool.js';
import { AtpError, ValidationError } from '../types/index.js';
import type { AtpClient } from '../utils/atp-client.js';

const SELF = 'did:plc:self';

// Wrap an operation the way AtpClient.executeAuthenticatedRequest does.
const wrap = async (op: () => unknown) => {
  try {
    return { success: true, data: await op() };
  } catch (error) {
    return { success: false, error };
  }
};

function makeClient(agentParts: Record<string, unknown>): AtpClient {
  const agent = { session: { did: SELF }, ...agentParts };
  return {
    getAgent: vi.fn().mockReturnValue(agent),
    isAuthenticated: vi.fn().mockReturnValue(true),
    hasCredentials: vi.fn().mockReturnValue(true),
    executeAuthenticatedRequest: vi.fn().mockImplementation(wrap),
    executePublicRequest: vi.fn().mockImplementation(wrap),
  } as unknown as AtpClient;
}

describe('update_profile current-profile read failures', () => {
  beforeEach(() => vi.clearAllMocks());

  function profileClient(getRecord: ReturnType<typeof vi.fn>) {
    const putRecord = vi.fn().mockResolvedValue({ data: { uri: 'at://x', cid: 'cidB' } });
    const client = makeClient({ com: { atproto: { repo: { getRecord, putRecord } } } });
    return { client, putRecord };
  }

  it('aborts (typed error, no write) when the profile read fails transiently', async () => {
    const getRecord = vi.fn().mockRejectedValue(new Error('network timeout'));
    const { client, putRecord } = profileClient(getRecord);
    const tool = new UpdateProfileTool(client);

    await expect(tool.handler({ displayName: 'New' })).rejects.toBeInstanceOf(AtpError);
    expect(putRecord).not.toHaveBeenCalled();
  });

  it('still creates a fresh profile when the read fails with RecordNotFound', async () => {
    const getRecord = vi.fn().mockRejectedValue(
      Object.assign(new Error('Could not locate record: app.bsky.actor.profile/self'), {
        error: 'RecordNotFound',
        status: 400,
      })
    );
    const { client, putRecord } = profileClient(getRecord);
    const tool = new UpdateProfileTool(client);

    const result = await tool.handler({ displayName: 'New' });

    expect(result.success).toBe(true);
    expect(putRecord).toHaveBeenCalledTimes(1);
    // First-time create has no prior CID to compare-and-swap against.
    expect(putRecord.mock.calls[0]![0]).not.toHaveProperty('swapRecord');
  });
});

describe('update_profile grapheme limits', () => {
  beforeEach(() => vi.clearAllMocks());

  function profileClient() {
    const getRecord = vi
      .fn()
      .mockResolvedValue({ data: { value: { displayName: 'Old' }, cid: 'cidA' } });
    const putRecord = vi.fn().mockResolvedValue({ data: { uri: 'at://x', cid: 'cidB' } });
    const client = makeClient({ com: { atproto: { repo: { getRecord, putRecord } } } });
    return { client, putRecord };
  }

  it('accepts an emoji-heavy displayName within 64 graphemes', async () => {
    const { client, putRecord } = profileClient();
    const tool = new UpdateProfileTool(client);

    // 40 graphemes but 80 UTF-16 code units — valid per the lexicon (64 graphemes).
    const result = await tool.handler({ displayName: '😀'.repeat(40) });

    expect(result.success).toBe(true);
    expect(putRecord).toHaveBeenCalledTimes(1);
  });

  it('accepts an emoji-heavy description within 256 graphemes', async () => {
    const { client, putRecord } = profileClient();
    const tool = new UpdateProfileTool(client);

    // 200 graphemes but 400 UTF-16 code units — valid per the lexicon (256 graphemes).
    const result = await tool.handler({ description: '😀'.repeat(200) });

    expect(result.success).toBe(true);
    expect(putRecord).toHaveBeenCalledTimes(1);
  });

  it('still rejects a displayName over 64 graphemes', async () => {
    const { client, putRecord } = profileClient();
    const tool = new UpdateProfileTool(client);

    await expect(tool.handler({ displayName: 'a'.repeat(65) })).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(putRecord).not.toHaveBeenCalled();
  });

  it('still rejects a description over 256 graphemes', async () => {
    const { client, putRecord } = profileClient();
    const tool = new UpdateProfileTool(client);

    await expect(tool.handler({ description: 'a'.repeat(257) })).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(putRecord).not.toHaveBeenCalled();
  });
});

describe('create_thread upfront per-post validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('publishes nothing when a later post predictably exceeds the grapheme limit', async () => {
    const post = vi.fn().mockResolvedValue({
      uri: `at://${SELF}/app.bsky.feed.post/p1`,
      cid: 'bafycidp0001',
    });
    const client = makeClient({ post });
    const tool = new CreateThreadTool(client);

    await expect(
      tool.handler({
        posts: [{ text: 'fine' }, { text: 'a'.repeat(301) }], // post 2 is over 300 graphemes
      })
    ).rejects.toBeInstanceOf(ValidationError);

    // The limit violation is detectable before publishing anything — post 1
    // must NOT be live on the network.
    expect(post).not.toHaveBeenCalled();
  });
});

describe('delete_post handle-authority ownership check', () => {
  beforeEach(() => vi.clearAllMocks());

  function deleteClient(resolvedDid: string) {
    const deleteRecord = vi.fn().mockResolvedValue({ data: {} });
    const getRecord = vi.fn().mockResolvedValue({ data: { uri: '', cid: 'cid', value: {} } });
    const resolveHandle = vi.fn().mockResolvedValue({ data: { did: resolvedDid } });
    const client = makeClient({
      com: {
        atproto: {
          repo: { deleteRecord, getRecord },
          identity: { resolveHandle },
        },
      },
    });
    return { client, deleteRecord, resolveHandle };
  }

  it("deletes the user's own post when the URI authority is their handle", async () => {
    const { client, deleteRecord, resolveHandle } = deleteClient(SELF);
    const tool = new DeletePostTool(client);

    const result = await tool.handler({ uri: 'at://self.test/app.bsky.feed.post/abc' });

    expect(resolveHandle).toHaveBeenCalledWith({ handle: 'self.test' });
    expect(result.success).toBe(true);
    expect(deleteRecord).toHaveBeenCalledWith(
      expect.objectContaining({ repo: SELF, collection: 'app.bsky.feed.post', rkey: 'abc' })
    );
  });

  it("still refuses another user's post named by handle", async () => {
    const { client, deleteRecord } = deleteClient('did:plc:other');
    const tool = new DeletePostTool(client);

    await expect(
      tool.handler({ uri: 'at://other.test/app.bsky.feed.post/abc' })
    ).rejects.toBeTruthy();
    expect(deleteRecord).not.toHaveBeenCalled();
  });
});

describe('reply_to_post reply-ref collection validation', () => {
  beforeEach(() => vi.clearAllMocks());

  function replyClient() {
    const post = vi.fn().mockResolvedValue({
      uri: `at://${SELF}/app.bsky.feed.post/created`,
      cid: 'bafycreated01',
    });
    const getRecord = vi.fn().mockResolvedValue({ data: { cid: 'bafyrootcid01' } });
    const client = makeClient({ post, com: { atproto: { repo: { getRecord } } } });
    return { client, post };
  }

  it('rejects a root URI whose collection is not app.bsky.feed.post', async () => {
    const { client, post } = replyClient();
    const tool = new ReplyToPostTool(client);

    await expect(
      tool.handler({
        text: 'hi',
        root: 'at://did:plc:author/app.bsky.feed.like/abc',
        parent: 'at://did:plc:author/app.bsky.feed.post/abc',
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects a parent URI whose collection is not app.bsky.feed.post', async () => {
    const { client, post } = replyClient();
    const tool = new ReplyToPostTool(client);

    await expect(
      tool.handler({
        text: 'hi',
        root: 'at://did:plc:author/app.bsky.feed.post/abc',
        parent: 'at://did:plc:author/app.bsky.graph.follow/abc',
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(post).not.toHaveBeenCalled();
  });

  it('accepts genuine post URIs for root and parent', async () => {
    const { client, post } = replyClient();
    const tool = new ReplyToPostTool(client);

    const result = await tool.handler({
      text: 'hi',
      root: 'at://did:plc:author/app.bsky.feed.post/root',
      parent: 'at://did:plc:author/app.bsky.feed.post/parent',
    });

    expect(result.success).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
  });
});
