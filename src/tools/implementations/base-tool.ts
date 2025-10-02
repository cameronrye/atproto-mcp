/**
 * Base class for AT Protocol MCP tools
 * Provides common functionality and error handling
 * Supports both authenticated and unauthenticated modes
 */

import { z } from 'zod';
import type { AtpClient } from '../../utils/atp-client.js';
import type { IMcpTool } from '../index.js';
import { Logger } from '../../utils/logger.js';
import { AtpError, AuthenticationError, ValidationError } from '../../types/index.js';

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
   * Validate AT Protocol identifier (DID or handle)
   */
  protected validateActor(actor: string): void {
    if (!actor || typeof actor !== 'string') {
      throw new ValidationError('Actor must be a non-empty string');
    }

    // Basic validation for DID or handle format
    const isDid = actor.startsWith('did:');
    const isHandle = actor.includes('.') && !actor.startsWith('http');

    if (!isDid && !isHandle) {
      throw new ValidationError(
        'Actor must be a valid DID (did:...) or handle (user.domain.com)',
        'actor',
        actor
      );
    }
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
