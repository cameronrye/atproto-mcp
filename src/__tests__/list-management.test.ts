/**
 * Unit tests for the list-management tools (create_list / add_to_list /
 * remove_from_list) in advanced-social-tools.ts.
 *
 * These lock the on-the-wire record shapes: create_list writes an
 * app.bsky.graph.list record with the lexicon purpose token, add_to_list
 * resolves the actor to a DID and writes a listitem with that subject,
 * and remove_from_list pages through getList to find and delete the right
 * listitem rkey (with a distinct error when the page cap is hit before the
 * list is exhausted). All three are PRIVATE tools.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CreateListTool,
  AddToListTool,
  RemoveFromListTool,
} from '../tools/implementations/advanced-social-tools.js';
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

const SELF = 'did:plc:me';
const LIST_URI = `at://${SELF}/app.bsky.graph.list/listrkey`;

describe('CreateListTool', () => {
  beforeEach(() => vi.clearAllMocks());

  const makeAgent = (create = vi.fn()) => ({
    session: { did: SELF },
    app: { bsky: { graph: { list: { create } } } },
  });

  it('creates an app.bsky.graph.list record in the authenticated repo with the curatelist purpose token', async () => {
    const create = vi.fn().mockResolvedValue({
      uri: `at://${SELF}/app.bsky.graph.list/abc`,
      cid: 'cidlist',
    });
    const tool = new CreateListTool(makeClient(makeAgent(create)));

    const result = await tool.handler({ name: 'Cool people', description: 'folks I like' });

    expect(create).toHaveBeenCalledTimes(1);
    const [repoArg, record] = create.mock.calls[0]!;
    expect(repoArg).toEqual({ repo: SELF });
    expect(record).toMatchObject({
      name: 'Cool people',
      description: 'folks I like',
      // Default purpose -> the curate-list lexicon token, not the bare enum value.
      purpose: 'app.bsky.graph.defs#curatelist',
    });
    expect(typeof record.createdAt).toBe('string');
    expect(Number.isNaN(Date.parse(record.createdAt))).toBe(false);

    expect(result.success).toBe(true);
    expect(result.list).toMatchObject({
      uri: `at://${SELF}/app.bsky.graph.list/abc`,
      cid: 'cidlist',
      name: 'Cool people',
      description: 'folks I like',
      purpose: 'curatelist',
    });
  });

  it('maps purpose "modlist" to the app.bsky.graph.defs#modlist lexicon token', async () => {
    const create = vi.fn().mockResolvedValue({
      uri: `at://${SELF}/app.bsky.graph.list/mod`,
      cid: 'cidmod',
    });
    const tool = new CreateListTool(makeClient(makeAgent(create)));

    const result = await tool.handler({ name: 'Blocked', purpose: 'modlist' });

    expect(create.mock.calls[0]![1]).toMatchObject({
      purpose: 'app.bsky.graph.defs#modlist',
    });
    expect(result.list.purpose).toBe('modlist');
  });

  it('rejects an empty list name via zod before any record is created', async () => {
    const create = vi.fn();
    const tool = new CreateListTool(makeClient(makeAgent(create)));

    await expect(tool.handler({ name: '' })).rejects.toThrow(/List name/);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('AddToListTool', () => {
  beforeEach(() => vi.clearAllMocks());

  const makeAgent = (create = vi.fn(), resolveHandle = vi.fn()) => ({
    session: { did: SELF },
    app: { bsky: { graph: { listitem: { create } } } },
    com: { atproto: { identity: { resolveHandle } } },
  });

  it('resolves a handle to a DID and creates a listitem with that subject and the list URI', async () => {
    const resolveHandle = vi.fn().mockResolvedValue({ data: { did: 'did:plc:alice' } });
    const create = vi.fn().mockResolvedValue({
      uri: `at://${SELF}/app.bsky.graph.listitem/item1`,
      cid: 'ciditem',
    });
    const tool = new AddToListTool(makeClient(makeAgent(create, resolveHandle)));

    const result = await tool.handler({ listUri: LIST_URI, actor: 'alice.bsky.social' });

    expect(resolveHandle).toHaveBeenCalledWith({ handle: 'alice.bsky.social' });
    expect(create).toHaveBeenCalledTimes(1);
    const [repoArg, record] = create.mock.calls[0]!;
    expect(repoArg).toEqual({ repo: SELF });
    // The listitem subject must be the resolved DID, never the raw handle.
    expect(record).toMatchObject({ subject: 'did:plc:alice', list: LIST_URI });
    expect(typeof record.createdAt).toBe('string');

    expect(result.success).toBe(true);
    expect(result.listItem).toEqual({
      uri: `at://${SELF}/app.bsky.graph.listitem/item1`,
      listUri: LIST_URI,
      actor: 'alice.bsky.social',
    });
  });

  it('uses a DID actor as the subject directly without resolving the handle', async () => {
    const resolveHandle = vi.fn();
    const create = vi.fn().mockResolvedValue({
      uri: `at://${SELF}/app.bsky.graph.listitem/item2`,
      cid: 'cid2',
    });
    const tool = new AddToListTool(makeClient(makeAgent(create, resolveHandle)));

    await tool.handler({ listUri: LIST_URI, actor: 'did:plc:bob' });

    expect(resolveHandle).not.toHaveBeenCalled();
    expect(create.mock.calls[0]![1]).toMatchObject({ subject: 'did:plc:bob' });
  });

  it('rejects a non-at:// list URI before any record is created', async () => {
    const create = vi.fn();
    const tool = new AddToListTool(makeClient(makeAgent(create)));

    await expect(
      tool.handler({ listUri: 'https://bsky.app/lists/abc', actor: 'did:plc:bob' })
    ).rejects.toThrow(/AT Protocol URI/);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('RemoveFromListTool', () => {
  beforeEach(() => vi.clearAllMocks());

  const member = (did: string, rkey: string) => ({
    uri: `at://${SELF}/app.bsky.graph.listitem/${rkey}`,
    subject: { did },
  });

  const makeAgent = (getList: any, del = vi.fn()) => ({
    session: { did: SELF },
    app: { bsky: { graph: { getList, listitem: { delete: del } } } },
  });

  it('finds the member on the first page and deletes the matching listitem rkey', async () => {
    const getList = vi.fn().mockResolvedValue({
      data: {
        items: [member('did:plc:other', 'r1'), member('did:plc:bob', 'r2')],
        cursor: undefined,
      },
    });
    const del = vi.fn().mockResolvedValue({});
    const tool = new RemoveFromListTool(makeClient(makeAgent(getList, del)));

    const result = await tool.handler({ listUri: LIST_URI, actor: 'did:plc:bob' });

    expect(getList).toHaveBeenCalledTimes(1);
    expect(getList).toHaveBeenCalledWith({ list: LIST_URI, limit: 100 });
    // The delete targets the matched member's rkey in the authenticated repo.
    expect(del).toHaveBeenCalledWith({ repo: SELF, rkey: 'r2' });

    expect(result.success).toBe(true);
    expect(result.removedFrom).toEqual({ listUri: LIST_URI, actor: 'did:plc:bob' });
  });

  it('pages through the list with the returned cursor until the member is found', async () => {
    const getList = vi
      .fn()
      .mockResolvedValueOnce({
        data: { items: [member('did:plc:other', 'r1')], cursor: 'page2' },
      })
      .mockResolvedValueOnce({
        data: { items: [member('did:plc:bob', 'r9')], cursor: 'page3' },
      });
    const del = vi.fn().mockResolvedValue({});
    const tool = new RemoveFromListTool(makeClient(makeAgent(getList, del)));

    const result = await tool.handler({ listUri: LIST_URI, actor: 'did:plc:bob' });

    expect(getList).toHaveBeenCalledTimes(2);
    expect(getList.mock.calls[1]![0]).toEqual({ list: LIST_URI, limit: 100, cursor: 'page2' });
    expect(del).toHaveBeenCalledWith({ repo: SELF, rkey: 'r9' });
    expect(result.success).toBe(true);
  });

  it('reports the member as not in the list when the whole list is scanned without a match', async () => {
    const getList = vi.fn().mockResolvedValue({
      data: { items: [member('did:plc:other', 'r1')], cursor: undefined },
    });
    const del = vi.fn();
    const tool = new RemoveFromListTool(makeClient(makeAgent(getList, del)));

    const result = await tool.handler({ listUri: LIST_URI, actor: 'did:plc:bob' });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/is not in the specified list/);
    expect(del).not.toHaveBeenCalled();
  });

  it('returns a distinct too-large-to-scan error (not a definitive absence) when the page cap is hit with pages remaining', async () => {
    // Every page returns 1 non-matching member and a cursor, so the 50-page cap
    // is exhausted while the list still has unscanned pages. Claiming the user
    // "is not in the specified list" here would be a false negative.
    const getList = vi.fn().mockResolvedValue({
      data: { items: [member('did:plc:other', 'r1')], cursor: 'more' },
    });
    const del = vi.fn();
    const tool = new RemoveFromListTool(makeClient(makeAgent(getList, del)));

    const result = await tool.handler({ listUri: LIST_URI, actor: 'did:plc:bob' });

    expect(getList).toHaveBeenCalledTimes(50);
    expect(del).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/too large to scan/i);
    expect(result.message).toMatch(/5000/);
    expect(result.message).not.toMatch(/is not in the specified list/);
  });
});
