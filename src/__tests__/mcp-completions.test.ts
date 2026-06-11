/**
 * completion/complete end-to-end tests (real Server + in-memory transport).
 *
 * The server declares the `completions` capability and serves:
 * - ref/prompt: candidate values for enumerable prompt arguments (tone,
 *   length, reply_type, ...), prefix-filtered; free-text arguments complete
 *   to an empty list, never an error; unknown prompts are invalid params.
 * - ref/resource: the {actor} variable of the resource templates completes to
 *   the authenticated user's handle when a session exists, else empty.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AtpMcpServer } from '../index.js';

interface IMockSession {
  did: string;
  handle: string;
  active: boolean;
}

// Mutable session fixture: tests flip this to exercise the authenticated and
// unauthenticated completion paths.
const mockState = vi.hoisted(() => ({
  session: null as IMockSession | null,
}));

// A plain class with plain-function members (not vi.fn) so the global
// afterEach vi.resetAllMocks() cannot strip implementations between tests.
vi.mock('../utils/atp-client.js', () => ({
  AtpClient: class {
    initialize = async (): Promise<void> => undefined;
    cleanup = async (): Promise<void> => undefined;
    isAuthenticated = (): boolean => mockState.session?.active === true;
    hasCredentials = (): boolean => mockState.session !== null;
    getSession = (): IMockSession | null => mockState.session;
  },
}));

describe('completion/complete (real Server + in-memory transport)', () => {
  let server: AtpMcpServer;
  let client: Client;

  beforeEach(() => {
    mockState.session = { did: 'did:plc:self123', handle: 'tester.bsky.social', active: true };
  });

  afterEach(async () => {
    try {
      await client?.close();
    } catch {
      /* ignore */
    }
  });

  async function connect(): Promise<void> {
    server = new AtpMcpServer({ atproto: { service: 'https://bsky.social' } });
    void server;
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.getServer().connect(serverTransport);
    client = new Client({ name: 'completions-test-client', version: '1.0.0' });
    await client.connect(clientTransport);
  }

  it('declares the completions capability', async () => {
    await connect();
    expect(client.getServerCapabilities()?.completions).toBeDefined();
  });

  it('serves all candidates for an enumerable prompt argument on an empty value', async () => {
    await connect();
    const res = await client.complete({
      ref: { type: 'ref/prompt', name: 'content_composition' },
      argument: { name: 'tone', value: '' },
    });
    expect(res.completion.values).toEqual(['casual', 'professional', 'humorous', 'informative']);
    expect(res.completion.total).toBe(4);
    expect(res.completion.hasMore).toBe(false);
  });

  it('prefix-filters prompt argument candidates case-insensitively', async () => {
    await connect();
    const res = await client.complete({
      ref: { type: 'ref/prompt', name: 'content_composition' },
      argument: { name: 'tone', value: 'PRO' },
    });
    expect(res.completion.values).toEqual(['professional']);
  });

  it('serves candidates for every enumerable argument of both prompts', async () => {
    await connect();
    const expectations: Array<{ prompt: string; argument: string; values: string[] }> = [
      { prompt: 'content_composition', argument: 'length', values: ['short', 'medium', 'long'] },
      { prompt: 'content_composition', argument: 'include_hashtags', values: ['true', 'false'] },
      {
        prompt: 'reply_template',
        argument: 'reply_type',
        values: ['supportive', 'questioning', 'informative', 'humorous'],
      },
      {
        prompt: 'reply_template',
        argument: 'relationship',
        values: ['friend', 'colleague', 'stranger'],
      },
    ];
    for (const { prompt, argument, values } of expectations) {
      const res = await client.complete({
        ref: { type: 'ref/prompt', name: prompt },
        argument: { name: argument, value: '' },
      });
      expect(res.completion.values, `${prompt}.${argument}`).toEqual(values);
    }
  });

  it('returns an empty completion (not an error) for free-text prompt arguments', async () => {
    await connect();
    for (const [prompt, argument] of [
      ['content_composition', 'topic'],
      ['reply_template', 'original_post'],
    ] as const) {
      const res = await client.complete({
        ref: { type: 'ref/prompt', name: prompt },
        argument: { name: argument, value: 'decentralized' },
      });
      expect(res.completion.values, `${prompt}.${argument}`).toEqual([]);
      expect(res.completion.total, `${prompt}.${argument}`).toBe(0);
      expect(res.completion.hasMore, `${prompt}.${argument}`).toBe(false);
    }
  });

  it('returns an empty completion for an unknown argument of a known prompt', async () => {
    await connect();
    const res = await client.complete({
      ref: { type: 'ref/prompt', name: 'content_composition' },
      argument: { name: 'definitely_not_an_argument', value: '' },
    });
    expect(res.completion.values).toEqual([]);
  });

  it('rejects completion for an unknown prompt name', async () => {
    await connect();
    await expect(
      client.complete({
        ref: { type: 'ref/prompt', name: 'nonexistent_prompt' },
        argument: { name: 'tone', value: '' },
      })
    ).rejects.toThrow(/prompt not found/i);
  });

  it('completes the {actor} template variable with the session handle', async () => {
    await connect();
    for (const uriTemplate of ['atproto://profile/{actor}', 'atproto://feed/{actor}']) {
      const res = await client.complete({
        ref: { type: 'ref/resource', uri: uriTemplate },
        argument: { name: 'actor', value: '' },
      });
      expect(res.completion.values, uriTemplate).toEqual(['tester.bsky.social']);
      expect(res.completion.total, uriTemplate).toBe(1);
      expect(res.completion.hasMore, uriTemplate).toBe(false);
    }
  });

  it('prefix-filters the {actor} candidate against the typed value', async () => {
    await connect();
    const matching = await client.complete({
      ref: { type: 'ref/resource', uri: 'atproto://profile/{actor}' },
      argument: { name: 'actor', value: 'TESTER' },
    });
    expect(matching.completion.values).toEqual(['tester.bsky.social']);

    const nonMatching = await client.complete({
      ref: { type: 'ref/resource', uri: 'atproto://profile/{actor}' },
      argument: { name: 'actor', value: 'zzz' },
    });
    expect(nonMatching.completion.values).toEqual([]);
  });

  it('returns an empty {actor} completion without a session', async () => {
    mockState.session = null;
    await connect();
    const res = await client.complete({
      ref: { type: 'ref/resource', uri: 'atproto://profile/{actor}' },
      argument: { name: 'actor', value: '' },
    });
    expect(res.completion.values).toEqual([]);
    expect(res.completion.total).toBe(0);
  });

  it('returns an empty completion for unknown resource templates and arguments', async () => {
    await connect();
    const unknownTemplate = await client.complete({
      ref: { type: 'ref/resource', uri: 'atproto://unknown/{thing}' },
      argument: { name: 'thing', value: '' },
    });
    expect(unknownTemplate.completion.values).toEqual([]);

    const unknownArgument = await client.complete({
      ref: { type: 'ref/resource', uri: 'atproto://profile/{actor}' },
      argument: { name: 'not_actor', value: '' },
    });
    expect(unknownArgument.completion.values).toEqual([]);
  });
});
