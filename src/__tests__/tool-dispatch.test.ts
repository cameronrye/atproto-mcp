import { afterEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AtpMcpServer } from '../index.js';

/**
 * Real end-to-end dispatch tests.
 *
 * Unlike mcp-integration.test.ts (which mocks the SDK Server), these tests
 * connect a real MCP Client to the real Server over an in-memory transport and
 * exercise tools/list and tools/call through the actual SDK request-routing.
 *
 * This is the test that catches the "only the last-registered tool is callable"
 * dispatch bug: the SDK keys request handlers by method name only, so registering
 * one handler per tool under method 'tools/call' collapses to a single handler.
 */
describe('MCP tool dispatch (real Server + in-memory transport)', () => {
  let server: AtpMcpServer;
  let client: Client;

  afterEach(async () => {
    try {
      await client?.close();
    } catch {
      /* ignore */
    }
  });

  async function connect(): Promise<void> {
    server = new AtpMcpServer({ atproto: { service: 'https://bsky.social' } });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.getServer().connect(serverTransport);
    client = new Client({ name: 'dispatch-test-client', version: '1.0.0' });
    await client.connect(clientTransport);
  }

  it('lists every registered tool, not just one', async () => {
    await connect();
    const { tools } = await client.listTools();
    const names = tools.map(t => t.name);
    // Sanity: the server advertises dozens of tools.
    expect(tools.length).toBeGreaterThan(10);
    // A tool registered early, one in the middle, and the last one must all appear.
    expect(names).toContain('get_user_profile');
    expect(names).toContain('like_post');
    expect(names).toContain('extract_media_from_post');
  });

  it('advertises MCP safety annotations: destructive writes, read-only reads, open-world', async () => {
    await connect();
    const { tools } = await client.listTools();
    const byName = new Map(tools.map(t => [t.name, t]));

    // A destructive write is flagged so clients can gate auto-approval.
    expect(byName.get('delete_post')?.annotations?.destructiveHint).toBe(true);
    expect(byName.get('block_user')?.annotations?.destructiveHint).toBe(true);
    expect(byName.get('unfollow_user')?.annotations?.destructiveHint).toBe(true);

    // A pure read is flagged read-only and is NOT destructive.
    expect(byName.get('get_timeline')?.annotations?.readOnlyHint).toBe(true);
    expect(byName.get('get_timeline')?.annotations?.destructiveHint).toBeFalsy();

    // Every tool talks to a live network → open-world.
    expect(byName.get('create_post')?.annotations?.openWorldHint).toBe(true);
    // A plain write is neither read-only nor destructive.
    expect(byName.get('create_post')?.annotations?.readOnlyHint).toBeFalsy();
    expect(byName.get('create_post')?.annotations?.destructiveHint).toBeFalsy();
  });

  it('routes tools/call to an early-registered tool (not just the last one)', async () => {
    await connect();
    // get_user_profile is registered near the top of createTools(). With the
    // dispatch bug, only the LAST tool (extract_media_from_post) is reachable and
    // this call is rejected by a literal-name schema mismatch instead of routing
    // to get_user_profile. A correct router reaches the tool, whose own validation
    // then complains about the missing required `actor` argument. Per the MCP
    // contract, that execution/validation error comes back as an isError result,
    // not a JSON-RPC rejection.
    const res = await client.callTool({ name: 'get_user_profile', arguments: {} });
    expect(res.isError).toBe(true);
    expect(JSON.stringify(res.content)).toMatch(/actor/i);
  });

  it('routes tools/call to multiple distinct tools (never the literal-mismatch parse error)', async () => {
    await connect();
    // Each of these errors deterministically without a network call: get_user_profile
    // fails validation (missing actor); the write tools are unavailable in
    // unauthenticated mode. Both surface as isError tool results. The point is that
    // every one is REACHED — pre-fix, every non-last tool was instead rejected with a
    // Zod literal mismatch against the only surviving handler ("extract_media_from_post").
    for (const name of ['get_user_profile', 'create_post', 'like_post', 'block_user']) {
      const res = await client.callTool({ name, arguments: {} });
      const text = JSON.stringify(res.content);
      expect(res.isError, `${name} should have produced a tool-error result`).toBe(true);
      expect(text, `${name} was rejected by the wrong (last-tool) handler`).not.toMatch(
        /invalid_literal|expected.*extract_media_from_post/i
      );
    }
  });

  it('emits structuredContent alongside the text result for a successful call', async () => {
    await connect();
    // analyze_image is PUBLIC and performs no network call — it only inspects the
    // blob metadata supplied inline, so it succeeds in unauthenticated mode.
    const res = await client.callTool({
      name: 'analyze_image',
      arguments: {
        blob: { ref: { $link: 'bafkreitest' }, mimeType: 'image/jpeg', size: 102400 },
        includeOptimizationSuggestions: false,
      },
    });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toBeDefined();
    expect(typeof res.structuredContent).toBe('object');
    // The text content remains for LLM consumption.
    expect(Array.isArray(res.content)).toBe(true);
  });

  it('returns a clear error for an unknown tool name', async () => {
    await connect();
    await expect(
      client.callTool({ name: 'definitely_not_a_real_tool', arguments: {} })
    ).rejects.toThrow(/unknown tool|not found|definitely_not_a_real_tool/i);
  });
});
