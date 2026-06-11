/**
 * Tests for the main AT Protocol MCP Server
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { AtpMcpServer } from '../index.js';
import { createMockServerConfig, expectToThrow, mockConsole } from '../test/setup.js';

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(function () {
    return {
      setRequestHandler: vi.fn(),
      connect: vi.fn(),
      close: vi.fn(),
    };
  }),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(function () {
    return {};
  }),
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

vi.mock('../utils/config.js', () => ({
  ConfigManager: vi.fn().mockImplementation(function () {
    return {
      getConfig: vi.fn().mockReturnValue(createMockServerConfig()),
      getAtpConfig: vi.fn().mockReturnValue({
        service: 'https://bsky.social',
        authMethod: 'app-password',
        identifier: 'test.bsky.social',
        password: 'test-password',
      }),
      getAuthMode: vi.fn().mockReturnValue('app-password'),
      hasAuthentication: vi.fn().mockReturnValue(true),
    };
  }),
}));

describe('AtpMcpServer', () => {
  let mockServer: any;
  let mockAtpClient: any;
  let mockConfigManager: any;

  beforeEach(async () => {
    mockConsole();

    // Reset mocks
    vi.clearAllMocks();

    // Get mock instances
    const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
    const { AtpClient } = await import('../utils/atp-client.js');
    const { ConfigManager } = await import('../utils/config.js');

    mockServer = {
      setRequestHandler: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockAtpClient = {
      initialize: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockResolvedValue(undefined),
      isAuthenticated: vi.fn().mockReturnValue(true),
    };

    mockConfigManager = {
      getConfig: vi.fn().mockReturnValue(createMockServerConfig()),
      getAtpConfig: vi.fn().mockReturnValue({
        service: 'https://bsky.social',
        authMethod: 'app-password',
        identifier: 'test.bsky.social',
        password: 'test-password',
      }),
      getAuthMode: vi.fn().mockReturnValue('app-password'),
      hasAuthentication: vi.fn().mockReturnValue(true),
    };

    vi.mocked(Server).mockImplementation(function () {
      return mockServer;
    });
    vi.mocked(AtpClient).mockImplementation(function () {
      return mockAtpClient;
    });
    vi.mocked(ConfigManager).mockImplementation(function () {
      return mockConfigManager;
    });
  });

  describe('constructor', () => {
    it('should create server with default configuration', () => {
      const server = new AtpMcpServer();

      expect(server).toBeInstanceOf(AtpMcpServer);
      expect(mockConfigManager.getConfig).toHaveBeenCalled();
    });

    it('should create server with custom configuration', async () => {
      const customConfig = {
        port: 8080,
        name: 'custom-server',
      };

      const server = new AtpMcpServer(customConfig);

      expect(server).toBeInstanceOf(AtpMcpServer);
      const { ConfigManager } = await import('../utils/config.js');
      expect(vi.mocked(ConfigManager)).toHaveBeenCalledWith(customConfig);
    });

    it('should setup MCP server handlers', () => {
      new AtpMcpServer();

      // Check that setRequestHandler was called multiple times (for all the handlers)
      expect(mockServer.setRequestHandler).toHaveBeenCalled();
      expect(mockServer.setRequestHandler.mock.calls.length).toBeGreaterThan(5);

      // Verify that the first argument of each call is a Zod schema
      const calls = mockServer.setRequestHandler.mock.calls;
      calls.forEach((call: any[]) => {
        expect(call[0]).toHaveProperty('parse'); // Zod schemas have a parse method
        expect(call[1]).toBeTypeOf('function'); // Second argument should be a handler function
      });
    });
  });

  describe('start', () => {
    it('should start server successfully', async () => {
      const server = new AtpMcpServer();

      await server.start();

      expect(mockAtpClient.initialize).toHaveBeenCalled();
      expect(mockServer.connect).toHaveBeenCalled();
    });

    it('should not start if already running', async () => {
      const server = new AtpMcpServer();

      await server.start();
      await server.start(); // Second call

      expect(mockAtpClient.initialize).toHaveBeenCalledTimes(1);
      expect(mockServer.connect).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Server connection failed');
      mockServer.connect.mockRejectedValueOnce(error);

      const server = new AtpMcpServer();
      await expect(server.start()).rejects.toThrow('Server startup failed');
    });

    it('should cleanup on startup failure', async () => {
      const server = new AtpMcpServer();
      const error = new Error('Connection failed');
      mockServer.connect.mockRejectedValue(error);

      await expectToThrow(() => server.start(), McpError);

      expect(mockAtpClient.cleanup).toHaveBeenCalled();
    });

    it('propagates the original startup error even when cleanup also fails', async () => {
      const server = new AtpMcpServer();
      mockServer.connect.mockRejectedValue(new Error('Connection failed'));
      mockAtpClient.cleanup.mockRejectedValue(new Error('Cleanup failed'));

      // The cleanup failure must not mask the startup failure.
      await expect(server.start()).rejects.toThrow('Server startup failed');
    });
  });

  describe('stop', () => {
    it('should stop server successfully', async () => {
      const server = new AtpMcpServer();

      await server.start();
      await server.stop();

      expect(mockAtpClient.cleanup).toHaveBeenCalled();
      expect(mockServer.close).toHaveBeenCalled();
    });

    it('should not stop if not running', async () => {
      const server = new AtpMcpServer();

      await server.stop();

      expect(mockAtpClient.cleanup).not.toHaveBeenCalled();
      expect(mockServer.close).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors', async () => {
      const server = new AtpMcpServer();
      const error = new Error('Cleanup failed');
      mockAtpClient.cleanup.mockRejectedValue(error);

      await server.start();

      await expectToThrow(() => server.stop(), Error, /Cleanup failed/);
    });
  });

  describe('getStatus', () => {
    it('should return server status', async () => {
      const server = new AtpMcpServer();

      const status = server.getStatus();

      expect(status).toEqual({
        isRunning: false,
        isAuthenticated: true,
        authMode: 'app-password',
        hasAuthentication: true,
        config: expect.any(Object),
      });
    });

    it('should return running status after start', async () => {
      const server = new AtpMcpServer();

      await server.start();
      const status = server.getStatus();

      expect(status.isRunning).toBe(true);
    });
  });

  describe('MCP handlers', () => {
    // Helper function to find handler by testing the schema
    const findHandlerByMethod = (method: string) =>
      mockServer.setRequestHandler.mock.calls.find((call: any[]) => {
        const schema = call[0];
        if (!schema || typeof schema.parse !== 'function') return false;

        try {
          // Test if the schema accepts the method
          schema.parse({ method });
          return true;
        } catch {
          // Try with params for more complex schemas
          try {
            schema.parse({ method, params: {} });
            return true;
          } catch {
            return false;
          }
        }
      });

    // Note: 'initialize' and 'ping' are handled natively by the SDK Server/Protocol
    // and are no longer registered by our code (see tool-dispatch.test.ts for the
    // real handshake). Our code registers exactly eight handlers: tools/list,
    // tools/call, resources/list, resources/templates/list, resources/read,
    // prompts/list, prompts/get, completion/complete.

    it('should register a single tools/call handler that routes by name', async () => {
      const server = new AtpMcpServer();
      void server;

      // Exactly one handler is registered per method (the dispatch bug was many
      // tools/call handlers overwriting each other). Eight handlers total.
      expect(mockServer.setRequestHandler.mock.calls.length).toBe(8);
    });

    it('should register resources/templates/list handler advertising the URI templates', async () => {
      const server = new AtpMcpServer();
      void server;

      // Clients probe resources/templates/list because the resources capability
      // is declared; an unhandled method surfaces as -32601 to them.
      const templatesCall = findHandlerByMethod('resources/templates/list');
      expect(templatesCall).toBeDefined();

      const result = await templatesCall![1]({ method: 'resources/templates/list' });
      expect(result.resourceTemplates.map((t: any) => t.uriTemplate)).toEqual([
        'atproto://profile/{actor}',
        'atproto://feed/{actor}',
      ]);
      for (const template of result.resourceTemplates) {
        expect(typeof template.name).toBe('string');
        expect(typeof template.description).toBe('string');
        expect(template.mimeType).toBe('application/json');
      }
    });

    it('should register tools/list handler', async () => {
      const server = new AtpMcpServer();
      void server;

      const toolsListCall = findHandlerByMethod('tools/list');
      expect(toolsListCall).toBeDefined();
    });

    it('should register resources/list handler', async () => {
      const server = new AtpMcpServer();
      void server;

      const resourcesListCall = findHandlerByMethod('resources/list');
      expect(resourcesListCall).toBeDefined();
    });

    it('should register prompts/list handler', async () => {
      const server = new AtpMcpServer();
      void server;

      const promptsListCall = findHandlerByMethod('prompts/list');
      expect(promptsListCall).toBeDefined();
    });
  });

  describe('getAtpClient', () => {
    it('should return AT Protocol client', () => {
      const server = new AtpMcpServer();
      const client = server.getAtpClient();

      expect(client).toBe(mockAtpClient);
    });
  });

  describe('getConfigManager', () => {
    it('should return configuration manager', () => {
      const server = new AtpMcpServer();
      const configManager = server.getConfigManager();

      expect(configManager).toBe(mockConfigManager);
    });
  });
});
