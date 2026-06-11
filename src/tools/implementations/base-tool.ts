/**
 * Base class for AT Protocol MCP tools
 * Provides common functionality and error handling
 * Supports both authenticated and unauthenticated modes
 */

import { z } from 'zod';
import { RichText } from '@atproto/api';
import type { AtpClient } from '../../utils/atp-client.js';
import type { IMcpTool } from '../index.js';
import { Logger } from '../../utils/logger.js';
import {
  AtpError,
  AuthenticationError,
  type IAtpPost,
  ValidationError,
} from '../../types/index.js';

/**
 * Schema for a pre-uploaded blob descriptor, the JSON shape upload_image /
 * upload_video / generate_link_preview return (`ref` as a flat CID string) and
 * the lexicon form found in existing records (`ref` as a { $link } object).
 * MCP parameters arrive as JSON, so a binary Blob can never be transported —
 * tools that attach media accept this descriptor and reference the
 * already-uploaded blob instead of re-uploading.
 */
export const BlobDescriptorSchema = z.object({
  type: z
    .literal('blob')
    .optional()
    .describe('Discriminator emitted by upload_image; always "blob" when present. May be omitted.'),
  ref: z
    .union([
      z
        .string()
        .min(1, 'Blob ref CID cannot be empty')
        .describe('CID of the uploaded blob as a flat string (e.g. "bafkrei…").'),
      z
        .object({
          $link: z
            .string()
            .min(1, 'Blob ref $link CID cannot be empty')
            .describe('CID of the uploaded blob (e.g. "bafkrei…").'),
        })
        .describe('Lexicon blob-ref object wrapping the CID as { "$link": "<cid>" }.'),
    ])
    .describe(
      'CID reference of the uploaded blob: either the flat string returned by upload_image, or the lexicon { "$link": "<cid>" } object form.'
    ),
  mimeType: z
    .string()
    .min(1, 'Blob mimeType is required')
    .describe('MIME type of the uploaded blob (e.g. "image/jpeg").'),
  size: z.number().int().positive().describe('Size of the uploaded blob in bytes.'),
});

export type BlobDescriptor = z.infer<typeof BlobDescriptorSchema>;

/**
 * Convert a pre-uploaded blob descriptor into the lexicon blob form required
 * inside a record: { $type: 'blob', ref: { $link: <cid> }, mimeType, size }.
 * The blob already lives on the PDS (upload_image et al. uploaded it), so this
 * is a pure reshaping — no network call and no re-upload.
 */
export function blobDescriptorToLex(descriptor: BlobDescriptor): {
  $type: 'blob';
  ref: { $link: string };
  mimeType: string;
  size: number;
} {
  return {
    $type: 'blob',
    ref: { $link: typeof descriptor.ref === 'string' ? descriptor.ref : descriptor.ref.$link },
    mimeType: descriptor.mimeType,
    size: descriptor.size,
  };
}

/**
 * Tool authentication requirements
 */
export enum ToolAuthMode {
  PUBLIC = 'public', // Works without authentication
  PRIVATE = 'private', // Requires authentication
  ENHANCED = 'enhanced', // Works without auth but provides more data with auth
}

/**
 * Abstract base class for all AT Protocol MCP tools
 */
export abstract class BaseTool implements IMcpTool {
  protected atpClient: AtpClient;
  protected logger: Logger;
  protected authMode: ToolAuthMode;

  public abstract readonly schema: {
    method: string;
    description: string;
    params?: z.ZodSchema;
    outputSchema?: Record<string, unknown>;
  };

  constructor(
    atpClient: AtpClient,
    toolName: string,
    authMode: ToolAuthMode = ToolAuthMode.PRIVATE
  ) {
    this.atpClient = atpClient;
    this.logger = new Logger(`Tool:${toolName}`);
    this.authMode = authMode;
  }

  /**
   * Main handler method that validates input and executes the tool
   */
  public async handler(params: unknown): Promise<any> {
    const startTime = Date.now();

    try {
      this.logger.debug('Tool execution started', {
        method: this.schema.method,
        params: this.sanitizeParams(params),
      });

      // Validate parameters if schema is provided
      let validatedParams = params;
      if (this.schema.params) {
        try {
          validatedParams = this.schema.params.parse(params);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const issues = error.issues
              .map(issue => `${issue.path.join('.')}: ${issue.message}`)
              .join(', ');
            throw new ValidationError(`Invalid parameters: ${issues}`, undefined, params, {
              method: this.schema.method,
            });
          }
          throw error;
        }
      }

      // Execute the tool implementation
      const result = await this.execute(validatedParams);

      const duration = Date.now() - startTime;
      this.logger.info('Tool execution completed', {
        method: this.schema.method,
        duration,
        success: true,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Tool execution failed', error, {
        method: this.schema.method,
        duration,
        params: this.sanitizeParams(params),
      });

      // Re-throw the error for MCP to handle
      throw error;
    }
  }

  /**
   * Abstract method that each tool must implement
   */
  protected abstract execute(params: any): Promise<any>;

  /**
   * Check if this tool is available in the current authentication mode
   *
   * - PUBLIC tools: Always available (no authentication needed)
   * - ENHANCED tools: Always available (work better with authentication but don't require it)
   * - PRIVATE tools: Only available when authenticated
   */
  public isAvailable(): boolean {
    // PUBLIC and ENHANCED tools are always available
    if (this.authMode === ToolAuthMode.PUBLIC || this.authMode === ToolAuthMode.ENHANCED) {
      return true;
    }

    // PRIVATE tools require active authentication
    if (this.authMode === ToolAuthMode.PRIVATE) {
      return this.atpClient.isAuthenticated();
    }

    return false;
  }

  /**
   * Get availability status message
   *
   * Provides a human-readable message explaining the tool's availability status.
   */
  public getAvailabilityMessage(): string {
    if (this.isAvailable()) {
      return 'Available';
    }

    if (this.authMode === ToolAuthMode.PRIVATE) {
      if (!this.atpClient.hasCredentials()) {
        return 'Requires authentication - please provide credentials';
      }
      if (!this.atpClient.isAuthenticated()) {
        return 'Authentication credentials provided but not authenticated - please authenticate';
      }
    }

    return 'Not available';
  }

  /**
   * Execute an AT Protocol operation with error handling
   * Automatically handles authentication requirements based on tool mode
   */
  protected async executeAtpOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: Record<string, unknown>
  ): Promise<T> {
    // Check if tool is available
    if (!this.isAvailable() && this.authMode === ToolAuthMode.PRIVATE) {
      throw new AuthenticationError(
        `This operation requires authentication. ${this.getAvailabilityMessage()}`,
        undefined,
        { ...context, tool: this.schema.method, operation: operationName, authMode: this.authMode }
      );
    }

    // Choose the appropriate execution method based on auth mode
    let result;
    if (this.authMode === ToolAuthMode.PUBLIC) {
      result = await this.atpClient.executePublicRequest(operation, {
        ...context,
        tool: this.schema.method,
        operation: operationName,
      });
    } else if (this.authMode === ToolAuthMode.PRIVATE) {
      result = await this.atpClient.executeAuthenticatedRequest(operation, {
        ...context,
        tool: this.schema.method,
        operation: operationName,
      });
    } else {
      // ENHANCED mode
      // Try authenticated first, fall back to public
      if (this.atpClient.isAuthenticated()) {
        result = await this.atpClient.executeAuthenticatedRequest(operation, {
          ...context,
          tool: this.schema.method,
          operation: operationName,
        });
      } else {
        result = await this.atpClient.executePublicRequest(operation, {
          ...context,
          tool: this.schema.method,
          operation: operationName,
        });
      }
    }

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  /**
   * Sanitize parameters for logging (remove sensitive data)
   */
  private sanitizeParams(params: unknown): unknown {
    if (typeof params !== 'object' || params === null) {
      return params;
    }

    const sanitized = { ...(params as Record<string, unknown>) };

    // Remove potentially sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Detect AT Protocol richtext facets (mentions, links, hashtags) in post text.
   *
   * `agent.post()` does NOT auto-detect facets, so without this, @mentions,
   * URLs, and #hashtags are stored as inert plain text (not clickable, mentions
   * not resolved to DIDs). This resolves mentions to DIDs via the agent and
   * returns the text plus any detected facets to attach to the record.
   */
  protected async buildRichText(
    text: string
  ): Promise<{ text: string; facets?: RichText['facets'] }> {
    // Enforce the AT Protocol post-text limits (300 graphemes / 3000 UTF-8 bytes).
    this.assertPostTextWithinLimits(text);

    const rt = new RichText({ text });

    try {
      await rt.detectFacets(this.atpClient.getAgent());
    } catch (error) {
      // Facet detection requires network calls (handle resolution). If it fails,
      // fall back to posting the plain text rather than failing the whole post.
      this.logger.warn('Facet detection failed; posting without facets', error as Error);
    }
    return rt.facets && rt.facets.length > 0
      ? { text: rt.text, facets: rt.facets }
      : { text: rt.text };
  }

  /**
   * Enforce the AT Protocol post-text limits: 300 GRAPHEMES and 3000 UTF-8 BYTES.
   * Counted on graphemes (not String.length / UTF-16 code units) so an emoji-heavy
   * post is not falsely rejected and the byte cap is actually checked. Shared by
   * buildRichText (auto-detect path) and the explicit-facets post path so both
   * enforce the limit identically.
   */
  protected assertPostTextWithinLimits(text: string): void {
    const rt = new RichText({ text });
    if (rt.graphemeLength > 300) {
      throw new ValidationError(
        `Post text is ${rt.graphemeLength} graphemes; the maximum is 300.`,
        'text'
      );
    }
    const byteLength = Buffer.byteLength(rt.text, 'utf8');
    if (byteLength > 3000) {
      throw new ValidationError(`Post text is ${byteLength} bytes; the maximum is 3000.`, 'text');
    }
  }

  /**
   * Resolve an actor (DID or handle) to a DID.
   *
   * Many AT Protocol records (list items, moderation subjects, blocks) require a
   * DID as the subject — passing a handle produces an invalid record. If the
   * actor is already a DID it is returned as-is; otherwise the handle is resolved.
   */
  protected async resolveDid(actor: string): Promise<string> {
    if (actor.startsWith('did:')) {
      return actor;
    }
    const response = await this.executeAtpOperation(
      async () => {
        const agent = this.atpClient.getAgent();
        return await agent.com.atproto.identity.resolveHandle({ handle: actor });
      },
      'resolveHandle',
      { actor }
    );
    return response.data.did;
  }

  /**
   * Validate AT Protocol identifier (DID or handle)
   */
  protected validateActor(actor: string): void {
    if (!actor || typeof actor !== 'string') {
      throw new ValidationError('Actor must be a non-empty string');
    }
    if (actor.length > 2048) {
      throw new ValidationError('Actor is too long', 'actor', actor);
    }

    // A DID (did:method:id) or a DNS-style handle. The previous "contains a dot"
    // heuristic accepted traversal/scheme-like junk (e.g. "../../etc",
    // "javascript:alert(1)//.x") as handles; validate the real structure instead.
    // The identifier portion allows ':' so did:web host:port:path segments
    // (e.g. did:web:example.com:user:alice) are not rejected.
    const isDid = /^did:[a-z0-9]+:[a-zA-Z0-9._:%-]+$/.test(actor);
    if (!isDid && !this.isValidHandle(actor)) {
      throw new ValidationError(
        'Actor must be a valid DID (did:...) or handle (user.domain.com)',
        'actor',
        actor
      );
    }
  }

  /**
   * Validate a DNS-style AT Protocol handle. Splits on '.' and checks each label
   * independently so the check is linear (no catastrophic-backtracking risk) — a
   * valid handle has at least two labels, each a DNS label (1-63 chars,
   * alphanumeric with optional internal hyphens).
   */
  private isValidHandle(handle: string): boolean {
    const labels = handle.split('.');
    if (labels.length < 2) {
      return false;
    }
    const label = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    return labels.every(part => label.test(part));
  }

  /**
   * Validate AT Protocol URI
   */
  protected validateAtUri(uri: string): void {
    if (!uri || typeof uri !== 'string') {
      throw new ValidationError('URI must be a non-empty string');
    }

    if (!uri.startsWith('at://')) {
      throw new ValidationError('URI must be a valid AT Protocol URI (at://...)', 'uri', uri);
    }
  }

  /**
   * Parse an AT Protocol URI (at://<repo>/<collection>/<rkey>) into its parts.
   * Throws if the URI is malformed.
   */
  protected parseAtUri(uri: string): { repo: string; collection: string; rkey: string } {
    if (!uri?.startsWith('at://')) {
      throw new Error(`Invalid AT Protocol URI: ${uri}`);
    }

    const parts = uri.slice('at://'.length).split('/');
    const [repo, collection, rkey] = parts;
    if (parts.length < 3 || !repo || !collection || !rkey) {
      throw new Error(`Malformed AT Protocol URI: ${uri}`);
    }

    return { repo, collection, rkey };
  }

  /**
   * Fetch a single post view (app.bsky.feed.getPosts) for the given AT-URI. The
   * returned view carries both the post CID and the caller's viewer state
   * (like/repost), so callers that need both can do it in one round-trip rather
   * than a separate getRecord + getPosts. Returns undefined if the post is not
   * found.
   */
  protected async getPostView(
    uri: string
  ): Promise<{ cid?: string; viewer?: { like?: string; repost?: string } } | undefined> {
    const response = await this.executeAtpOperation(
      async () => {
        const agent = this.atpClient.getAgent();
        return await agent.getPosts({ uris: [uri] });
      },
      'getPosts',
      { uri }
    );
    return response.data.posts[0];
  }

  /**
   * Resolve the CID of the record referenced by an AT Protocol URI by fetching
   * the record. Throws a clear error if the URI is malformed or has no CID.
   */
  protected async getCidFromUri(uri: string): Promise<string> {
    try {
      this.logger.debug('Resolving CID from URI', { uri });
      const { repo, collection, rkey } = this.parseAtUri(uri);

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.com.atproto.repo.getRecord({ repo, collection, rkey });
        },
        'getRecord',
        { uri, repo, collection, rkey }
      );

      const cid = response.data.cid;
      if (!cid) {
        throw new Error(`No CID found in record response for URI: ${uri}`);
      }

      this.logger.debug('Successfully resolved CID from URI', { uri, cid });
      return cid;
    } catch (error) {
      this.logger.error('Failed to resolve CID from URI', error, { uri });
      // Preserve typed errors (AuthenticationError, RateLimitError, ValidationError,
      // and other AtpErrors) so the server maps them to the correct MCP error code
      // and the caller keeps the original cause. Only wrap genuinely unknown errors.
      if (error instanceof AtpError || error instanceof ValidationError) {
        throw error;
      }
      throw new Error(
        `Could not resolve CID from URI ${uri}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Validate CID
   */
  protected validateCid(cid: string): void {
    if (!cid || typeof cid !== 'string') {
      throw new ValidationError('CID must be a non-empty string');
    }

    // Basic CID validation (should start with 'bafy' for most cases)
    if (!cid.match(/^[a-z0-9]+$/i)) {
      throw new ValidationError('CID must be a valid content identifier', 'cid', cid);
    }
  }

  /**
   * Validate ISO 8601 date format
   *
   * Ensures the provided date string is a valid ISO 8601 timestamp.
   * Examples of valid formats:
   * - 2024-01-15T10:30:00Z
   * - 2024-01-15T10:30:00.000Z
   * - 2024-01-15T10:30:00+00:00
   */
  protected validateISO8601Date(dateString: string, fieldName: string = 'date'): void {
    if (!dateString || typeof dateString !== 'string') {
      throw new ValidationError(`${fieldName} must be a non-empty string`);
    }

    // Parse the date string
    const date = new Date(dateString);

    // Check if the date is valid
    if (isNaN(date.getTime())) {
      throw new ValidationError(
        `${fieldName} must be a valid ISO 8601 timestamp (e.g., 2024-01-15T10:30:00Z)`,
        fieldName,
        dateString
      );
    }

    // Verify it's in ISO 8601 format by checking if it contains 'T' separator
    // and either 'Z' or timezone offset
    const iso8601Pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})$/;
    if (!iso8601Pattern.test(dateString)) {
      throw new ValidationError(
        `${fieldName} must be in ISO 8601 format (e.g., 2024-01-15T10:30:00Z)`,
        fieldName,
        dateString
      );
    }
  }

  /**
   * Map an app.bsky.feed.defs#postView (as returned by searchPosts/getTimeline/
   * getAuthorFeed) into the server's normalized IAtpPost shape. Shared so the
   * search and timeline tools do not each carry an identical copy.
   */
  protected transformPostView(postData: any): IAtpPost {
    return {
      uri: postData.uri,
      cid: postData.cid,
      author: {
        did: postData.author.did,
        handle: postData.author.handle,
        displayName: postData.author.displayName,
        description: postData.author.description,
        avatar: postData.author.avatar,
        followersCount: postData.author.followersCount,
        followsCount: postData.author.followsCount,
        postsCount: postData.author.postsCount,
      },
      record: {
        text: postData.record.text || '',
        createdAt: postData.record.createdAt,
        reply: postData.record.reply
          ? {
              root: {
                uri: postData.record.reply.root.uri,
                cid: postData.record.reply.root.cid,
              },
              parent: {
                uri: postData.record.reply.parent.uri,
                cid: postData.record.reply.parent.cid,
              },
            }
          : undefined,
        embed: postData.record.embed,
        langs: postData.record.langs,
        labels: postData.record.labels,
        tags: postData.record.tags,
      },
      replyCount: postData.replyCount,
      repostCount: postData.repostCount,
      likeCount: postData.likeCount,
      indexedAt: postData.indexedAt,
      viewer: postData.viewer
        ? {
            repost: postData.viewer.repost,
            like: postData.viewer.like,
          }
        : undefined,
    };
  }

  /**
   * Format error for MCP response
   */
  protected formatError(error: unknown): never {
    if (error instanceof AtpError || error instanceof ValidationError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new AtpError(error.message, 'TOOL_EXECUTION_ERROR', undefined, error, {
        tool: this.schema.method,
      });
    }

    throw new AtpError(
      'Unknown error occurred during tool execution',
      'UNKNOWN_TOOL_ERROR',
      undefined,
      error,
      { tool: this.schema.method }
    );
  }
}
