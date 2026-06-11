/**
 * Perf regression tests: batch_action must hydrate ALL targets in ONE read
 * round-trip before the write loop — agent.getPosts({uris}) for like/repost
 * (post views carry cid + viewer.like/viewer.repost), agent.getProfiles({actors})
 * for follow (profile views carry did/handle/viewer.following) — instead of one
 * read call per target. Per-target error attribution must survive batching: a
 * target missing from the batched response is that target's failure, not the
 * batch's, and continueOnError semantics are unchanged.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BatchActionTool } from '../tools/implementations/batch-operations-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

const URIS = [
  'at://did:plc:user1/app.bsky.feed.post/1',
  'at://did:plc:user2/app.bsky.feed.post/2',
  'at://did:plc:user3/app.bsky.feed.post/3',
];

const ACTORS = ['user1.bsky.social', 'user2.bsky.social', 'user3.bsky.social'];

function mockClient(agentOverrides: Record<string, unknown> = {}) {
  const getPosts = vi.fn().mockImplementation(async ({ uris }: { uris: string[] }) => ({
    data: { posts: uris.map(uri => ({ uri, cid: `cid-${uri.split('/').pop()}`, viewer: {} })) },
  }));
  const getProfiles = vi.fn().mockImplementation(async ({ actors }: { actors: string[] }) => ({
    data: {
      profiles: actors.map(actor => ({
        did: `did:plc:${actor.replace('.bsky.social', '')}`,
        handle: actor,
        viewer: {},
      })),
    },
  }));
  const getProfile = vi.fn();
  const createRecord = vi.fn().mockResolvedValue({ data: { uri: 'at://rec', cid: 'reccid' } });
  const agent = {
    getPosts,
    getProfiles,
    getProfile,
    com: { atproto: { repo: { createRecord } } },
    session: { did: 'did:plc:self' },
    ...agentOverrides,
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
  return { client, getPosts, getProfiles, getProfile, createRecord };
}

describe('batch_action hydrates all targets in one read round-trip', () => {
  beforeEach(() => vi.clearAllMocks());

  it('like: fetches all post views with a single getPosts call', async () => {
    const { client, getPosts, createRecord } = mockClient();

    const result = await new BatchActionTool(client).handler({ action: 'like', targets: URIS });

    expect(getPosts).toHaveBeenCalledTimes(1);
    expect(getPosts).toHaveBeenCalledWith({ uris: URIS });
    expect(createRecord).toHaveBeenCalledTimes(3);
    expect(result.summary.succeeded).toBe(3);
  });

  it('repost: fetches all post views with a single getPosts call', async () => {
    const { client, getPosts, createRecord } = mockClient();

    const result = await new BatchActionTool(client).handler({ action: 'repost', targets: URIS });

    expect(getPosts).toHaveBeenCalledTimes(1);
    expect(getPosts).toHaveBeenCalledWith({ uris: URIS });
    expect(createRecord).toHaveBeenCalledTimes(3);
    expect(result.summary.succeeded).toBe(3);
  });

  it('follow: fetches all profiles with a single getProfiles call (no per-actor getProfile)', async () => {
    const { client, getProfiles, getProfile, createRecord } = mockClient();

    const result = await new BatchActionTool(client).handler({
      action: 'follow',
      targets: ACTORS,
    });

    expect(getProfiles).toHaveBeenCalledTimes(1);
    expect(getProfiles).toHaveBeenCalledWith({ actors: ACTORS });
    expect(getProfile).not.toHaveBeenCalled();
    expect(createRecord).toHaveBeenCalledTimes(3);
    expect(result.summary.succeeded).toBe(3);
  });

  it("like: a target missing from the batched response is that target's failure only", async () => {
    const { client, createRecord } = mockClient({
      getPosts: vi.fn().mockResolvedValue({
        data: {
          posts: [
            { uri: URIS[0], cid: 'cid-1', viewer: {} },
            { uri: URIS[2], cid: 'cid-3', viewer: {} },
          ],
        },
      }),
    });

    const result = await new BatchActionTool(client).handler({ action: 'like', targets: URIS });

    expect(result.success).toBe(false);
    expect(result.summary.succeeded).toBe(2);
    expect(result.summary.failed).toBe(1);
    const failedItem = result.results.find((r: { success: boolean }) => !r.success);
    expect(failedItem?.uri).toBe(URIS[1]);
    expect(createRecord).toHaveBeenCalledTimes(2);
  });

  it("follow: an actor missing from the batched response is that actor's failure only", async () => {
    const { client } = mockClient({
      getProfiles: vi.fn().mockResolvedValue({
        data: {
          profiles: [
            { did: 'did:plc:user1', handle: 'user1.bsky.social', viewer: {} },
            { did: 'did:plc:user3', handle: 'user3.bsky.social', viewer: {} },
          ],
        },
      }),
    });

    const result = await new BatchActionTool(client).handler({
      action: 'follow',
      targets: ACTORS,
    });

    expect(result.success).toBe(false);
    expect(result.summary.succeeded).toBe(2);
    expect(result.summary.failed).toBe(1);
    const failedItem = result.results.find((r: { success: boolean }) => !r.success);
    expect(failedItem?.actor).toBe(ACTORS[1]);
  });

  it('like: missing target with continueOnError=false stops the batch and reports skipped', async () => {
    const { client, createRecord } = mockClient({
      getPosts: vi.fn().mockResolvedValue({
        data: { posts: [{ uri: URIS[0], cid: 'cid-1', viewer: {} }] },
      }),
    });

    const result = await new BatchActionTool(client).handler({
      action: 'like',
      targets: URIS,
      continueOnError: false,
    });

    expect(result.summary.succeeded).toBe(1);
    expect(result.summary.failed).toBe(1);
    expect(result.summary.skipped).toBe(1);
    expect(createRecord).toHaveBeenCalledTimes(1);
  });

  it('like: reuses the batched viewer state for alreadyLiked without extra reads', async () => {
    const getPosts = vi.fn().mockResolvedValue({
      data: {
        posts: [
          { uri: URIS[0], cid: 'cid-1', viewer: { like: 'at://like/existing' } },
          { uri: URIS[1], cid: 'cid-2', viewer: {} },
        ],
      },
    });
    const { client, createRecord } = mockClient({ getPosts });

    const result = await new BatchActionTool(client).handler({
      action: 'like',
      targets: [URIS[0], URIS[1]],
    });

    expect(getPosts).toHaveBeenCalledTimes(1);
    expect(result.results[0]?.alreadyLiked).toBe(true);
    expect(result.results[0]?.likeUri).toBe('at://like/existing');
    // Only the not-yet-liked post gets a write.
    expect(createRecord).toHaveBeenCalledTimes(1);
    expect(result.summary.succeeded).toBe(2);
  });

  it('follow: reuses viewer.following from the batched profiles for alreadyFollowing', async () => {
    const getProfiles = vi.fn().mockResolvedValue({
      data: {
        profiles: [
          {
            did: 'did:plc:user1',
            handle: 'user1.bsky.social',
            viewer: { following: 'at://follow/existing' },
          },
          { did: 'did:plc:user2', handle: 'user2.bsky.social', viewer: {} },
        ],
      },
    });
    const { client, createRecord } = mockClient({ getProfiles });

    const result = await new BatchActionTool(client).handler({
      action: 'follow',
      targets: [ACTORS[0], ACTORS[1]],
    });

    expect(getProfiles).toHaveBeenCalledTimes(1);
    expect(result.results[0]?.alreadyFollowing).toBe(true);
    expect(result.results[0]?.uri).toBe('at://follow/existing');
    expect(createRecord).toHaveBeenCalledTimes(1);
    expect(result.summary.succeeded).toBe(2);
  });
});
