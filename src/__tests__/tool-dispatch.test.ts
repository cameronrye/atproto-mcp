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

  it('routes tools/call to an early-registered tool (not just the last one)', async () => {
    await connect();
    // get_user_profile is registered near the top of createTools(). With the
    // dispatch bug, only the LAST tool (extract_media_from_post) is reachable and
    // this call is rejected by a literal-name schema mismatch instead of routing
    // to get_user_profile. A correct router reaches the tool, whose own validation
    // then complains about the missing required `actor` argument.
    await expect(client.callTool({ name: 'get_user_profile', arguments: {} })).rejects.toThrow(
      /actor/i
    );
  });

  it('routes tools/call to multiple distinct tools (never the literal-mismatch parse error)', async () => {
    await connect();
    // Each of these errors deterministically without a network call: get_user_profile
    // fails validation (missing actor); the write tools are unavailable in
    // unauthenticated mode. The point is that every one is REACHED — pre-fix, every
    // non-last tool was instead rejected with a Zod literal mismatch against the only
    // surviving handler (`expected "extract_media_from_post"`).
    for (const name of ['get_user_profile', 'create_post', 'like_post', 'block_user']) {
      let message = '';
      try {
        await client.callTool({ name, arguments: {} });
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message, `${name} should have produced an error`).not.toBe('');
      expect(message, `${name} was rejected by the wrong (last-tool) handler`).not.toMatch(
        /invalid_literal|expected.*extract_media_from_post/i
      );
    }
  });

  it('returns a clear error for an unknown tool name', async () => {
    await connect();
    await expect(client.callTool({ name: 'definitely_not_a_real_tool', arguments: {} })).rejects.toThrow(
      /unknown tool|not found|definitely_not_a_real_tool/i
    );
  });
});
