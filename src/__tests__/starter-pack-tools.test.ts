/**
 * Unit tests for the starter pack tools (app.bsky.graph.searchStarterPacks /
 * getStarterPack). Both are public AppView endpoints ("Does not require auth"
 * per the lexicon), so they must be ENHANCED — available unauthenticated via
 * the public API fallback — mirroring get_user_profile / get_user_connections.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GetStarterPackTool,
  SearchStarterPacksTool,
} from '../tools/implementations/starter-pack-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

const PACK_URI = 'at://did:plc:creator/app.bsky.graph.starterpack/3kpack';

const starterPackViewBasic = {
  uri: PACK_URI,
  cid: 'bafypack',
  record: {
    $type: 'app.bsky.graph.starterpack',
    name: 'TypeScript Devs',
    description: 'Folks who write TypeScript',
    list: 'at://did:plc:creator/app.bsky.graph.list/3klist',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  creator: { did: 'did:plc:creator', handle: 'creator.test', displayName: 'Creator' },
  listItemCount: 42,
  joinedWeekCount: 5,
  joinedAllTimeCount: 50,
  indexedAt: '2026-01-02T00:00:00.000Z',
};

const starterPackView = {
  ...starterPackViewBasic,
  list: {
    uri: 'at://did:plc:creator/app.bsky.graph.list/3klist',
    cid: 'bafylist',
    name: 'TypeScript Devs list',
    purpose: 'app.bsky.graph.defs#referencelist',
    listItemCount: 42,
  },
  listItemsSample: [
    {
      uri: 'at://did:plc:creator/app.bsky.graph.listitem/3kitem',
      subject: {
        did: 'did:plc:member1',
        handle: 'member1.test',
        displayName: 'Member One',
        description: 'first member',
        avatar: 'https://cdn.test/avatar1.jpg',
      },
    },
  ],
  feeds: [
    {
      uri: 'at://did:plc:creator/app.bsky.feed.generator/3kfeed',
      cid: 'bafyfeed',
      did: 'did:web:feeds.test',
      creator: { did: 'did:plc:creator', handle: 'creator.test', displayName: 'Creator' },
      displayName: 'TS Feed',
      description: 'TypeScript posts',
      likeCount: 7,
      indexedAt: '2026-01-02T00:00:00.000Z',
    },
  ],
};

function mockClient(opts: { authenticated?: boolean } = {}) {
  const authenticated = opts.authenticated ?? true;
  const searchStarterPacks = vi.fn().mockResolvedValue({
    data: { cursor: 'page-2', starterPacks: [starterPackViewBasic] },
  });
  const getStarterPack = vi.fn().mockResolvedValue({
    data: { starterPack: starterPackView },
  });
  const resolveHandle = vi.fn().mockResolvedValue({ data: { did: 'did:plc:creator' } });

  const agent = {
    app: { bsky: { graph: { searchStarterPacks, getStarterPack } } },
    com: { atproto: { identity: { resolveHandle } } },
  };

  const run = async (op: () => unknown) => {
    try {
      return { success: true, data: await op() };
    } catch (error) {
      return { success: false, error };
    }
  };

  const executeAuthenticatedRequest = vi.fn().mockImplementation(run);
  const executePublicRequest = vi.fn().mockImplementation(run);

  const client = {
    getAgent: vi.fn().mockReturnValue(agent),
    isAuthenticated: vi.fn().mockReturnValue(authenticated),
    hasCredentials: vi.fn().mockReturnValue(authenticated),
    executeAuthenticatedRequest,
    executePublicRequest,
  } as unknown as AtpClient;

  return {
    client,
    searchStarterPacks,
    getStarterPack,
    resolveHandle,
    executeAuthenticatedRequest,
    executePublicRequest,
  };
}

describe('starter pack tools are available unauthenticated (ENHANCED)', () => {
  it('search_starter_packs is available without authentication', () => {
    const { client } = mockClient({ authenticated: false });
    expect(new SearchStarterPacksTool(client).isAvailable()).toBe(true);
  });

  it('get_starter_pack is available without authentication', () => {
    const { client } = mockClient({ authenticated: false });
    expect(new GetStarterPackTool(client).isAvailable()).toBe(true);
  });

  it('search_starter_packs uses the public request path when unauthenticated', async () => {
    const { client, executePublicRequest, executeAuthenticatedRequest } = mockClient({
      authenticated: false,
    });
    const tool = new SearchStarterPacksTool(client);

    await tool.handler({ q: 'typescript' });

    expect(executePublicRequest).toHaveBeenCalled();
    expect(executeAuthenticatedRequest).not.toHaveBeenCalled();
  });
});

describe('search_starter_packs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps results into the documented shape with pagination', async () => {
    const { client, searchStarterPacks } = mockClient();
    const tool = new SearchStarterPacksTool(client);

    const result = await tool.handler({ q: 'typescript' });

    expect(searchStarterPacks).toHaveBeenCalledWith({
      q: 'typescript',
      limit: 25,
      cursor: undefined,
    });
    expect(result.success).toBe(true);
    expect(result.starterPacks).toHaveLength(1);

    const pack = result.starterPacks[0];
    expect(pack.uri).toBe(PACK_URI);
    expect(pack.name).toBe('TypeScript Devs');
    expect(pack.description).toBe('Folks who write TypeScript');
    expect(pack.creator).toEqual({
      did: 'did:plc:creator',
      handle: 'creator.test',
      displayName: 'Creator',
      avatar: undefined,
    });
    expect(pack.listItemCount).toBe(42);
    expect(pack.joinedAllTimeCount).toBe(50);

    expect(result.cursor).toBe('page-2');
    expect(result.hasMore).toBe(true);
  });

  it('passes limit and cursor through', async () => {
    const { client, searchStarterPacks } = mockClient();
    const tool = new SearchStarterPacksTool(client);

    await tool.handler({ q: 'art', limit: 5, cursor: 'page-1' });

    expect(searchStarterPacks).toHaveBeenCalledWith({ q: 'art', limit: 5, cursor: 'page-1' });
  });
});

describe('get_starter_pack', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches by at:// URI and maps the full view', async () => {
    const { client, getStarterPack, resolveHandle } = mockClient();
    const tool = new GetStarterPackTool(client);

    const result = await tool.handler({ starterPack: PACK_URI });

    expect(resolveHandle).not.toHaveBeenCalled();
    expect(getStarterPack).toHaveBeenCalledWith({ starterPack: PACK_URI });
    expect(result.success).toBe(true);

    const pack = result.starterPack;
    expect(pack.uri).toBe(PACK_URI);
    expect(pack.name).toBe('TypeScript Devs');
    expect(pack.description).toBe('Folks who write TypeScript');
    expect(pack.creator.did).toBe('did:plc:creator');
    expect(pack.list).toEqual({
      uri: 'at://did:plc:creator/app.bsky.graph.list/3klist',
      cid: 'bafylist',
      name: 'TypeScript Devs list',
      purpose: 'app.bsky.graph.defs#referencelist',
      avatar: undefined,
      listItemCount: 42,
    });
    expect(pack.sampleProfiles).toHaveLength(1);
    expect(pack.sampleProfiles[0]).toEqual({
      did: 'did:plc:member1',
      handle: 'member1.test',
      displayName: 'Member One',
      description: 'first member',
      avatar: 'https://cdn.test/avatar1.jpg',
    });
    expect(pack.feeds).toHaveLength(1);
    expect(pack.feeds[0].displayName).toBe('TS Feed');
    expect(pack.feeds[0].likeCount).toBe(7);
    expect(pack.joinedWeekCount).toBe(5);
    expect(pack.joinedAllTimeCount).toBe(50);
    expect(pack.indexedAt).toBe('2026-01-02T00:00:00.000Z');
  });

  it('resolves a bsky.app starter-pack link with a handle to an at:// URI', async () => {
    const { client, getStarterPack, resolveHandle } = mockClient();
    const tool = new GetStarterPackTool(client);

    await tool.handler({ starterPack: 'https://bsky.app/starter-pack/creator.test/3kpack' });

    expect(resolveHandle).toHaveBeenCalledWith({ handle: 'creator.test' });
    expect(getStarterPack).toHaveBeenCalledWith({ starterPack: PACK_URI });
  });

  it('accepts a bsky.app link that already contains a DID without resolving', async () => {
    const { client, getStarterPack, resolveHandle } = mockClient();
    const tool = new GetStarterPackTool(client);

    await tool.handler({ starterPack: 'https://bsky.app/starter-pack/did:plc:creator/3kpack' });

    expect(resolveHandle).not.toHaveBeenCalled();
    expect(getStarterPack).toHaveBeenCalledWith({ starterPack: PACK_URI });
  });

  it('accepts the legacy /start/ link form', async () => {
    const { client, getStarterPack } = mockClient();
    const tool = new GetStarterPackTool(client);

    await tool.handler({ starterPack: 'https://bsky.app/start/did:plc:creator/3kpack' });

    expect(getStarterPack).toHaveBeenCalledWith({ starterPack: PACK_URI });
  });

  it('rejects at:// URIs for other collections', async () => {
    const { client, getStarterPack } = mockClient();
    const tool = new GetStarterPackTool(client);

    await expect(
      tool.handler({ starterPack: 'at://did:plc:creator/app.bsky.graph.list/3klist' })
    ).rejects.toThrow(/app\.bsky\.graph\.starterpack/);
    expect(getStarterPack).not.toHaveBeenCalled();
  });

  it('rejects unrecognized links', async () => {
    const { client, getStarterPack } = mockClient();
    const tool = new GetStarterPackTool(client);

    await expect(
      tool.handler({ starterPack: 'https://example.com/starter-pack/creator.test/3kpack' })
    ).rejects.toThrow();
    expect(getStarterPack).not.toHaveBeenCalled();
  });
});
