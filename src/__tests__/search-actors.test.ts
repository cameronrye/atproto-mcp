/**
 * Unit tests for SearchActorsTool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchActorsTool } from '../tools/implementations/search-actors-tool.js';
import type { AtpClient } from '../utils/atp-client.js';

const createMockAtpClient = () => {
  const searchActors = vi.fn().mockResolvedValue({
    data: {
      actors: [
        {
          did: 'did:plc:alice',
          handle: 'alice.bsky.social',
          displayName: 'Alice Smith',
          description: 'Just a test account',
          avatar: 'https://cdn.bsky.app/img/avatar/alice.jpg',
        },
        {
          did: 'did:plc:bob',
          handle: 'bob.bsky.social',
          displayName: 'Bob Jones',
          description: undefined,
          avatar: undefined,
        },
      ],
      cursor: 'cursor-page-2',
    },
  });

  const mockAgent = {
    app: {
      bsky: {
        actor: {
          searchActors,
        },
      },
    },
  };

  const client = {
    getAgent: vi.fn().mockReturnValue(mockAgent),
    isAuthenticated: vi.fn().mockReturnValue(false),
    hasCredentials: vi.fn().mockReturnValue(false),
    executeAuthenticatedRequest: vi.fn().mockImplementation(async (operation: () => unknown) => {
      try {
        return { success: true, data: await operation() };
      } catch (error) {
        return { success: false, error };
      }
    }),
    executePublicRequest: vi.fn().mockImplementation(async (operation: () => unknown) => {
      try {
        return { success: true, data: await operation() };
      } catch (error) {
        return { success: false, error };
      }
    }),
  } as unknown as AtpClient;

  return { client, searchActors };
};

describe('SearchActorsTool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes query, limit, and cursor to the API', async () => {
    const { client, searchActors } = createMockAtpClient();
    const tool = new SearchActorsTool(client);

    await tool.handler({ query: 'alice', limit: 10, cursor: 'some-cursor' });

    expect(searchActors).toHaveBeenCalledOnce();
    const callArgs = searchActors.mock.calls[0]![0];
    expect(callArgs.q).toBe('alice');
    expect(callArgs.limit).toBe(10);
    expect(callArgs.cursor).toBe('some-cursor');
  });

  it('maps actors to { did, handle, displayName, description, avatar }', async () => {
    const { client } = createMockAtpClient();
    const tool = new SearchActorsTool(client);

    const result = await tool.handler({ query: 'alice' });

    expect(result.success).toBe(true);
    expect(result.actors).toHaveLength(2);

    expect(result.actors[0]).toEqual({
      did: 'did:plc:alice',
      handle: 'alice.bsky.social',
      displayName: 'Alice Smith',
      description: 'Just a test account',
      avatar: 'https://cdn.bsky.app/img/avatar/alice.jpg',
    });

    expect(result.actors[1]).toEqual({
      did: 'did:plc:bob',
      handle: 'bob.bsky.social',
      displayName: 'Bob Jones',
      description: undefined,
      avatar: undefined,
    });
  });

  it('returns cursor from the API response', async () => {
    const { client } = createMockAtpClient();
    const tool = new SearchActorsTool(client);

    const result = await tool.handler({ query: 'alice' });

    expect(result.cursor).toBe('cursor-page-2');
  });

  it('uses default limit of 25 when not provided', async () => {
    const { client, searchActors } = createMockAtpClient();
    const tool = new SearchActorsTool(client);

    await tool.handler({ query: 'test' });

    expect(searchActors.mock.calls[0]![0].limit).toBe(25);
  });

  it('omits cursor from API call when not provided', async () => {
    const { client, searchActors } = createMockAtpClient();
    const tool = new SearchActorsTool(client);

    await tool.handler({ query: 'test' });

    expect(searchActors.mock.calls[0]![0].cursor).toBeUndefined();
  });

  it('returns empty actors array with no cursor when API returns empty results', async () => {
    const { client, searchActors } = createMockAtpClient();
    searchActors.mockResolvedValueOnce({ data: { actors: [], cursor: undefined } });
    const tool = new SearchActorsTool(client);

    const result = await tool.handler({ query: 'nonexistent' });

    expect(result.success).toBe(true);
    expect(result.actors).toHaveLength(0);
    expect(result.cursor).toBeUndefined();
  });
});
