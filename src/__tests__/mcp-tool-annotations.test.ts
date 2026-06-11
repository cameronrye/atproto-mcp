/**
 * tools/list must advertise explicit, accurate MCP annotation hints.
 *
 * Per MCP spec defaults, clients treat a non-read-only tool with omitted
 * hints as destructive AND non-idempotent, so every write tool must carry an
 * explicit destructiveHint and idempotentHint, and the values must match the
 * verified behavior of each implementation.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AtpMcpServer } from '../index.js';

vi.mock('../utils/atp-client.js', () => ({
  AtpClient: vi.fn().mockImplementation(function () {
    return {
      initialize: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockResolvedValue(undefined),
      isAuthenticated: vi.fn().mockReturnValue(true),
    };
  }),
}));

// Capture registered request handlers; probe each schema by parsing candidate
// requests so both our zod v3 schemas and the SDK's bundled schemas resolve.
const mockHandlers = new Map<string, (request?: unknown) => Promise<any>>();
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
      setRequestHandler: vi.fn((schema: any, handler: (request?: unknown) => Promise<any>) => {
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

interface IAdvertisedAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

describe('tools/list annotations', () => {
  let tools: Array<{ name: string; annotations: IAdvertisedAnnotations }>;

  beforeAll(async () => {
    new AtpMcpServer({
      atproto: {
        service: 'https://bsky.social',
        authMethod: 'app-password',
        identifier: 'test.bsky.social',
        password: 'test-password',
      },
    });
    const handler = mockHandlers.get('tools/list');
    expect(handler).toBeDefined();
    tools = (await handler!()).tools;
  });

  const annotationsFor = (name: string): IAdvertisedAnnotations => {
    const tool = tools.find(t => t.name === name);
    expect(tool, `tool ${name} should be listed`).toBeDefined();
    return tool!.annotations;
  };

  it('marks pure read tools read-only without write hints', () => {
    for (const name of ['get_timeline', 'search_posts', 'get_user_profile', 'analyze_account']) {
      const annotations = annotationsFor(name);
      expect(annotations.readOnlyHint, name).toBe(true);
      // destructive/idempotent hints are only meaningful for write tools.
      expect(annotations, name).not.toHaveProperty('destructiveHint');
      expect(annotations, name).not.toHaveProperty('idempotentHint');
    }
  });

  it('marks reversible additive writes as non-destructive', () => {
    for (const name of ['create_post', 'like_post', 'follow_user', 'mute_user', 'repost']) {
      expect(annotationsFor(name).destructiveHint, name).toBe(false);
    }
  });

  it('marks deleting/removing/overwriting writes as destructive', () => {
    for (const name of [
      'delete_post',
      'remove_from_list',
      'block_user',
      'unfollow_user',
      'unlike_post',
      'unrepost',
      'unmute_user',
      'unblock_user',
      'update_profile',
      'report_user',
    ]) {
      expect(annotationsFor(name).destructiveHint, name).toBe(true);
    }
  });

  it('claims idempotency only for verified dedup/no-op paths', () => {
    // These implementations dedup via authoritative viewer state or resolve
    // repeats to an explicit no-op.
    for (const name of ['like_post', 'follow_user', 'unblock_user', 'remove_from_list']) {
      expect(annotationsFor(name).idempotentHint, name).toBe(true);
    }
    // repost is NOT idempotent at the tool level: quote text creates a new
    // post on every call even though plain reposts dedup.
    expect(annotationsFor('repost').idempotentHint).toBe(false);
    expect(annotationsFor('create_post').idempotentHint).toBe(false);
  });

  it('carries explicit write hints for every non-read-only tool', () => {
    for (const tool of tools) {
      const annotations = tool.annotations;
      expect(annotations.openWorldHint, tool.name).toBe(true);
      if (annotations.readOnlyHint !== true) {
        expect(typeof annotations.destructiveHint, `${tool.name} destructiveHint`).toBe('boolean');
        expect(typeof annotations.idempotentHint, `${tool.name} idempotentHint`).toBe('boolean');
      }
    }
  });
});
