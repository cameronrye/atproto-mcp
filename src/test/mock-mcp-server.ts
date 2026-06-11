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

      // Try to parse the schema to extract the method
      try {
        // For z.object({ method: z.literal('method_name') })
        if (schema._def?.shape && typeof schema._def.shape === 'function') {
          const shape = schema._def.shape();
          if (shape.method?._def?.value) {
            method = shape.method._def.value;
          }
        }
        // For z.literal('method_name')
        else if (schema._def?.value) {
          method = schema._def.value;
        }
        // Try to parse the schema by calling it with test data
        else {
          const testData = { method: 'test' };
          try {
            schema.parse(testData);
            // If it parses successfully, it might be expecting a method field
            // Let's try common MCP methods
            const mcpMethods = [
              'initialize',
              'ping',
              'tools/list',
              'tools/call',
              'resources/list',
              'resources/read',
              'prompts/list',
              'prompts/get',
            ];
            for (const mcpMethod of mcpMethods) {
              try {
                schema.parse({ method: mcpMethod });
                method = mcpMethod;
                break;
              } catch {
                // Continue trying
              }
            }
          } catch {
            // Schema doesn't accept our test data
          }
        }
      } catch (error) {
        console.log('Error parsing schema:', error);
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
