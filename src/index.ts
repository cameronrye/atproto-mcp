#!/usr/bin/env node

/**
 * AT Protocol MCP Server
 *
 * A comprehensive Model Context Protocol server that provides LLMs with direct access
 * to the AT Protocol ecosystem, enabling seamless interaction with Bluesky and other
 * AT Protocol-based social networks.
 */

import {
  type IncomingMessage,
  type Server as NodeHttpServer,
  type ServerResponse,
  createServer as createNodeHttpServer,
} from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CompleteRequestSchema,
  ErrorCode,
  ListResourceTemplatesRequestSchema,
  McpError,
  isInitializeRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { ConfigurationError, type IMcpServerConfig, ValidationError } from './types/index.js';
import { AtpClient } from './utils/atp-client.js';
import { Logger } from './utils/logger.js';
import { ConfigManager } from './utils/config.js';
import { type IMcpTool, type IToolAnnotations, createTools } from './tools/index.js';
import {
  type BaseResource,
  type IResourceTemplate,
  createResourceTemplates,
  createResources,
  resolveResourceUri,
} from './resources/index.js';
import { type BasePrompt, createPrompts } from './prompts/index.js';
import { type IPerformanceMetrics, PerformanceMonitor } from './utils/performance.js';
import { type ISecurityConfig, SecurityManager } from './utils/security.js';

/**
 * MCP spec error code for "Resource not found" (resources/read with an unknown
 * URI). Not part of the SDK's ErrorCode enum, which only covers the generic
 * JSON-RPC codes.
 */
const RESOURCE_NOT_FOUND_ERROR_CODE = -32002;

/**
 * Explicit per-tool annotation hints, advertised verbatim in tools/list.
 *
 * Per MCP spec defaults, clients assume the worst case for any hint a server
 * omits on a non-read-only tool (destructiveHint: true, idempotentHint:
 * false), so every write tool carries both hints explicitly.
 *
 * - readOnlyHint: pure reads (no writes to the network). Curated explicitly
 *   per tool — NOT derived from auth mode, which encodes auth requirement,
 *   not destructiveness. destructive/idempotent hints are only meaningful for
 *   write tools and are omitted on read-only entries.
 * - destructiveHint: the tool may delete or overwrite existing data/state
 *   (record deletes, list removals, profile overwrites, blocks, irreversible
 *   moderation reports). Purely additive, reversible writes carry an explicit
 *   false.
 * - idempotentHint: repeating the call with identical arguments has no
 *   additional effect. Claimed only where verified — an implementation-level
 *   dedup/no-op path, or set/clear semantics of the underlying XRPC endpoint.
 */
const TOOL_ANNOTATIONS: Readonly<Record<string, IToolAnnotations>> = {
  // Pure read tools.
  analyze_account: { readOnlyHint: true },
  analyze_image: { readOnlyHint: true },
  analyze_moderation_status: { readOnlyHint: true },
  discover: { readOnlyHint: true },
  discover_communities: { readOnlyHint: true },
  find_influential_users: { readOnlyHint: true },
  find_similar_users: { readOnlyHint: true },
  generate_link_preview: { readOnlyHint: true },
  get_author_feed: { readOnlyHint: true },
  get_bookmarks: { readOnlyHint: true },
  get_custom_feed: { readOnlyHint: true },
  get_list: { readOnlyHint: true },
  get_notifications: { readOnlyHint: true },
  get_post_context: { readOnlyHint: true },
  get_starter_pack: { readOnlyHint: true },
  get_timeline: { readOnlyHint: true },
  get_user_connections: { readOnlyHint: true },
  get_user_profile: { readOnlyHint: true },
  get_user_summary: { readOnlyHint: true },
  // chat.bsky.convo.listConvos is a pure read of the chat service.
  list_conversations: { readOnlyHint: true },
  search_actors: { readOnlyHint: true },
  search_posts: { readOnlyHint: true },
  search_starter_packs: { readOnlyHint: true },

  // Additive, reversible writes. Idempotency notes name the verified
  // dedup/no-op path in the implementation.
  // Dedups via the authoritative viewer.bookmarked pre-check, and the server
  // treats a duplicate createBookmark as a no-op anyway.
  add_bookmark: { destructiveHint: false, idempotentHint: true },
  // add_to_list has no dedup: duplicate listitem records are possible.
  add_to_list: { destructiveHint: false, idempotentHint: false },
  // batch_action only supports follow/like/repost (no quote text), and every
  // path dedups per target via authoritative viewer state.
  batch_action: { destructiveHint: false, idempotentHint: true },
  create_list: { destructiveHint: false, idempotentHint: false },
  create_post: { destructiveHint: false, idempotentHint: false },
  create_thread: { destructiveHint: false, idempotentHint: false },
  // Dedups via viewer.following.
  follow_user: { destructiveHint: false, idempotentHint: true },
  // Not read-only: markRead=true issues chat.bsky.convo.updateRead. That call
  // has set semantics (marks the conversation read), so repeating with
  // identical arguments has no additional effect.
  get_conversation_messages: { destructiveHint: false, idempotentHint: true },
  // Dedups via viewer.like.
  like_post: { destructiveHint: false, idempotentHint: true },
  // seenAt defaults to "now", so repeated calls advance the seen marker.
  mark_notifications_seen: { destructiveHint: false, idempotentHint: false },
  // app.bsky.graph.muteActor sets server-side state; repeating it is a no-op.
  mute_user: { destructiveHint: false, idempotentHint: true },
  reply_to_post: { destructiveHint: false, idempotentHint: false },
  // Each call delivers a new chat message; there is no dedup.
  send_direct_message: { destructiveHint: false, idempotentHint: false },
  // Plain reposts dedup via viewer.repost, but quote text creates a new post
  // on every call, so the tool as a whole is not idempotent.
  repost: { destructiveHint: false, idempotentHint: false },
  upload_image: { destructiveHint: false, idempotentHint: false },
  upload_video: { destructiveHint: false, idempotentHint: false },

  // Destructive writes: may delete or overwrite data/state. These hints let
  // clients surface confirmation UI and withhold auto-approval.
  // Blocking imposes hard bidirectional restrictions and has no dedup
  // (duplicate block records are possible).
  block_user: { destructiveHint: true, idempotentHint: false },
  delete_post: { destructiveHint: true, idempotentHint: false },
  // "Not bookmarked" resolves to an explicit no-op (viewer.bookmarked
  // pre-check), and the server treats deleting a missing bookmark as a no-op.
  remove_bookmark: { destructiveHint: true, idempotentHint: true },
  // "Not in list" resolves to an explicit success:false no-op.
  remove_from_list: { destructiveHint: true, idempotentHint: true },
  // Reports are irreversible moderation actions against third parties; each
  // call files a new report.
  report_content: { destructiveHint: true, idempotentHint: false },
  report_user: { destructiveHint: true, idempotentHint: false },
  // "Not blocked" resolves to an explicit success:false no-op.
  unblock_user: { destructiveHint: true, idempotentHint: true },
  unfollow_user: { destructiveHint: true, idempotentHint: false },
  unlike_post: { destructiveHint: true, idempotentHint: false },
  // app.bsky.graph.unmuteActor clears server-side state; repeating is a no-op.
  unmute_user: { destructiveHint: true, idempotentHint: true },
  unrepost: { destructiveHint: true, idempotentHint: false },
  // Overwrites profile fields; the read-merge-write (CAS-guarded) converges
  // to the same record for identical arguments.
  update_profile: { destructiveHint: true, idempotentHint: true },
};

/**
 * Build the advertised annotations for a tool. openWorldHint is true for every
 * tool (they all reach a live network). A per-tool `schema.annotations` override
 * wins over these defaults. Tools missing from TOOL_ANNOTATIONS fall back to
 * the MCP client-side worst-case defaults (destructive, non-idempotent).
 */
function computeToolAnnotations(method: string, override?: IToolAnnotations): IToolAnnotations {
  return {
    openWorldHint: true,
    ...(TOOL_ANNOTATIONS[method] ?? {}),
    ...(override ?? {}),
  };
}

/**
 * Transports the server can speak. stdio is the default (MCP clients such as
 * Claude Desktop spawn the process and own its stdin/stdout); http serves the
 * MCP Streamable HTTP transport on a TCP port at /mcp.
 */
export type McpTransportKind = 'stdio' | 'http';

/**
 * Options for {@link AtpMcpServer.start}. port/host apply to the http
 * transport only and override the configured values (config.port/config.host),
 * which lets tests bind an ephemeral port (0) that the config schema does not
 * allow.
 */
export interface IServerStartOptions {
  transport?: McpTransportKind;
  port?: number;
  host?: string;
}

/** One live Streamable HTTP session: its transport and dedicated MCP Server. */
interface IHttpSession {
  transport: StreamableHTTPServerTransport;
  server: Server;
}

/**
 * Cap on accepted HTTP request bodies. The SDK's web-standard transport parses
 * the body with req.json()/JSON.parse and enforces no size limit of its own
 * (verified against @modelcontextprotocol/sdk 1.29), so the server reads and
 * bounds the body itself before handing the parsed message to the transport.
 * 4 MiB mirrors the MAXIMUM_MESSAGE_SIZE the SDK's express-based transports
 * historically enforced.
 */
const MAX_HTTP_BODY_BYTES = 4 * 1024 * 1024;

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
  private httpServer: NodeHttpServer | null = null;
  private httpSessions = new Map<string, IHttpSession>();
  private httpAllowedHosts: string[] = [];
  private isRunning = false;
  private isShuttingDown = false;

  constructor(configOverrides: Partial<IMcpServerConfig> = {}) {
    this.logger = new Logger('AtpMcpServer');

    try {
      // Initialize configuration
      this.configManager = new ConfigManager(configOverrides);
      const config = this.configManager.getConfig();

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

      // Create the MCP server and register its handlers. The same factory
      // builds one server per HTTP session in http transport mode.
      this.server = this.createMcpServer();

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
   * Construct an MCP Server instance with every handler registered.
   *
   * This is the single construction path for ALL transports: the constructor
   * builds the stdio server through it, and the http transport builds one
   * fresh Server per session through it (each Streamable HTTP session needs
   * its own Server because the SDK Protocol binds 1:1 to a transport).
   */
  private createMcpServer(): Server {
    const config = this.configManager.getConfig();

    const server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
          // completion/complete is served for prompt arguments and resource
          // template variables (see registerCompletions).
          completions: {},
        },
      }
    );

    this.setupServer(server);
    return server;
  }

  /**
   * Set up the MCP server with basic handlers
   * Register tools, resources, and prompts with the MCP server
   */
  private setupServer(server: Server): void {
    this.logger.info('Setting up MCP server handlers...');

    // Note: 'initialize' and 'ping' are handled natively by the SDK Server/Protocol
    // classes (capability + protocol-version negotiation, spec-compliant ping). We
    // must NOT register our own handlers for them — doing so overrides the SDK's
    // negotiation and drops tracked client capabilities.

    // Create and register tools, resources (static + templates), and prompts
    const tools = createTools(this.atpClient);
    const resources = createResources(this.atpClient);
    const templates = createResourceTemplates(this.atpClient);
    const prompts = createPrompts(this.atpClient);

    // CRITICAL FIX: Register all tools with the MCP server
    this.registerTools(server, tools);
    this.registerResources(server, resources, templates);
    this.registerPrompts(server, prompts);
    this.registerCompletions(server, prompts, templates);

    this.logger.debug(
      `Registered ${tools.length} tools, ${resources.length} resources, ` +
        `${templates.length} resource templates, ${prompts.length} prompts`
    );
    this.logger.info('MCP server handlers setup complete');
  }

  /**
   * Register MCP tools with the server
   */
  private registerTools(server: Server, tools: IMcpTool[]): void {
    // Register tools/list handler
    server.setRequestHandler(z.object({ method: z.literal('tools/list') }), async () =>
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
          // Advertise the tool's declared output schema. This is a binding
          // contract, not decoration: spec-compliant clients (including the
          // official SDK's Client.callTool) validate every tools/call
          // structuredContent against this schema and hard-fail on mismatch,
          // so each outputSchema literal must track its tool's actual return
          // shape (see the structuredContent note in the tools/call handler).
          ...(tool.schema.outputSchema ? { outputSchema: tool.schema.outputSchema } : {}),
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
    server.setRequestHandler(
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
          // NOTE: per-tool `outputSchema` IS advertised in tools/list (see
          // registerTools above), and SDK clients validate structuredContent
          // against it, failing the call on any drift. structuredContent is
          // therefore a contract, not best-effort: tools that declare an
          // outputSchema must return a conforming object. (Server-side, this
          // custom handler performs no validation of its own — the SDK only
          // auto-validates when tools are registered via registerTool.)
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
  private registerResources(
    server: Server,
    resources: BaseResource[],
    templates: IResourceTemplate[]
  ): void {
    // Register resources/list handler
    server.setRequestHandler(z.object({ method: z.literal('resources/list') }), async () => ({
      resources: resources.map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      })),
    }));

    // Register resources/templates/list handler. Per the MCP spec, templates
    // are advertised exclusively here (resources/list stays static-only); a
    // client expands a uriTemplate and reads it via resources/read.
    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      resourceTemplates: templates.map(t => ({
        uriTemplate: t.uriTemplate,
        name: t.name,
        description: t.description,
        mimeType: t.mimeType,
      })),
    }));

    // Register resources/read handler
    server.setRequestHandler(
      z.object({
        method: z.literal('resources/read'),
        params: z.object({
          uri: z.string(),
        }),
      }),
      async request => {
        try {
          // Static resources resolve first; otherwise the URI is matched
          // against the parameterized templates (atproto://profile/{actor},
          // atproto://feed/{actor}). Syntactically invalid actors fail the
          // template matchers and fall through to -32002 Resource not found.
          const resource = resolveResourceUri(request.params.uri, resources, templates);

          if (!resource) {
            // The MCP spec reserves -32002 for "Resource not found"; the SDK's
            // ErrorCode enum does not (yet) name it, so use the literal.
            throw new McpError(
              RESOURCE_NOT_FOUND_ERROR_CODE,
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
          // Per the MCP resource content schema, each item is either text
          // contents or base64 blob contents. Binary payloads must be passed
          // through as a blob, not coerced to empty text.
          return {
            contents: [
              content.blob
                ? {
                    uri: content.uri,
                    mimeType: content.mimeType,
                    blob: Buffer.from(content.blob).toString('base64'),
                  }
                : {
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

    this.logger.info(
      `Registered ${resources.length} MCP resources and ${templates.length} resource templates`
    );
  }

  /**
   * Register MCP prompts with the server
   */
  private registerPrompts(server: Server, prompts: BasePrompt[]): void {
    // Register prompts/list handler
    server.setRequestHandler(z.object({ method: z.literal('prompts/list') }), async () => ({
      prompts: prompts.map(prompt => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments ?? [],
      })),
    }));

    // Register prompts/get handler
    server.setRequestHandler(
      z.object({
        method: z.literal('prompts/get'),
        params: z.object({
          name: z.string(),
          arguments: z.record(z.string(), z.any()).optional(),
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

          // No availability/auth gate here: prompts are pure text templates
          // that never touch the AT Protocol client. Required arguments are
          // enforced inside prompt.get(), which throws an InvalidParams
          // McpError that toHandlerMcpError passes through verbatim.
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
   * Register the completion/complete handler (declared via the `completions`
   * capability).
   *
   * - ref/prompt: serves candidate values for enumerable prompt arguments
   *   (each prompt declares its own candidates); free-text arguments complete
   *   to an empty list, never an error. Unknown prompt names are invalid params.
   * - ref/resource: serves the {actor} variable of the resource templates with
   *   the authenticated user's handle when a session exists, else empty.
   *   Unknown templates/arguments complete to an empty list.
   */
  private registerCompletions(
    server: Server,
    prompts: BasePrompt[],
    templates: IResourceTemplate[]
  ): void {
    const completion = (
      values: string[]
    ): {
      completion: { values: string[]; total: number; hasMore: boolean };
    } => ({
      completion: { values, total: values.length, hasMore: false },
    });

    server.setRequestHandler(CompleteRequestSchema, async request => {
      const { ref, argument } = request.params;

      if (ref.type === 'ref/prompt') {
        const prompt = prompts.find(p => p.name === ref.name);
        if (!prompt) {
          throw new McpError(ErrorCode.InvalidParams, `Prompt not found: ${ref.name}`, {
            name: ref.name,
          });
        }
        return completion(prompt.getArgumentCompletions(argument.name, argument.value));
      }

      // ref/resource carries the RFC 6570 uriTemplate being completed.
      const template = templates.find(t => t.uriTemplate === ref.uri);
      if (!template || argument.name !== 'actor') {
        return completion([]);
      }

      // The only candidate we can offer for {actor} is the authenticated
      // user's own handle; unauthenticated servers have no candidates.
      const handle = this.atpClient.getSession()?.handle;
      if (typeof handle !== 'string') {
        return completion([]);
      }
      return completion(
        handle.toLowerCase().startsWith(argument.value.toLowerCase()) ? [handle] : []
      );
    });

    this.logger.info('Registered MCP completion handler');
  }

  /**
   * Convert Zod schema to JSON Schema for MCP compatibility
   *
   * Uses zod v4's native `z.toJSONSchema`, which replaced the external
   * zod-to-json-schema library (its v3 line reads zod's internal `_def`, which
   * zod v4 restructured, so it silently emitted schemas without a `type` and
   * the MCP SDK rejected every tool's inputSchema). Options:
   * - `target: 'draft-7'` reproduces the prior 'jsonSchema7' output.
   * - `io: 'input'` emits the client-facing input shape, so params with
   *   `.default()` stay optional (out of `required`) rather than being forced.
   * - `unrepresentable: 'any'` degrades unrepresentable types (e.g. `z.any()`)
   *   to `{}` instead of throwing, matching the old library's lenient behavior.
   */
  private zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
    const json = z.toJSONSchema(schema, {
      target: 'draft-7',
      io: 'input',
      unrepresentable: 'any',
    }) as Record<string, unknown>;
    // The `$schema` meta key is not part of an MCP inputSchema and some clients
    // are strict about it; drop it so we emit a clean JSON Schema object.
    delete json['$schema'];
    return json;
  }

  /**
   * Start the MCP server.
   *
   * By default the server speaks MCP over stdio. Pass
   * `{ transport: 'http' }` to serve the Streamable HTTP transport instead:
   * a node:http server routes POST/GET/DELETE on /mcp through per-session
   * StreamableHTTPServerTransport instances, each backed by a fresh MCP
   * Server built via the same construction path as the stdio server.
   */
  public async start(options: IServerStartOptions = {}): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Server is already running');
      return;
    }

    this.isShuttingDown = false;
    const transportKind: McpTransportKind = options.transport ?? 'stdio';

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

      if (transportKind === 'http') {
        await this.startHttpTransport(options);
      } else {
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
      }

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

      // Cleanup on failure — but never let a failing cleanup mask the
      // original startup error, which is the one the caller must see.
      try {
        await this.cleanup();
      } catch (cleanupError) {
        this.logger.error('Cleanup after failed startup also failed', cleanupError);
      }

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
   * Start the Streamable HTTP transport: a node:http server (no express
   * dependency) that routes /mcp through per-session transports.
   *
   * Binding defaults to the configured host, with 'localhost' pinned to the
   * IPv4 loopback 127.0.0.1 so the bind address (and the DNS-rebinding
   * allowlist) is deterministic across platforms whose resolvers disagree
   * about ::1 vs 127.0.0.1. Exposing the server beyond loopback (e.g.
   * --host 0.0.0.0) is the operator's responsibility to secure.
   */
  private async startHttpTransport(options: IServerStartOptions): Promise<void> {
    const config = this.configManager.getConfig();
    const requestedPort = options.port ?? config.port;
    const requestedHost = options.host ?? config.host;
    const bindHost = requestedHost === 'localhost' ? '127.0.0.1' : requestedHost;

    const httpServer = createNodeHttpServer((req, res) => {
      void this.handleHttpRequest(req, res).catch((error: unknown) => {
        this.logger.error('Unhandled HTTP request error', error);
        this.writeJsonRpcError(res, 500, ErrorCode.InternalError, 'Internal server error');
      });
    });

    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(requestedPort, bindHost, () => {
        httpServer.removeListener('error', reject);
        resolve();
      });
    });

    this.httpServer = httpServer;

    // The SDK's DNS-rebinding protection matches the raw Host header against
    // allowedHosts verbatim (host:port, verified against SDK 1.29), so the
    // allowlist must use the ACTUAL bound port (the requested port may be 0 =
    // ephemeral) and cover the loopback aliases a local client may dial.
    const address = httpServer.address();
    const boundPort =
      address !== null && typeof address === 'object' ? address.port : requestedPort;
    const hostNames = new Set<string>([requestedHost, bindHost, 'localhost', '127.0.0.1', '[::1]']);
    this.httpAllowedHosts = [...hostNames].map(name => `${name}:${boundPort}`);

    this.logger.info('Streamable HTTP transport listening', {
      host: bindHost,
      port: boundPort,
      path: '/mcp',
    });
  }

  /**
   * Route a single HTTP request. Only /mcp is served; the SDK transport does
   * the MCP-level work (method dispatch, session validation, SSE streaming).
   */
  private async handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname !== '/mcp') {
      this.writeJsonRpcError(res, 404, -32000, 'Not Found');
      return;
    }

    const rawSessionId = req.headers['mcp-session-id'];
    const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;

    if (req.method === 'POST') {
      // The transport expects a pre-parsed body when the request stream has
      // already been consumed (same contract as the SDK's express.json()
      // examples); reading it here also lets us bound the body size, which
      // the SDK transport does not (see MAX_HTTP_BODY_BYTES).
      const body = await this.readJsonBody(req, res);
      if (body === undefined) {
        return; // readJsonBody already responded (413/400).
      }

      const existing = sessionId !== undefined ? this.httpSessions.get(sessionId) : undefined;
      if (existing) {
        await existing.transport.handleRequest(req, res, body);
        return;
      }
      if (sessionId !== undefined) {
        this.writeJsonRpcError(res, 404, -32001, 'Session not found');
        return;
      }
      if (!isInitializeRequest(body)) {
        this.writeJsonRpcError(res, 400, -32000, 'Bad Request: Mcp-Session-Id header is required');
        return;
      }

      // New session: fresh MCP Server + transport pair.
      const session = await this.createHttpSession();
      await session.transport.handleRequest(req, res, body);
      if (session.transport.sessionId === undefined) {
        // Initialization was rejected (e.g. DNS-rebinding protection); the
        // session was never registered, so release the server immediately.
        await session.server.close();
      }
      return;
    }

    // GET (standalone SSE stream) and DELETE (session termination) — and any
    // other method, which the transport answers with 405 — must address an
    // established session.
    const session = sessionId !== undefined ? this.httpSessions.get(sessionId) : undefined;
    if (!session) {
      if (sessionId === undefined) {
        this.writeJsonRpcError(res, 400, -32000, 'Bad Request: Mcp-Session-Id header is required');
      } else {
        this.writeJsonRpcError(res, 404, -32001, 'Session not found');
      }
      return;
    }
    await session.transport.handleRequest(req, res);
  }

  /**
   * Create a Streamable HTTP session: a stateful transport (server-minted
   * session id) wired to a fresh MCP Server from the shared factory. The
   * session registers itself in httpSessions once the SDK accepts the
   * initialize request, and removes itself when the transport closes (DELETE,
   * client disconnect, or shutdown).
   */
  private async createHttpSession(): Promise<IHttpSession> {
    const server = this.createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      // DNS-rebinding protection: reject requests whose Host header is not in
      // the allowlist computed at bind time (403).
      enableDnsRebindingProtection: true,
      allowedHosts: this.httpAllowedHosts,
      onsessioninitialized: (newSessionId: string) => {
        this.httpSessions.set(newSessionId, { transport, server });
        this.logger.info('Streamable HTTP session initialized', { sessionId: newSessionId });
      },
      onsessionclosed: (closedSessionId: string) => {
        this.httpSessions.delete(closedSessionId);
        this.logger.info('Streamable HTTP session closed', { sessionId: closedSessionId });
      },
    });

    // Drop the session when the transport closes for any reason. Safe to set
    // before connect(): Protocol.connect chains a pre-existing onclose handler
    // (verified against SDK 1.29) instead of replacing it.
    transport.onclose = (): void => {
      const closedSessionId = transport.sessionId;
      if (closedSessionId !== undefined) {
        this.httpSessions.delete(closedSessionId);
      }
    };

    await server.connect(transport);
    return { transport, server };
  }

  /**
   * Read and parse a JSON request body, bounding its size. Responds (413/400)
   * and resolves to undefined when the body is unusable; the caller must stop
   * processing the request in that case.
   */
  private readJsonBody(req: IncomingMessage, res: ServerResponse): Promise<unknown> {
    return new Promise(resolve => {
      const chunks: Buffer[] = [];
      let received = 0;
      let finished = false;

      const fail = (status: number, code: number, message: string): void => {
        if (finished) {
          return;
        }
        finished = true;
        this.writeJsonRpcError(res, status, code, message);
        // Discard whatever else the client is still sending; the Connection:
        // close header (set for 413) ends the socket once the response flushes.
        req.resume();
        resolve(undefined);
      };

      req.on('data', (chunk: Buffer) => {
        if (finished) {
          return;
        }
        received += chunk.length;
        if (received > MAX_HTTP_BODY_BYTES) {
          chunks.length = 0;
          fail(413, -32000, `Payload Too Large: request body exceeds ${MAX_HTTP_BODY_BYTES} bytes`);
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => {
        if (finished) {
          return;
        }
        finished = true;
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          this.writeJsonRpcError(res, 400, ErrorCode.ParseError, 'Parse error: Invalid JSON');
          resolve(undefined);
        }
      });

      req.on('error', () => {
        fail(400, -32000, 'Bad Request: failed to read request body');
      });
    });
  }

  /**
   * Write a JSON-RPC-shaped HTTP error response (the same shape the SDK
   * transport uses for its own protocol-level rejections).
   */
  private writeJsonRpcError(
    res: ServerResponse,
    status: number,
    code: number,
    message: string
  ): void {
    if (res.headersSent) {
      res.end();
      return;
    }
    res.writeHead(status, {
      'Content-Type': 'application/json',
      // 413 responses must not leave the connection open mid-upload.
      ...(status === 413 ? { Connection: 'close' } : {}),
    });
    res.end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }));
  }

  /**
   * The address the http transport is bound to, or null when the http
   * transport is not running. Exposed so callers (and tests binding port 0)
   * can discover the actual ephemeral port.
   */
  public getHttpAddress(): { host: string; port: number } | null {
    const address = this.httpServer?.address();
    if (address == null || typeof address === 'string') {
      return null;
    }
    return { host: address.address, port: address.port };
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
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }

    // Close every live Streamable HTTP session. Closing the per-session MCP
    // server also closes its transport, which unregisters the session from
    // the map via the transport's onclose handler.
    for (const [sessionId, session] of [...this.httpSessions]) {
      try {
        await session.server.close();
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
      this.httpSessions.delete(sessionId);
    }

    // Stop the http listener. closeAllConnections() drops keep-alive and SSE
    // sockets that would otherwise keep close() pending indefinitely.
    if (this.httpServer) {
      const httpServer = this.httpServer;
      this.httpServer = null;
      try {
        await new Promise<void>((resolve, reject) => {
          httpServer.close(err => (err ? reject(err) : resolve()));
          httpServer.closeAllConnections();
        });
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
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
