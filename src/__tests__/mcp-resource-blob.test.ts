/**
 * resources/read content passthrough: binary resources must be returned as
 * base64 `blob` contents per the MCP resource content schema, not silently
 * coerced to empty text. Text resources keep using `text`.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import type * as ResourcesModule from '../resources/index.js';
import { AtpMcpServer } from '../index.js';

const fixtures = vi.hoisted(() => ({
  blobBytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]),
}));

vi.mock('../utils/atp-client.js', () => ({
  AtpClient: vi.fn().mockImplementation(function () {
    return {
      initialize: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockResolvedValue(undefined),
      isAuthenticated: vi.fn().mockReturnValue(true),
    };
  }),
}));

// Replace the real resources with one binary and one text fixture so the
// resources/read handler's content mapping is exercised for both shapes.
// Plain async functions (not vi.fn) so the global beforeEach mock reset does
// not strip their implementations between tests. The real resolveResourceUri
// (and the other template exports) are kept via importOriginal; templates are
// stubbed empty so only the fixtures resolve.
vi.mock('../resources/index.js', async importOriginal => ({
  ...(await importOriginal<typeof ResourcesModule>()),
  createResourceTemplates: () => [],
  createResources: () => [
    {
      uri: 'atproto://test-blob',
      name: 'Test Blob',
      description: 'Binary fixture resource',
      mimeType: 'image/png',
      isAvailable: async () => true,
      read: async () => ({
        uri: 'atproto://test-blob',
        mimeType: 'image/png',
        blob: fixtures.blobBytes,
      }),
    },
    {
      uri: 'atproto://test-text',
      name: 'Test Text',
      description: 'Text fixture resource',
      mimeType: 'application/json',
      isAvailable: async () => true,
      read: async () => ({
        uri: 'atproto://test-text',
        mimeType: 'application/json',
        text: '{"ok":true}',
      }),
    },
  ],
}));

// Capture registered request handlers keyed by the method literal each Zod
// schema accepts. The schemas come from two zod generations (our zod v3
// objects and the SDK's bundled schemas), so probe by parsing candidate
// requests instead of poking at version-specific internals.
const mockHandlers = new Map<string, (request: unknown) => Promise<any>>();
const candidateMethods = [
  'tools/list',
  'tools/call',
  'resources/list',
  'resources/templates/list',
  'resources/read',
  'prompts/list',
  'prompts/get',
];
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(function () {
    return {
      setRequestHandler: vi.fn((schema: any, handler: (request: unknown) => Promise<any>) => {
        for (const method of candidateMethods) {
          try {
            schema.parse({ method, params: { uri: 'x', name: 'x' } });
            mockHandlers.set(method, handler);
            break;
          } catch {
            // Schema rejects this method literal; try the next candidate.
          }
        }
      }),
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
  }),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

describe('resources/read content passthrough', () => {
  beforeAll(() => {
    new AtpMcpServer({
      atproto: {
        service: 'https://bsky.social',
        authMethod: 'app-password',
        identifier: 'test.bsky.social',
        password: 'test-password',
      },
    });
  });

  it('returns binary resource content as base64 blob, not empty text', async () => {
    const handler = mockHandlers.get('resources/read');
    expect(handler).toBeDefined();

    const result = await handler!({ params: { uri: 'atproto://test-blob' } });

    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].uri).toBe('atproto://test-blob');
    expect(result.contents[0].mimeType).toBe('image/png');
    expect(result.contents[0].blob).toBe(Buffer.from(fixtures.blobBytes).toString('base64'));
    // BlobResourceContents must not carry a text field.
    expect(result.contents[0]).not.toHaveProperty('text');
  });

  it('returns text resource content as text without a blob field', async () => {
    const handler = mockHandlers.get('resources/read');

    const result = await handler!({ params: { uri: 'atproto://test-text' } });

    expect(result.contents[0].text).toBe('{"ok":true}');
    expect(result.contents[0]).not.toHaveProperty('blob');
  });
});
