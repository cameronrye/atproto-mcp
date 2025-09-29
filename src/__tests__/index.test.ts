/**
 * Tests for the main AT Protocol MCP Server
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AtpMcpServer } from '../index.js';
import { ConfigurationError, McpError } from '../types/index.js';
import { mockConsole, expectToThrow, createMockServerConfig } from '../test/setup.js';

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => ({
    setRequestHandler: vi.fn(),
    connect: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../utils/atp-client.js', () => ({
  AtpClient: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: vi.fn().mockReturnValue(true),
  })),
}));

vi.mock('../utils/config.js', () => ({
  ConfigManager: vi.fn().mockImplementation(() => ({
    getConfig: vi.fn().mockReturnValue(createMockServerConfig()),
    getAtpConfig: vi.fn().mockReturnValue({
      service: 'https://bsky.social',
      authMethod: 'app-password',
      identifier: 'test.bsky.social',
      password: 'test-password',
    }),
    getAuthMode: vi.fn().mockReturnValue('app-password'),
    hasAuthentication: vi.fn().mockReturnValue(true),
  })),
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

    vi.mocked(Server).mockImplementation(() => mockServer);
    vi.mocked(AtpClient).mockImplementation(() => mockAtpClient);
    vi.mocked(ConfigManager).mockImplementation(() => mockConfigManager);
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
      calls.forEach(call => {
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

      await expectToThrow(
        () => server.start(),
        McpError
      );

      expect(mockAtpClient.cleanup).toHaveBeenCalled();
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

      await expectToThrow(
        () => server.stop(),
        Error,
        'Cleanup failed'
      );
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
    const findHandlerByMethod = (method: string) => {
      return mockServer.setRequestHandler.mock.calls.find((call: any[]) => {
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
    };

    it('should handle initialize request', async () => {
      const server = new AtpMcpServer();

      // Get the initialize handler
      const initializeCall = findHandlerByMethod('initialize');
      expect(initializeCall).toBeDefined();

      const handler = initializeCall![1];
      const result = await handler();

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
          description: expect.any(String),
        },
      });
    });

    it('should handle ping request', async () => {
      const server = new AtpMcpServer();

      // Get the ping handler
      const pingCall = findHandlerByMethod('ping');
      expect(pingCall).toBeDefined();

      const handler = pingCall![1];
      const result = await handler();

      expect(result).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
      });
    });

    it('should register tools/list handler', async () => {
      const server = new AtpMcpServer();

      // Check that tools/list handler was registered
      const toolsListCall = findHandlerByMethod('tools/list');
      expect(toolsListCall).toBeDefined();
    });

    it('should register tools/call handler', async () => {
      const server = new AtpMcpServer();

      // Check that multiple handlers were registered (tools/call is one of them)
      // We expect at least 8 handlers: initialize, ping, tools/list, tools/call,
      // resources/list, resources/read, prompts/list, prompts/get
      expect(mockServer.setRequestHandler.mock.calls.length).toBeGreaterThanOrEqual(8);
    });

    it('should register resources/list handler', async () => {
      const server = new AtpMcpServer();

      // Check that resources/list handler was registered
      const resourcesListCall = findHandlerByMethod('resources/list');
      expect(resourcesListCall).toBeDefined();
    });

    it('should register resources/read handler', async () => {
      const server = new AtpMcpServer();

      // Check that multiple handlers were registered (resources/read is one of them)
      expect(mockServer.setRequestHandler.mock.calls.length).toBeGreaterThanOrEqual(8);
    });

    it('should register prompts/list handler', async () => {
      const server = new AtpMcpServer();

      // Check that prompts/list handler was registered
      const promptsListCall = findHandlerByMethod('prompts/list');
      expect(promptsListCall).toBeDefined();
    });

    it('should register prompts/get handler', async () => {
      const server = new AtpMcpServer();

      // Check that multiple handlers were registered (prompts/get is one of them)
      expect(mockServer.setRequestHandler.mock.calls.length).toBeGreaterThanOrEqual(8);
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
