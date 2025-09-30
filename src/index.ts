#!/usr/bin/env node

/**
 * AT Protocol MCP Server
 *
 * A comprehensive Model Context Protocol server that provides LLMs with direct access
 * to the AT Protocol ecosystem, enabling seamless interaction with Bluesky and other
 * AT Protocol-based social networks.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ConfigurationError, type IMcpServerConfig, McpError } from './types/index.js';
import { AtpClient } from './utils/atp-client.js';
import { Logger } from './utils/logger.js';
import { ConfigManager } from './utils/config.js';
import { type IMcpTool, createTools } from './tools/index.js';
import { type BaseResource, createResources } from './resources/index.js';
import { type BasePrompt, createPrompts } from './prompts/index.js';
import {
  ConnectionPool,
  type ICacheConfig,
  type IConnectionPoolConfig,
  type IPerformanceMetrics,
  LRUCache,
  PerformanceMonitor,
  WebSocketManager,
} from './utils/performance.js';
import { type ISecurityConfig, SecurityManager } from './utils/security.js';

/**
 * Main server class for AT Protocol MCP Server
 */
export class AtpMcpServer {
  private server: Server;
  private atpClient: AtpClient;
  private logger: Logger;
  private configManager: ConfigManager;
  private connectionPool: ConnectionPool;
  private cache: LRUCache<unknown>;
  private wsManager: WebSocketManager;
  private performanceMonitor: PerformanceMonitor;
  private securityManager: SecurityManager;
  private metricsInterval?: NodeJS.Timeout;
  private transport: StdioServerTransport | null = null;
  private isRunning = false;

  constructor(configOverrides: Partial<IMcpServerConfig> = {}) {
    this.logger = new Logger('AtpMcpServer');

    try {
      // Initialize configuration
      this.configManager = new ConfigManager(configOverrides);
      const config = this.configManager.getConfig();

      // Initialize MCP server
      this.server = new Server(
        {
          name: config.name,
          version: config.version,
        },
        {
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
        }
      );

      // Initialize AT Protocol client
      this.atpClient = new AtpClient(this.configManager.getAtpConfig());

      // Initialize performance components
      const connectionPoolConfig: IConnectionPoolConfig = {
        maxConnections: 10,
        minConnections: 2,
        acquireTimeoutMs: 5000,
        idleTimeoutMs: 300000, // 5 minutes
        maxRetries: 3,
      };

      const cacheConfig: ICacheConfig = {
        maxSize: 1000,
        ttlMs: 300000, // 5 minutes
        cleanupIntervalMs: 60000, // 1 minute
      };

      this.connectionPool = new ConnectionPool(connectionPoolConfig, this.logger);
      this.cache = new LRUCache(cacheConfig, this.logger);
      this.wsManager = new WebSocketManager(this.logger);
      this.performanceMonitor = new PerformanceMonitor(this.logger);

      // Initialize security manager
      const securityConfig: ISecurityConfig = {
        enableInputSanitization: true,
        enableRateLimit: true,
        enableErrorSanitization: true,
        maxInputLength: 10000,
        allowedOrigins: ['*'], // Configure based on deployment
        trustedProxies: [], // Configure based on deployment
      };

      this.securityManager = new SecurityManager(securityConfig, this.logger);

      // Configure performance monitor
      this.performanceMonitor.setConnectionPool(this.connectionPool);
      this.performanceMonitor.setCache(this.cache);
      this.performanceMonitor.setWebSocketManager(this.wsManager);

      // Setup server handlers
      this.setupServer();

      this.logger.info('AT Protocol MCP Server initialized', {
        name: config.name,
        version: config.version,
      });
    } catch (error) {
      this.logger.error('Failed to initialize AT Protocol MCP Server', error);
      throw error;
    }
  }

  /**
   * Set up the MCP server with basic handlers
   * Register tools, resources, and prompts with the MCP server
   */
  private setupServer(): void {
    this.logger.info('Setting up MCP server handlers...');

    // Set up basic MCP protocol handlers
    this.setupBasicHandlers();

    // Create and register tools, resources, and prompts
    const tools = createTools(this.atpClient);
    const resources = createResources(this.atpClient);
    const prompts = createPrompts(this.atpClient);

    // CRITICAL FIX: Register all tools with the MCP server
    this.registerTools(tools);
    this.registerResources(resources);
    this.registerPrompts(prompts);

    this.logger.debug(
      `Registered ${tools.length} tools, ${resources.length} resources, ${prompts.length} prompts`
    );
    this.logger.info('MCP server handlers setup complete');
  }

  /**
   * Set up basic MCP protocol handlers
   */
  private setupBasicHandlers(): void {
    // Handle server info requests
    this.server.setRequestHandler(z.object({ method: z.literal('initialize') }), async () => {
      const config = this.configManager.getConfig();
      return {
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
          name: config.name,
          version: config.version,
          description: config.description,
        },
      };
    });

    // Handle ping requests
    this.server.setRequestHandler(z.object({ method: z.literal('ping') }), async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }));

    this.logger.debug('Basic MCP handlers registered');
  }

  /**
   * Register MCP tools with the server
   */
  private registerTools(tools: IMcpTool[]): void {
    // Register tools/list handler
    this.server.setRequestHandler(z.object({ method: z.literal('tools/list') }), async () => {
      // Filter tools based on availability (authentication status)
      const availableTools = tools.filter(tool => {
        // Check if tool has isAvailable method (from BaseTool)
        if ('isAvailable' in tool && typeof tool.isAvailable === 'function') {
          return tool.isAvailable();
        }
        // Default to available for tools that don't implement availability check
        return true;
      });

      return {
        tools: availableTools.map(tool => ({
          name: tool.schema.method,
          description: tool.schema.description,
          inputSchema: tool.schema.params ? this.zodToJsonSchema(tool.schema.params) : undefined,
        })),
      };
    });

    // Register individual tool handlers
    for (const tool of tools) {
      this.server.setRequestHandler(
        z.object({
          method: z.literal('tools/call'),
          params: z.object({
            name: z.literal(tool.schema.method),
            arguments: z.any().optional(),
          }),
        }),
        async request => {
          try {
            // Check if tool is available before execution
            if ('isAvailable' in tool && typeof tool.isAvailable === 'function') {
              if (!tool.isAvailable()) {
                const availabilityMessage =
                  'getAvailabilityMessage' in tool &&
                  typeof tool.getAvailabilityMessage === 'function'
                    ? tool.getAvailabilityMessage()
                    : 'Tool not available';

                throw new McpError(`Tool not available: ${availabilityMessage}`, -32603, {
                  tool: tool.schema.method,
                  availability: availabilityMessage,
                });
              }
            }

            const result = await tool.handler(request.params.arguments || {});
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          } catch (error) {
            this.logger.error(`Tool ${tool.schema.method} execution failed`, error);
            throw new McpError(
              `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              -32603,
              {
                tool: tool.schema.method,
                error: error instanceof Error ? error.message : String(error),
              }
            );
          }
        }
      );
    }

    this.logger.info(`Registered ${tools.length} MCP tools`);
  }

  /**
   * Register MCP resources with the server
   */
  private registerResources(resources: BaseResource[]): void {
    // Register resources/list handler
    this.server.setRequestHandler(z.object({ method: z.literal('resources/list') }), async () => ({
      resources: resources.map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      })),
    }));

    // Register resources/read handler
    this.server.setRequestHandler(
      z.object({
        method: z.literal('resources/read'),
        params: z.object({
          uri: z.string(),
        }),
      }),
      async request => {
        try {
          const resource = resources.find(r => r.uri === request.params.uri);

          if (!resource) {
            throw new McpError(`Resource not found: ${request.params.uri}`, -32602, {
              uri: request.params.uri,
            });
          }

          // Check if resource is available
          const isAvailable = await resource.isAvailable();
          if (!isAvailable) {
            throw new McpError(`Resource not available: ${request.params.uri}`, -32603, {
              uri: request.params.uri,
            });
          }

          const content = await resource.read();
          return {
            contents: [
              {
                uri: content.uri,
                mimeType: content.mimeType,
                text: content.text ?? '',
              },
            ],
          };
        } catch (error) {
          this.logger.error(`Resource read failed`, error);
          throw new McpError(
            `Resource read failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            -32603,
            {
              uri: request.params.uri,
              error: error instanceof Error ? error.message : String(error),
            }
          );
        }
      }
    );

    this.logger.info(`Registered ${resources.length} MCP resources`);
  }

  /**
   * Register MCP prompts with the server
   */
  private registerPrompts(prompts: BasePrompt[]): void {
    // Register prompts/list handler
    this.server.setRequestHandler(z.object({ method: z.literal('prompts/list') }), async () => ({
      prompts: prompts.map(prompt => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments ?? [],
      })),
    }));

    // Register prompts/get handler
    this.server.setRequestHandler(
      z.object({
        method: z.literal('prompts/get'),
        params: z.object({
          name: z.string(),
          arguments: z.record(z.any()).optional(),
        }),
      }),
      async request => {
        try {
          const prompt = prompts.find(p => p.name === request.params.name);

          if (!prompt) {
            throw new McpError(`Prompt not found: ${request.params.name}`, -32602, {
              name: request.params.name,
            });
          }

          // Check if prompt is available
          const isAvailable = prompt.isAvailable();
          if (!isAvailable) {
            throw new McpError(`Prompt not available: ${request.params.name}`, -32603, {
              name: request.params.name,
            });
          }

          const messages = await prompt.get(request.params.arguments ?? {});
          return { messages };
        } catch (error) {
          this.logger.error(`Prompt generation failed`, error);
          throw new McpError(
            `Prompt generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            -32603,
            {
              name: request.params.name,
              error: error instanceof Error ? error.message : String(error),
            }
          );
        }
      }
    );

    this.logger.info(`Registered ${prompts.length} MCP prompts`);
  }

  /**
   * Convert Zod schema to JSON Schema for MCP compatibility
   */
  private zodToJsonSchema(schema: z.ZodSchema): Record<string, unknown> {
    // Handle ZodOptional wrapper first
    if (schema instanceof z.ZodOptional) {
      return this.zodToJsonSchema((schema as z.ZodOptional<z.ZodSchema>)._def.innerType);
    }

    // Handle ZodObject
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        const zodValue = value as z.ZodSchema;
        const isOptional = zodValue.isOptional();

        // Recursively convert the property schema
        properties[key] = this.zodToJsonSchema(zodValue);

        if (!isOptional) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }

    // Handle ZodString
    if (schema instanceof z.ZodString) {
      const stringSchema: any = { type: 'string' };

      // Add string constraints
      if ((schema as any)._def.checks) {
        for (const check of (schema as any)._def.checks) {
          if (check.kind === 'min') stringSchema.minLength = check.value;
          if (check.kind === 'max') stringSchema.maxLength = check.value;
          if (check.kind === 'regex') stringSchema.pattern = check.regex.source;
        }
      }

      return stringSchema;
    }

    // Handle ZodNumber
    if (schema instanceof z.ZodNumber) {
      const numberSchema: any = { type: 'number' };

      // Add number constraints
      if ((schema as any)._def.checks) {
        for (const check of (schema as any)._def.checks) {
          if (check.kind === 'min') numberSchema.minimum = check.value;
          if (check.kind === 'max') numberSchema.maximum = check.value;
          if (check.kind === 'int') numberSchema.type = 'integer';
        }
      }

      return numberSchema;
    }

    // Handle ZodBoolean
    if (schema instanceof z.ZodBoolean) {
      return { type: 'boolean' };
    }

    // Handle ZodArray
    if (schema instanceof z.ZodArray) {
      const arraySchema: any = { type: 'array' };

      // Add array item type if available
      if ((schema as any)._def.type) {
        arraySchema.items = this.zodToJsonSchema((schema as any)._def.type);
      }

      return arraySchema;
    }

    // Handle ZodEnum
    if (schema instanceof z.ZodEnum) {
      return {
        type: 'string',
        enum: (schema as any)._def.values,
      };
    }

    // Handle ZodUnion
    if (schema instanceof z.ZodUnion) {
      return {
        anyOf: (schema as any)._def.options.map((option: z.ZodSchema) =>
          this.zodToJsonSchema(option)
        ),
      };
    }

    // Handle ZodAny and other unknown types
    if (schema instanceof z.ZodAny) {
      return { type: 'object' };
    }

    // Default fallback
    return { type: 'object' };
  }

  /**
   * Start the MCP server
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Server is already running');
      return;
    }

    try {
      this.logger.info('Starting AT Protocol MCP Server...');
      const config = this.configManager.getConfig();

      // Initialize AT Protocol client (supports both authenticated and unauthenticated modes)
      try {
        await this.atpClient.initialize();
        if (this.atpClient.isAuthenticated()) {
          this.logger.info('AT Protocol client initialized successfully with authentication');
        } else {
          this.logger.info('AT Protocol client initialized successfully in unauthenticated mode');
        }
      } catch (error) {
        // If authentication fails but we can still run in unauthenticated mode, continue
        if (this.configManager.hasAuthentication()) {
          this.logger.error('Authentication failed, but continuing in unauthenticated mode', error);
        } else {
          this.logger.info('Running in unauthenticated mode (no credentials provided)');
        }
      }

      // Create and connect transport
      this.transport = new StdioServerTransport();
      await this.server.connect(this.transport);

      this.isRunning = true;

      // Start performance monitoring
      this.metricsInterval = this.performanceMonitor.startPeriodicLogging(60000); // Log every minute

      this.logger.info('AT Protocol MCP Server started successfully', {
        name: config.name,
        version: config.version,
        service: config.atproto.service,
        authMethod: config.atproto.authMethod ?? 'unauthenticated',
        authMode: this.configManager.getAuthMode(),
        isAuthenticated: this.atpClient.isAuthenticated(),
      });
    } catch (error) {
      this.logger.error('Failed to start AT Protocol MCP Server', error);

      // Cleanup on failure
      await this.cleanup();

      if (error instanceof ConfigurationError) {
        throw error;
      }

      throw new McpError(
        'Server startup failed',
        -32000,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Stop the MCP server
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Server is not running');
      return;
    }

    this.logger.info('Stopping AT Protocol MCP Server...');
    await this.cleanup();
  }

  /**
   * Cleanup server resources
   */
  private async cleanup(): Promise<void> {
    const errors: Error[] = [];

    try {
      // Stop performance monitoring
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
        this.metricsInterval = undefined;
      }

      // Cleanup performance components
      this.wsManager.disconnectAll();
      this.cache.clear();
      this.connectionPool.cleanup();
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }

    try {
      // Cleanup AT Protocol client
      await this.atpClient.cleanup();
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }

    try {
      // Close MCP server
      await this.server.close();
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }

    this.isRunning = false;
    this.transport = null;

    if (errors.length > 0) {
      this.logger.error('Errors during cleanup', { errors: errors.map(e => e.message) });
      throw errors[0];
    }

    this.logger.info('AT Protocol MCP Server stopped successfully');
  }

  /**
   * Get server status
   */
  public getStatus(): {
    isRunning: boolean;
    isAuthenticated: boolean;
    authMode: 'unauthenticated' | 'app-password' | 'oauth';
    hasAuthentication: boolean;
    config: IMcpServerConfig;
  } {
    return {
      isRunning: this.isRunning,
      isAuthenticated: this.atpClient.isAuthenticated(),
      authMode: this.configManager.getAuthMode(),
      hasAuthentication: this.configManager.hasAuthentication(),
      config: this.configManager.getConfig(),
    };
  }

  /**
   * Get AT Protocol client instance
   */
  public getAtpClient(): AtpClient {
    return this.atpClient;
  }

  /**
   * Get configuration manager
   */
  public getConfigManager(): ConfigManager {
    return this.configManager;
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): IPerformanceMetrics {
    return this.performanceMonitor.getMetrics();
  }

  /**
   * Get cache instance for external use
   */
  public getCache(): LRUCache<unknown> {
    return this.cache;
  }

  /**
   * Get connection pool instance for external use
   */
  public getConnectionPool(): ConnectionPool {
    return this.connectionPool;
  }

  /**
   * Get WebSocket manager instance for external use
   */
  public getWebSocketManager(): WebSocketManager {
    return this.wsManager;
  }

  /**
   * Get security manager instance for external use
   */
  public getSecurityManager(): SecurityManager {
    return this.securityManager;
  }

  /**
   * Get comprehensive system metrics including performance and security
   */
  public getSystemMetrics(): {
    performance: IPerformanceMetrics;
    security: Record<string, unknown>;
    server: {
      isRunning: boolean;
      isAuthenticated: boolean;
      authMode: 'unauthenticated' | 'app-password' | 'oauth';
      hasAuthentication: boolean;
      config: IMcpServerConfig;
    };
  } {
    return {
      performance: this.getPerformanceMetrics(),
      security: this.securityManager.getMetrics(),
      server: this.getStatus(),
    };
  }
}

/**
 * Create and start the server if this file is run directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new AtpMcpServer();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    void server.stop().then(() => {
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    void server.stop().then(() => {
      process.exit(0);
    });
  });

  // Start the server
  server.start().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default AtpMcpServer;
