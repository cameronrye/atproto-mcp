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
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ConfigurationError, type IMcpServerConfig } from './types/index.js';
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

    // Note: 'initialize' and 'ping' are handled natively by the SDK Server/Protocol
    // classes (capability + protocol-version negotiation, spec-compliant ping). We
    // must NOT register our own handlers for them — doing so overrides the SDK's
    // negotiation and drops tracked client capabilities.

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
   * Register MCP tools with the server
   */
  private registerTools(tools: IMcpTool[]): void {
    // Register tools/list handler
    this.server.setRequestHandler(z.object({ method: z.literal('tools/list') }), async () =>
      // Return all tools with static descriptions per MCP specification.
      // Tools should always be listed regardless of authentication state.
      // If a tool requires authentication, it will return an appropriate error when called.
      ({
        tools: tools.map(tool => ({
          name: tool.schema.method,
          description: tool.schema.description || '',
          inputSchema: tool.schema.params ? this.zodToJsonSchema(tool.schema.params) : undefined,
        })),
      })
    );

    // Build a name -> tool lookup so a SINGLE tools/call handler can dispatch
    // to every tool. The MCP SDK keys request handlers by method name only
    // (see Protocol.setRequestHandler), so registering one handler per tool under
    // the same 'tools/call' method would overwrite all but the last-registered
    // tool, leaving every other tool uninvokable.
    const toolsByName = new Map<string, IMcpTool>();
    for (const tool of tools) {
      toolsByName.set(tool.schema.method, tool);
    }

    // Register a single tools/call handler that routes by params.name.
    this.server.setRequestHandler(
      z.object({
        method: z.literal('tools/call'),
        params: z.object({
          name: z.string(),
          arguments: z.any().optional(),
        }),
      }),
      async request => {
        const toolName = request.params.name;
        const tool = toolsByName.get(toolName);

        if (!tool) {
          throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${toolName}`, {
            tool: toolName,
          });
        }

        // Rate-limit tool invocations to guard against runaway loops / abuse.
        // Note: tool arguments are intentionally NOT passed through the HTML/script
        // input sanitizer — that sanitizer strips characters (`<`, `>`, collapses
        // whitespace) that are legitimate in post content and would corrupt user
        // data. Per-field validation is handled by each tool's zod schema, and
        // outbound URLs/paths are guarded at their call sites (see url-safety).
        if (!this.securityManager.checkRateLimit(`tool:${toolName}`)) {
          throw new McpError(
            ErrorCode.InternalError,
            `Rate limit exceeded for tool "${toolName}". Please slow down and retry shortly.`,
            { tool: toolName }
          );
        }

        try {
          // Check if tool is available before execution
          if ('isAvailable' in tool && typeof tool.isAvailable === 'function') {
            if (!tool.isAvailable()) {
              const availabilityMessage =
                'getAvailabilityMessage' in tool &&
                typeof tool.getAvailabilityMessage === 'function'
                  ? tool.getAvailabilityMessage()
                  : 'Tool not available';

              throw new McpError(
                ErrorCode.InternalError,
                `Tool not available: ${availabilityMessage}`,
                {
                  tool: toolName,
                  availability: availabilityMessage,
                }
              );
            }
          }

          const result = await tool.handler(request.params.arguments || {});

          // DESIGN DECISION: Return results as formatted JSON text for LLM consumption
          //
          // This server intentionally returns all tool results as stringified JSON text
          // rather than using MCP's structured content types. This is a deliberate
          // architectural choice with the following rationale:
          //
          // 1. Consistency: All tools return the same format, making it easier for LLMs
          //    to parse and understand responses without needing to handle multiple
          //    content type variations.
          //
          // 2. Readability: Pretty-printed JSON (with 2-space indentation) is optimized
          //    for LLM token processing and human readability during debugging.
          //
          // 3. Compatibility: Text content is universally supported across all MCP clients,
          //    ensuring maximum compatibility without client-specific handling.
          //
          // 4. Debugging: Formatted JSON makes it easier to debug and inspect responses
          //    in logs and during development.
          //
          // 5. LLM Processing: LLMs are highly effective at parsing JSON text and can
          //    extract structured information from formatted JSON strings.
          //
          // Alternative Approach: MCP supports structured content types (e.g., JSON objects,
          // arrays, etc.) which could be used instead. However, testing has shown that
          // stringified JSON provides better results for LLM clients in practice.
          //
          // If you need structured content types for programmatic processing, consider
          // parsing the JSON text in your client application.
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          this.logger.error(`Tool ${toolName} execution failed`, error);

          // Re-throw protocol errors (unknown/unavailable tool) as-is so the
          // client receives the accurate JSON-RPC code.
          if (error instanceof McpError) {
            throw error;
          }

          // Sanitize internal error details before returning to the client.
          const sanitized = this.securityManager
            .getErrorSanitizer()
            .sanitizeError(error instanceof Error ? error : new Error(String(error)));

          throw new McpError(
            ErrorCode.InternalError,
            `Tool execution failed: ${sanitized.message}`,
            {
              tool: toolName,
            }
          );
        }
      }
    );

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
            throw new McpError(
              ErrorCode.InvalidParams,
              `Resource not found: ${request.params.uri}`,
              {
                uri: request.params.uri,
              }
            );
          }

          // Check if resource is available
          const isAvailable = await resource.isAvailable();
          if (!isAvailable) {
            throw new McpError(
              ErrorCode.InternalError,
              `Resource not available: ${request.params.uri}`,
              { uri: request.params.uri }
            );
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
          if (error instanceof McpError) {
            throw error;
          }
          const sanitized = this.securityManager
            .getErrorSanitizer()
            .sanitizeError(error instanceof Error ? error : new Error(String(error)));
          throw new McpError(
            ErrorCode.InternalError,
            `Resource read failed: ${sanitized.message}`,
            {
              uri: request.params.uri,
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
            throw new McpError(
              ErrorCode.InvalidParams,
              `Prompt not found: ${request.params.name}`,
              {
                name: request.params.name,
              }
            );
          }

          // Check if prompt is available
          const isAvailable = prompt.isAvailable();
          if (!isAvailable) {
            throw new McpError(
              ErrorCode.InternalError,
              `Prompt not available: ${request.params.name}`,
              { name: request.params.name }
            );
          }

          const messages = await prompt.get(request.params.arguments ?? {});
          return { messages };
        } catch (error) {
          this.logger.error(`Prompt generation failed`, error);
          if (error instanceof McpError) {
            throw error;
          }
          const sanitized = this.securityManager
            .getErrorSanitizer()
            .sanitizeError(error instanceof Error ? error : new Error(String(error)));
          throw new McpError(
            ErrorCode.InternalError,
            `Prompt generation failed: ${sanitized.message}`,
            { name: request.params.name }
          );
        }
      }
    );

    this.logger.info(`Registered ${prompts.length} MCP prompts`);
  }

  /**
   * Convert Zod schema to JSON Schema for MCP compatibility
   *
   * Uses the well-tested zod-to-json-schema library to ensure comprehensive
   * support for all Zod schema types and proper JSON Schema conversion.
   */
  private zodToJsonSchema(schema: z.ZodSchema): Record<string, unknown> {
    return zodToJsonSchema(schema, {
      target: 'jsonSchema7',
      $refStrategy: 'none',
    }) as Record<string, unknown>;
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
        ErrorCode.InternalError,
        'Server startup failed',
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

      // Release security manager background timers (rate-limiter cleanup).
      this.securityManager.destroy();
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
      throw new Error(`Cleanup failed: ${errors[0]?.message ?? 'Unknown error'}`);
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
   * Get the underlying MCP Server instance.
   *
   * Exposed for programmatic transport wiring (e.g. connecting an in-memory
   * transport in tests, or an alternative transport for embedding).
   */
  public getServer(): Server {
    return this.server;
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
 * Export the server class for use by the CLI and programmatic usage
 *
 * Note: This file should not be run directly. Use the CLI (src/cli.ts) instead:
 *   npm start
 *   or
 *   node dist/cli.js
 *
 * For programmatic usage, import and instantiate the AtpMcpServer class:
 *   import { AtpMcpServer } from './index.js';
 *   const server = new AtpMcpServer(config);
 *   await server.start();
 */
export default AtpMcpServer;
