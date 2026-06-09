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
import { ConfigurationError, type IMcpServerConfig, ValidationError } from './types/index.js';
import { AtpClient } from './utils/atp-client.js';
import { Logger } from './utils/logger.js';
import { ConfigManager } from './utils/config.js';
import { type IMcpTool, type IToolAnnotations, createTools } from './tools/index.js';
import { StartStreamingTool } from './tools/implementations/streaming-tools.js';
import { type BaseResource, createResources } from './resources/index.js';
import { type BasePrompt, createPrompts } from './prompts/index.js';
import { type IPerformanceMetrics, PerformanceMonitor } from './utils/performance.js';
import { type ISecurityConfig, SecurityManager } from './utils/security.js';

/**
 * Pure read tools (no writes to the network). readOnlyHint:true lets clients
 * auto-approve them. Curated explicitly per tool — NOT derived from auth mode,
 * which encodes auth requirement, not destructiveness.
 */
const READ_ONLY_TOOLS = new Set<string>([
  'analyze_engagement',
  'analyze_image',
  'analyze_moderation_status',
  'analyze_network',
  'discover_communities',
  'discover_trending',
  'extract_media_from_post',
  'find_influential_users',
  'find_similar_users',
  'generate_alt_text',
  'generate_link_preview',
  'get_custom_feed',
  'get_followers',
  'get_follows',
  'get_list',
  'get_notifications',
  'get_post_context',
  'get_recent_events',
  'get_streaming_status',
  'get_thread',
  'get_timeline',
  'get_user_profile',
  'get_user_summary',
  'recommend_content',
  'search_posts',
  'suggest_content_strategy',
]);

/**
 * Tools whose effect is irreversible or removes/limits data (deletes, blocks,
 * mutes, reports, removals, token revocation). destructiveHint:true lets clients
 * surface confirmation UI and withhold auto-approval.
 */
const DESTRUCTIVE_TOOLS = new Set<string>([
  'block_user',
  'delete_post',
  'mute_user',
  'remove_from_list',
  'report_content',
  'report_user',
  'revoke_oauth_tokens',
  'unfollow_user',
  'unlike_post',
  'unrepost',
]);

/**
 * Build the advertised annotations for a tool. openWorldHint is true for every
 * tool (they all reach a live network). A per-tool `schema.annotations` override
 * wins over these defaults.
 */
function computeToolAnnotations(method: string, override?: IToolAnnotations): IToolAnnotations {
  return {
    openWorldHint: true,
    ...(READ_ONLY_TOOLS.has(method) ? { readOnlyHint: true } : {}),
    ...(DESTRUCTIVE_TOOLS.has(method) ? { destructiveHint: true } : {}),
    ...(override ?? {}),
  };
}

/**
 * Main server class for AT Protocol MCP Server
 */
export class AtpMcpServer {
  private server: Server;
  private atpClient: AtpClient;
  private logger: Logger;
  private configManager: ConfigManager;
  private performanceMonitor: PerformanceMonitor;
  private securityManager: SecurityManager;
  private metricsInterval?: NodeJS.Timeout;
  private transport: StdioServerTransport | null = null;
  private isRunning = false;
  private isShuttingDown = false;

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

      // Initialize performance monitoring (process-level memory/uptime metrics)
      this.performanceMonitor = new PerformanceMonitor(this.logger);

      // Initialize security manager
      const securityConfig: ISecurityConfig = {
        // The blanket HTML/script InputSanitizer is intentionally NOT applied to
        // tool arguments (it would corrupt legitimate post content). Per-field
        // zod validation and url-safety guards are the real defenses, so this flag
        // honestly reports that the object sanitizer does not run on the hot path.
        enableInputSanitization: false,
        enableRateLimit: true,
        enableErrorSanitization: true,
        maxInputLength: 10000,
        allowedOrigins: ['*'], // Configure based on deployment
        trustedProxies: [], // Configure based on deployment
      };

      this.securityManager = new SecurityManager(securityConfig, this.logger);

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
          // MCP requires inputSchema to be a JSON Schema object. For param-less
          // tools, emit an empty object schema rather than `undefined` (which
          // violates the Tool shape).
          inputSchema: tool.schema.params
            ? this.zodToJsonSchema(tool.schema.params)
            : { type: 'object', properties: {} },
          annotations: computeToolAnnotations(tool.schema.method, tool.schema.annotations),
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

        // Build an MCP "tool error" result. Per the MCP spec, errors that occur
        // while a (known) tool runs — including invalid arguments, unavailable
        // tools, and rate limiting — are reported as a result with isError: true,
        // NOT as JSON-RPC protocol errors. This lets the calling model SEE the
        // error text and react (fix arguments, authenticate, back off) instead of
        // receiving an opaque transport failure. Protocol errors are reserved for
        // problems with the request itself (e.g. an unknown tool, handled above).
        const toolError = (
          message: string
        ): { content: Array<{ type: 'text'; text: string }>; isError: true } => ({
          content: [{ type: 'text', text: message }],
          isError: true,
        });

        // Rate-limit tool invocations to guard against runaway loops / abuse.
        // Note: tool arguments are intentionally NOT passed through the HTML/script
        // input sanitizer — that sanitizer strips characters (`<`, `>`, collapses
        // whitespace) that are legitimate in post content and would corrupt user
        // data. Per-field validation is handled by each tool's zod schema, and
        // outbound URLs/paths are guarded at their call sites (see url-safety).
        if (!this.securityManager.checkRateLimit(`tool:${toolName}`)) {
          return toolError(
            `Rate limit exceeded for tool "${toolName}". Please slow down and retry shortly.`
          );
        }

        // Surface tool availability (e.g. requires authentication) as a result the
        // model can act on, not a protocol error.
        if (
          'isAvailable' in tool &&
          typeof tool.isAvailable === 'function' &&
          !tool.isAvailable()
        ) {
          const availabilityMessage =
            'getAvailabilityMessage' in tool && typeof tool.getAvailabilityMessage === 'function'
              ? tool.getAvailabilityMessage()
              : 'Tool not available';
          return toolError(`Tool not available: ${availabilityMessage}`);
        }

        try {
          const result = await tool.handler(request.params.arguments || {});

          // Return BOTH representations:
          //
          // - content[].text: pretty-printed JSON, optimized for LLM consumption.
          //   LLMs parse formatted JSON text effectively and it is universally
          //   supported across all MCP clients, so it stays the primary channel.
          //
          // - structuredContent: the same result as a machine-readable object, for
          //   non-LLM consumers and tool-chaining clients that would otherwise have
          //   to re-parse the pretty-printed string. SDK structuredContent must be a
          //   JSON object, so bare arrays/primitives are wrapped under `result`.
          //
          // NOTE: we intentionally do NOT declare per-tool `outputSchema` — doing so
          // makes the SDK REQUIRE and validate structuredContent on every call and
          // throw on any non-conforming object. structuredContent here is additive
          // and best-effort.
          const structuredContent =
            result != null && typeof result === 'object' && !Array.isArray(result)
              ? (result as Record<string, unknown>)
              : { result };
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
            structuredContent,
          };
        } catch (error) {
          this.logger.error(`Tool ${toolName} execution failed`, error);

          // Invalid arguments are safe to surface verbatim so the model can fix them.
          if (error instanceof ValidationError) {
            return toolError(`Invalid parameters: ${error.message}`);
          }

          // Sanitize internal error details before returning to the client.
          const sanitized = this.securityManager
            .getErrorSanitizer()
            .sanitizeError(error instanceof Error ? error : new Error(String(error)));

          return toolError(`Tool execution failed: ${sanitized.message}`);
        }
      }
    );

    this.logger.info(`Registered ${tools.length} MCP tools`);
  }

  /**
   * Normalize an error thrown inside a resource/prompt handler into an McpError:
   * pass an existing McpError through, otherwise log + sanitize and wrap it as an
   * InternalError. Returned (not thrown) so the caller writes `throw this.…`.
   */
  private toHandlerMcpError(
    error: unknown,
    label: string,
    context: Record<string, unknown>
  ): McpError {
    this.logger.error(label, error);
    if (error instanceof McpError) {
      return error;
    }
    const sanitized = this.securityManager
      .getErrorSanitizer()
      .sanitizeError(error instanceof Error ? error : new Error(String(error)));
    return new McpError(ErrorCode.InternalError, `${label}: ${sanitized.message}`, context);
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
          throw this.toHandlerMcpError(error, 'Resource read failed', {
            uri: request.params.uri,
          });
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
          throw this.toHandlerMcpError(error, 'Prompt generation failed', {
            name: request.params.name,
          });
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
    const json = zodToJsonSchema(schema, {
      target: 'jsonSchema7',
      $refStrategy: 'none',
    }) as Record<string, unknown>;
    // The `$schema` meta key is not part of an MCP inputSchema and some clients
    // are strict about it; drop it so we emit a clean JSON Schema object.
    delete json['$schema'];
    return json;
  }

  /**
   * Start the MCP server
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Server is already running');
      return;
    }

    this.isShuttingDown = false;

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

      // When the MCP client disconnects (stdin closes), the transport closes.
      // Release resources so the server does not linger with open timers/sockets.
      this.server.onclose = () => {
        if (this.isShuttingDown) {
          return;
        }
        this.logger.info('MCP transport closed (client disconnected); cleaning up');
        void this.cleanup().catch(err =>
          this.logger.error('Cleanup after transport close failed', err)
        );
      };

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
    // Guard against re-entrancy: cleanup() calls server.close(), which fires the
    // onclose handler; without this flag a client disconnect during shutdown (or
    // two concurrent signals) could run cleanup twice.
    if (this.isShuttingDown) {
      return;
    }
    this.isShuttingDown = true;

    const errors: Error[] = [];

    try {
      // Stop performance monitoring
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
        this.metricsInterval = undefined;
      }

      // Release security manager background timers (rate-limiter cleanup).
      this.securityManager.destroy();

      // Disconnect the shared firehose client (if a streaming tool opened one)
      // so its socket and heartbeat timer do not outlive the server.
      await StartStreamingTool.shutdown();
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
