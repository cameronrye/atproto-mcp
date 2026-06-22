/**
 * Shared mock for the MCP SDK Server, used by tests that need to capture the
 * request handlers AtpMcpServer registers (tools/list, tools/call, ...)
 * without going through a real transport.
 *
 * setRequestHandler sniffs the Zod request schema it is given to recover the
 * MCP method name, then records the handler in a Map keyed by that method so
 * tests can invoke handlers directly.
 *
 * Usage (the vi.mock call must stay in the test file so vitest hoists it):
 *
 *   const { mockHandlers, mockServer } = createSchemaSniffingMockServer();
 *   vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
 *     // Must be a `function` expression: the SDK Server is constructed with
 *     // `new`, and arrow functions are not constructable.
 *     Server: vi.fn().mockImplementation(function () {
 *       return mockServer;
 *     }),
 *   }));
 */

import { type Mock, vi } from 'vitest';

/**
 * MCP request handlers receive the JSON-RPC request (or nothing for list
 * handlers) and return the result. The `any` return is deliberate: tests poke
 * at arbitrary fields of each handler's result.
 */
export type McpRequestHandler = (request?: { params?: Record<string, unknown> }) => any;

export interface IMockMcpServer {
  setRequestHandler: Mock;
  connect: Mock;
  close: Mock;
}

export function createSchemaSniffingMockServer(): {
  mockHandlers: Map<string, McpRequestHandler>;
  mockServer: IMockMcpServer;
} {
  const mockHandlers = new Map<string, McpRequestHandler>();

  const mockServer = {
    setRequestHandler: vi.fn((schema: any, handler: McpRequestHandler) => {
      // Extract method from Zod schema structure
      let method: string | undefined;

      // Recover the MCP method name from the request schema. MCP request
      // schemas are `z.object({ method: z.literal('<method>'), ... })` (or, for
      // a few SDK schemas, the method literal directly). Read the literal via
      // zod's public accessors `.shape` and `.value` instead of the private
      // `_def` internals the previous sniffer used: zod v4 restructured those
      // internals (`_def.shape()` / `_def.value` no longer exist), but the
      // public `.shape`/`.value` accessors are stable across zod v3 and v4.
      try {
        const methodSchema = schema?.shape?.method ?? schema;
        const value: unknown = methodSchema?.value;
        if (typeof value === 'string' && value.length > 0) {
          method = value;
        }
      } catch {
        // Unknown schema shape — leave the handler unregistered.
      }

      if (method) {
        mockHandlers.set(method, handler);
      }
    }),
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return { mockHandlers, mockServer };
}
