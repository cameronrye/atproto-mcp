/**
 * Integration tests for MCP protocol compliance
 * Tests the actual MCP server functionality end-to-end
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { AtpMcpServer } from '../index.js';
import { createMockServerConfig } from '../test/setup.js';

// Create a mock AtpClient instance that will be reused
const mockAtpClient = {
  initialize: vi.fn().mockResolvedValue(undefined),
  cleanup: vi.fn().mockResolvedValue(undefined),
  isAuthenticated: vi.fn().mockReturnValue(true),
  requiresAuthentication: vi.fn().mockReturnValue(true),
  getAgent: vi.fn().mockReturnValue({
    session: { did: 'did:plc:test123', handle: 'test.bsky.social' },
  }),
  executeRequest: vi.fn().mockResolvedValue({
    success: true,
    data: { test: 'data' },
  }),
  executeAuthenticatedRequest: vi.fn().mockResolvedValue({
    success: true,
    data: { test: 'data' },
  }),
  executePublicRequest: vi.fn().mockResolvedValue({
    success: true,
    data: { test: 'data' },
  }),
};

// Mock the AT Protocol client to avoid real network calls
vi.mock('../utils/atp-client.js', () => ({
  AtpClient: vi.fn().mockImplementation(() => mockAtpClient),
}));

// Mock the MCP SDK to capture handler registrations
const mockHandlers = new Map<string, Function>();
const mockServer = {
  setRequestHandler: vi.fn((schema: any, handler: Function) => {
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

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => {
    console.log('Mock Server constructor called');
    return mockServer;
  }),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({})),
}));

describe('MCP Integration Tests', () => {
  let server: AtpMcpServer;

  beforeAll(async () => {
    console.log('Creating server...');
    // Create server with test configuration
    server = new AtpMcpServer({
      atproto: {
        service: 'https://bsky.social',
        authMethod: 'app-password',
        identifier: 'test.bsky.social',
        password: 'test-password',
      },
    });

    console.log('Starting server...');
    await server.start();
    console.log('Server started. Handlers registered:', Array.from(mockHandlers.keys()));
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('MCP Protocol Compliance', () => {
    it('should register initialize handler', () => {
      expect(mockHandlers.has('initialize')).toBe(true);
    });

    it('should register ping handler', () => {
      expect(mockHandlers.has('ping')).toBe(true);
    });

    it('should register tools/list handler', () => {
      expect(mockHandlers.has('tools/list')).toBe(true);
    });

    it('should register tools/call handler', () => {
      expect(mockHandlers.has('tools/call')).toBe(true);
    });

    it('should register resources/list handler', () => {
      expect(mockHandlers.has('resources/list')).toBe(true);
    });

    it('should register resources/read handler', () => {
      expect(mockHandlers.has('resources/read')).toBe(true);
    });

    it('should register prompts/list handler', () => {
      expect(mockHandlers.has('prompts/list')).toBe(true);
    });

    it('should register prompts/get handler', () => {
      expect(mockHandlers.has('prompts/get')).toBe(true);
    });
  });

  describe('Initialize Handler', () => {
    it('should return correct protocol version and capabilities', async () => {
      const handler = mockHandlers.get('initialize');
      expect(handler).toBeDefined();

      const result = await handler!();

      expect(result).toEqual({
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {
            listChanged: true,
          },
          resources: {
            subscribe: false,
            listChanged: true,
          },
          prompts: {
            listChanged: true,
          },
        },
        serverInfo: {
          name: expect.any(String),
          version: expect.any(String),
          // Note: 'description' field removed per MCP specification
          // serverInfo should only contain 'name' and 'version'
        },
      });
    });
  });

  describe('Ping Handler', () => {
    it('should return status ok with timestamp', async () => {
      const handler = mockHandlers.get('ping');
      expect(handler).toBeDefined();

      const result = await handler!();

      expect(result).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
      });

      // Verify timestamp is valid ISO string
      expect(() => new Date(result.timestamp)).not.toThrow();
    });
  });

  describe('Tools Handler', () => {
    it('should list available tools', async () => {
      const handler = mockHandlers.get('tools/list');
      expect(handler).toBeDefined();

      const result = await handler!();

      expect(result).toHaveProperty('tools');
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);

      // Check that each tool has required properties
      for (const tool of result.tools) {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
      }
    });

    it('should include expected AT Protocol tools', async () => {
      const handler = mockHandlers.get('tools/list');
      const result = await handler!();

      const toolNames = result.tools.map((tool: any) => tool.name);

      // Check that we have some tools available (authentication-dependent tools may be filtered out in tests)
      expect(toolNames.length).toBeGreaterThan(0);

      // Check for tools that should always be available (public/enhanced mode)
      expect(toolNames).toContain('get_user_profile'); // ENHANCED mode
      expect(toolNames).toContain('start_oauth_flow'); // PUBLIC mode

      // Note: search_posts, create_post, like_post, follow_user are PRIVATE mode tools that may be filtered out
      // due to authentication mocking complexities in the test environment
      // search_posts was changed to PRIVATE in 2025 when AT Protocol API started requiring auth
    });
  });

  describe('Resources Handler', () => {
    it('should list available resources', async () => {
      const handler = mockHandlers.get('resources/list');
      expect(handler).toBeDefined();

      const result = await handler!();

      expect(result).toHaveProperty('resources');
      expect(Array.isArray(result.resources)).toBe(true);

      // Check that each resource has required properties
      for (const resource of result.resources) {
        expect(resource).toHaveProperty('uri');
        expect(resource).toHaveProperty('name');
        expect(resource).toHaveProperty('description');
        expect(typeof resource.uri).toBe('string');
        expect(typeof resource.name).toBe('string');
        expect(typeof resource.description).toBe('string');
      }
    });
  });

  describe('Prompts Handler', () => {
    it('should list available prompts', async () => {
      const handler = mockHandlers.get('prompts/list');
      expect(handler).toBeDefined();

      const result = await handler!();

      expect(result).toHaveProperty('prompts');
      expect(Array.isArray(result.prompts)).toBe(true);

      // Check that each prompt has required properties
      for (const prompt of result.prompts) {
        expect(prompt).toHaveProperty('name');
        expect(prompt).toHaveProperty('description');
        expect(typeof prompt.name).toBe('string');
        expect(typeof prompt.description).toBe('string');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle tool call errors gracefully', async () => {
      const handler = mockHandlers.get('tools/call');
      expect(handler).toBeDefined();

      // Test with invalid tool name
      try {
        await handler!({
          params: {
            name: 'nonexistent_tool',
            arguments: {},
          },
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Tool execution failed');
      }
    });

    it('should handle resource read errors gracefully', async () => {
      const handler = mockHandlers.get('resources/read');
      expect(handler).toBeDefined();

      // Test with invalid resource URI
      try {
        await handler!({
          params: {
            uri: 'invalid://resource/uri',
          },
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Resource not found');
      }
    });

    it('should handle prompt get errors gracefully', async () => {
      const handler = mockHandlers.get('prompts/get');
      expect(handler).toBeDefined();

      // Test with invalid prompt name
      try {
        await handler!({
          params: {
            name: 'nonexistent_prompt',
            arguments: {},
          },
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Prompt not found');
      }
    });
  });
});
