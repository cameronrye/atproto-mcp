/**
 * Unit tests for the content-moderation tools.
 *
 * These lock the on-the-wire shapes the tools send to the AT Protocol SDK:
 *  - mute/unmute call agent.mute/unmute with the (un-resolved) actor.
 *  - block creates an app.bsky.graph.block record whose subject is the resolved DID.
 *  - unblock resolves the existing block record URI from getProfile's
 *    viewer.blocking, parses the rkey, and deletes the block record by rkey.
 *  - report_content/report_user call com.atproto.moderation.createReport with the
 *    correct reasonType NSID and subject (strongRef vs repoRef).
 *  - analyze_moderation_status (ENHANCED) works unauthenticated and surfaces labels.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AnalyzeModerationStatusTool,
  BlockUserTool,
  MuteUserTool,
  ReportContentTool,
  ReportUserTool,
  UnblockUserTool,
  UnmuteUserTool,
} from '../tools/implementations/moderation-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

const wrap = async (op: () => unknown) => {
  try {
    return { success: true, data: await op() };
  } catch (error) {
    return { success: false, error };
  }
};

function makeClient(agent: any, opts: { authenticated?: boolean } = {}): AtpClient {
  return {
    getAgent: vi.fn().mockReturnValue(agent),
    isAuthenticated: vi.fn().mockReturnValue(opts.authenticated ?? true),
    hasCredentials: vi.fn().mockReturnValue(true),
    executeAuthenticatedRequest: vi.fn().mockImplementation(wrap),
    executePublicRequest: vi.fn().mockImplementation(wrap),
  } as unknown as AtpClient;
}

describe('MuteUserTool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls agent.mute with the resolved actor and reports success', async () => {
    const mute = vi.fn().mockResolvedValue({ data: { did: 'did:plc:target' } });
    const agent = { mute, session: { did: 'did:plc:self' } };
    const tool = new MuteUserTool(makeClient(agent));

    const result = await tool.handler({ actor: 'did:plc:target' });

    expect(mute).toHaveBeenCalledTimes(1);
    // mute/unmute take the actor as-is (a DID, no resolveHandle round-trip).
    expect(mute).toHaveBeenCalledWith('did:plc:target');
    expect(result.success).toBe(true);
    expect(result.mutedUser.actor).toBe('did:plc:target');
  });
});

describe('UnmuteUserTool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls agent.unmute with the resolved actor and reports success', async () => {
    const unmute = vi.fn().mockResolvedValue({ data: { did: 'did:plc:target' } });
    const agent = { unmute, session: { did: 'did:plc:self' } };
    const tool = new UnmuteUserTool(makeClient(agent));

    const result = await tool.handler({ actor: 'did:plc:target' });

    expect(unmute).toHaveBeenCalledTimes(1);
    expect(unmute).toHaveBeenCalledWith('did:plc:target');
    expect(result.success).toBe(true);
    expect(result.unmutedUser.actor).toBe('did:plc:target');
  });
});

describe('BlockUserTool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a block record whose subject is the resolved DID', async () => {
    const create = vi.fn().mockResolvedValue({
      uri: 'at://did:plc:self/app.bsky.graph.block/blk1',
      cid: 'cidblk',
    });
    const agent = {
      app: { bsky: { graph: { block: { create } } } },
      session: { did: 'did:plc:self' },
    };
    const tool = new BlockUserTool(makeClient(agent));

    const result = await tool.handler({ actor: 'did:plc:target' });

    expect(create).toHaveBeenCalledTimes(1);
    // First arg is the repo descriptor (the authed user's repo).
    expect(create.mock.calls[0]![0]).toEqual(expect.objectContaining({ repo: 'did:plc:self' }));
    // Second arg is the record: subject must be the resolved DID, with a createdAt.
    const record = create.mock.calls[0]![1];
    expect(record).toEqual(expect.objectContaining({ subject: 'did:plc:target' }));
    expect(typeof record.createdAt).toBe('string');

    expect(result.success).toBe(true);
    expect(result.blockedUser.uri).toBe('at://did:plc:self/app.bsky.graph.block/blk1');
  });
});

describe('UnblockUserTool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('parses the rkey from viewer.blocking and deletes the block record', async () => {
    const blockUri = 'at://did:plc:self/app.bsky.graph.block/blk1';
    const getProfile = vi
      .fn()
      .mockResolvedValue({ data: { did: 'did:plc:target', viewer: { blocking: blockUri } } });
    const del = vi.fn().mockResolvedValue(undefined);
    const agent = {
      getProfile,
      app: { bsky: { graph: { block: { delete: del } } } },
      session: { did: 'did:plc:self' },
    };
    const tool = new UnblockUserTool(makeClient(agent));

    const result = await tool.handler({ actor: 'did:plc:target' });

    expect(getProfile).toHaveBeenCalledWith({ actor: 'did:plc:target' });
    expect(del).toHaveBeenCalledTimes(1);
    // rkey is the last URI segment ('blk1'); delete targets the authed user's repo.
    expect(del).toHaveBeenCalledWith(
      expect.objectContaining({ repo: 'did:plc:self', rkey: 'blk1' })
    );
    expect(result.success).toBe(true);
    expect(result.unblockedUser.actor).toBe('did:plc:target');
  });

  it('reports not-blocked and does not delete when viewer.blocking is absent', async () => {
    const getProfile = vi.fn().mockResolvedValue({ data: { did: 'did:plc:target', viewer: {} } });
    const del = vi.fn().mockResolvedValue(undefined);
    const agent = {
      getProfile,
      app: { bsky: { graph: { block: { delete: del } } } },
      session: { did: 'did:plc:self' },
    };
    const tool = new UnblockUserTool(makeClient(agent));

    const result = await tool.handler({ actor: 'did:plc:target' });

    expect(del).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not currently blocked/i);
  });
});

describe('ReportContentTool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports content with a strongRef subject and the mapped reasonType NSID', async () => {
    const createReport = vi.fn().mockResolvedValue({ data: { id: 4242 } });
    const agent = {
      com: { atproto: { moderation: { createReport } } },
      session: { did: 'did:plc:self' },
    };
    const tool = new ReportContentTool(makeClient(agent));

    const uri = 'at://did:plc:target/app.bsky.feed.post/abc';
    const result = await tool.handler({
      subject: { uri, cid: 'bafycid' },
      reasonType: 'spam',
      reason: 'lots of spam',
    });

    expect(createReport).toHaveBeenCalledTimes(1);
    const payload = createReport.mock.calls[0]![0];
    expect(payload.reasonType).toBe('com.atproto.moderation.defs#reasonSpam');
    expect(payload.reason).toBe('lots of spam');
    expect(payload.subject).toEqual({
      $type: 'com.atproto.repo.strongRef',
      uri,
      cid: 'bafycid',
    });
    expect(result.success).toBe(true);
    expect(result.reportId).toBe('4242');
    expect(result.reportDetails.subject).toBe(uri);
  });

  it('maps the violation reasonType to reasonViolation NSID', async () => {
    const createReport = vi.fn().mockResolvedValue({ data: { id: 7 } });
    const agent = {
      com: { atproto: { moderation: { createReport } } },
      session: { did: 'did:plc:self' },
    };
    const tool = new ReportContentTool(makeClient(agent));

    await tool.handler({
      subject: { uri: 'at://did:plc:target/app.bsky.feed.post/xyz', cid: 'bafycid2' },
      reasonType: 'violation',
    });

    expect(createReport.mock.calls[0]![0].reasonType).toBe(
      'com.atproto.moderation.defs#reasonViolation'
    );
  });
});

describe('ReportUserTool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports a user with a repoRef subject (resolved DID) and the mapped reasonType NSID', async () => {
    const createReport = vi.fn().mockResolvedValue({ data: { id: 99 } });
    const agent = {
      com: { atproto: { moderation: { createReport } } },
      session: { did: 'did:plc:self' },
    };
    const tool = new ReportUserTool(makeClient(agent));

    const result = await tool.handler({
      actor: 'did:plc:target',
      reasonType: 'misleading',
      reason: 'impersonation',
    });

    expect(createReport).toHaveBeenCalledTimes(1);
    const payload = createReport.mock.calls[0]![0];
    expect(payload.reasonType).toBe('com.atproto.moderation.defs#reasonMisleading');
    expect(payload.reason).toBe('impersonation');
    expect(payload.subject).toEqual({
      $type: 'com.atproto.admin.defs#repoRef',
      did: 'did:plc:target',
    });
    expect(result.success).toBe(true);
    expect(result.reportId).toBe('99');
    expect(result.reportDetails.actor).toBe('did:plc:target');
  });
});

describe('AnalyzeModerationStatusTool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns labels from the profile and works unauthenticated (ENHANCED)', async () => {
    const getProfile = vi.fn().mockResolvedValue({
      data: {
        did: 'did:plc:target',
        viewer: { muted: false },
        labels: [
          {
            src: 'did:plc:labeler',
            uri: 'at://did:plc:target',
            val: 'nsfw',
            cts: '2024-01-01T00:00:00Z',
          },
        ],
      },
    });
    const agent = { getProfile };
    const client = makeClient(agent, { authenticated: false });
    const tool = new AnalyzeModerationStatusTool(client);

    const result = await tool.handler({ subject: 'did:plc:target' });

    // ENHANCED tools fall back to the public request path when unauthenticated.
    expect(client.executePublicRequest).toHaveBeenCalled();
    expect(client.executeAuthenticatedRequest).not.toHaveBeenCalled();
    expect(getProfile).toHaveBeenCalledWith({ actor: 'did:plc:target' });

    expect(result.success).toBe(true);
    expect(result.subjectType).toBe('user');
    expect(result.moderation.labels).toEqual([
      {
        src: 'did:plc:labeler',
        uri: 'at://did:plc:target',
        val: 'nsfw',
        cts: '2024-01-01T00:00:00Z',
      },
    ]);
    // An nsfw label drives the analysis to a content-warning / warning state.
    expect(result.analysis.isNSFW).toBe(true);
    expect(result.analysis.hasContentWarnings).toBe(true);
    expect(result.analysis.safetyLevel).toBe('warning');
  });
});
