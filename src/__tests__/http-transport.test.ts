/**
 * End-to-end tests for the Streamable HTTP transport.
 *
 * Starts a real AtpMcpServer (unauthenticated mode — no network calls) on an
 * ephemeral loopback port and exercises the /mcp endpoint over fetch with raw
 * JSON-RPC, per the MCP Streamable HTTP spec:
 *   - POST initialize -> mcp-session-id response header + initialize result
 *   - POST tools/list on the established session
 *   - DELETE to terminate the session
 *   - protocol-level rejections (missing/unknown session, non-/mcp paths,
 *     forged Host headers, oversized bodies)
 *
 * Responses to POSTed requests arrive as SSE streams (the SDK default), so the
 * helpers below parse `data:` events as well as plain JSON bodies.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { request as httpRequest } from 'node:http';
import { AtpMcpServer } from '../index.js';

const PROTOCOL_VERSION = '2025-06-18';

/** Headers every Streamable HTTP POST must carry. */
const POST_HEADERS: Record<string, string> = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
};

interface IJsonRpcMessage {
  jsonrpc: string;
  id?: number | string | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

function initializeRequestBody(id: number): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id,
    method: 'initialize',
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'http-transport-test', version: '1.0.0' },
    },
  };
}

/**
 * Read a single JSON-RPC message out of a Streamable HTTP response. The SDK
 * answers POSTed requests with an SSE stream by default (closed once the
 * response is sent), or with plain JSON when enableJsonResponse is on.
 */
async function readJsonRpcMessage(response: Response): Promise<IJsonRpcMessage> {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  if (contentType.includes('text/event-stream')) {
    const dataLines = text
      .split('\n')
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice('data:'.length).trim())
      .filter(line => line !== '');
    const last = dataLines[dataLines.length - 1];
    if (last === undefined) {
      throw new Error(`SSE response contained no data events: ${text}`);
    }
    return JSON.parse(last) as IJsonRpcMessage;
  }
  return JSON.parse(text) as IJsonRpcMessage;
}

describe('Streamable HTTP transport', () => {
  let server: AtpMcpServer;
  let baseUrl: string;

  beforeAll(async () => {
    // Force unauthenticated mode so startup performs no network calls.
    for (const key of [
      'ATPROTO_SERVICE',
      'ATPROTO_IDENTIFIER',
      'ATPROTO_PASSWORD',
      'ATPROTO_AUTH_METHOD',
      'ATPROTO_CLIENT_ID',
      'ATPROTO_CLIENT_SECRET',
    ]) {
      delete process.env[key];
    }

    server = new AtpMcpServer();
    // Port 0 = ephemeral port; the OS picks a free one.
    await server.start({ transport: 'http', port: 0, host: '127.0.0.1' });

    const address = server.getHttpAddress();
    if (!address) {
      throw new Error('HTTP server did not report a bound address');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await server.stop();
  });

  /** Run the initialize handshake and return the negotiated session id. */
  async function initializeSession(): Promise<string> {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: POST_HEADERS,
      body: JSON.stringify(initializeRequestBody(1)),
    });
    expect(response.status).toBe(200);

    const sessionId = response.headers.get('mcp-session-id');
    if (sessionId == null || sessionId === '') {
      throw new Error('initialize response did not include an mcp-session-id header');
    }
    const message = await readJsonRpcMessage(response);
    expect(message.error).toBeUndefined();

    // Complete the handshake; notifications are acknowledged with 202.
    const initialized = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { ...POST_HEADERS, 'mcp-session-id': sessionId },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });
    expect(initialized.status).toBe(202);

    return sessionId;
  }

  it('completes the initialize handshake with a session id header and initialize result', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: POST_HEADERS,
      body: JSON.stringify(initializeRequestBody(1)),
    });

    expect(response.status).toBe(200);

    // Stateful mode: the server must mint a session id and return it in the
    // mcp-session-id response header.
    const sessionId = response.headers.get('mcp-session-id');
    expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    const message = await readJsonRpcMessage(response);
    expect(message.id).toBe(1);
    expect(message.error).toBeUndefined();
    const result = message.result as {
      protocolVersion: string;
      serverInfo: { name: string; version: string };
      capabilities: Record<string, unknown>;
    };
    expect(result.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(result.serverInfo.name).toBe('atproto-mcp');
    expect(result.capabilities).toHaveProperty('tools');
  });

  it('serves tools/list on an established session', async () => {
    const sessionId = await initializeSession();

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        ...POST_HEADERS,
        'mcp-session-id': sessionId,
        'mcp-protocol-version': PROTOCOL_VERSION,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    });

    expect(response.status).toBe(200);
    const message = await readJsonRpcMessage(response);
    expect(message.id).toBe(2);
    const tools = (message.result as { tools: Array<{ name: string }> }).tools;
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.map(t => t.name)).toContain('search_posts');
  });

  it('isolates sessions: each initialize mints a distinct session id', async () => {
    const first = await initializeSession();
    const second = await initializeSession();
    expect(first).not.toBe(second);
  });

  it('terminates a session via DELETE and rejects subsequent requests with 404', async () => {
    const sessionId = await initializeSession();

    const deleteResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'DELETE',
      headers: { 'mcp-session-id': sessionId },
    });
    expect(deleteResponse.status).toBe(200);
    await deleteResponse.text();

    const afterDelete = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { ...POST_HEADERS, 'mcp-session-id': sessionId },
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list' }),
    });
    expect(afterDelete.status).toBe(404);
    await afterDelete.text();
  });

  it('rejects non-initialize POSTs without a session id with 400', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: POST_HEADERS,
      body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/list' }),
    });
    expect(response.status).toBe(400);
    await response.text();
  });

  it('rejects unknown session ids with 404', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { ...POST_HEADERS, 'mcp-session-id': '00000000-0000-4000-8000-000000000000' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'tools/list' }),
    });
    expect(response.status).toBe(404);
    await response.text();
  });

  it('rejects GET requests without a session id with 400', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      headers: { accept: 'text/event-stream' },
    });
    expect(response.status).toBe(400);
    await response.text();
  });

  it('opens a standalone SSE stream on GET for an established session', async () => {
    const sessionId = await initializeSession();

    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/mcp`, {
      headers: {
        accept: 'text/event-stream',
        'mcp-session-id': sessionId,
        'mcp-protocol-version': PROTOCOL_VERSION,
      },
      signal: controller.signal,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    controller.abort();
    try {
      await response.body?.cancel();
    } catch {
      // Aborting may already have torn the body down.
    }
  });

  it('returns 404 for paths other than /mcp', async () => {
    const response = await fetch(`${baseUrl}/other`, {
      method: 'POST',
      headers: POST_HEADERS,
      body: JSON.stringify(initializeRequestBody(1)),
    });
    expect(response.status).toBe(404);
    await response.text();
  });

  it('rejects forged Host headers with 403 (DNS rebinding protection)', async () => {
    const { port } = server.getHttpAddress()!;
    const body = JSON.stringify(initializeRequestBody(1));

    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = httpRequest(
        {
          host: '127.0.0.1',
          port,
          path: '/mcp',
          method: 'POST',
          headers: {
            ...POST_HEADERS,
            // A DNS-rebinding attack presents an attacker-controlled Host
            // header while connecting to the loopback address.
            host: 'evil.example.com',
            'content-length': Buffer.byteLength(body),
          },
        },
        res => {
          res.resume();
          res.on('end', () => resolve(res.statusCode));
        }
      );
      req.on('error', reject);
      req.end(body);
    });

    expect(status).toBe(403);
  });

  it('rejects oversized request bodies with 413', async () => {
    // Just over the 4 MiB cap; the size guard must fire before JSON parsing.
    const oversized = 'x'.repeat(4 * 1024 * 1024 + 1);
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: POST_HEADERS,
      body: oversized,
    });
    expect(response.status).toBe(413);
    await response.text();
  });

  it('rejects malformed JSON bodies with 400', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: POST_HEADERS,
      body: '{not json',
    });
    expect(response.status).toBe(400);
    await response.text();
  });

  it('writes no protocol traffic to stdout', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write');
    try {
      const sessionId = await initializeSession();
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { ...POST_HEADERS, 'mcp-session-id': sessionId },
        body: JSON.stringify({ jsonrpc: '2.0', id: 6, method: 'tools/list' }),
      });
      expect(response.status).toBe(200);
      await response.text();

      const jsonRpcWrites = stdoutSpy.mock.calls.filter(call =>
        String(call[0]).includes('"jsonrpc"')
      );
      expect(jsonRpcWrites).toEqual([]);
    } finally {
      stdoutSpy.mockRestore();
    }
  });
});
