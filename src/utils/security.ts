/**
 * Security utilities for production deployment
 */

import type { Logger } from './logger.js';

export interface IRateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface ISecurityConfig {
  enableInputSanitization: boolean;
  enableRateLimit: boolean;
  enableErrorSanitization: boolean;
  maxInputLength: number;
  allowedOrigins: string[];
  trustedProxies: string[];
}

/**
 * Input sanitizer to prevent injection attacks
 */
export class InputSanitizer {
  private logger: Logger;
  private maxLength: number;

  constructor(maxLength: number, logger: Logger) {
    this.maxLength = maxLength;
    this.logger = logger;
  }

  /**
   * Sanitize string input by removing potentially dangerous characters
   */
  sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }

    if (input.length > this.maxLength) {
      this.logger.warn('Input length exceeded maximum', {
        length: input.length,
        maxLength: this.maxLength,
      });
      throw new Error(`Input length exceeds maximum of ${this.maxLength} characters`);
    }

    // Remove potentially dangerous characters
    let sanitized = input
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/data:/gi, '') // Remove data: protocol
      .replace(/vbscript:/gi, '') // Remove vbscript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/\0/g, ''); // Remove null bytes

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
  }

  /**
   * Sanitize object by recursively sanitizing all string values
   */
  sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key);
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Validate AT Protocol identifiers (DIDs, handles, etc.)
   */
  validateAtProtoIdentifier(identifier: string): boolean {
    if (!identifier || typeof identifier !== 'string') {
      return false;
    }

    // DID format: did:method:identifier
    if (identifier.startsWith('did:')) {
      return /^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/.test(identifier);
    }

    // Handle format: user.domain.tld
    if (identifier.includes('.')) {
      return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
        identifier
      );
    }

    return false;
  }

  /**
   * Validate URI format
   */
  validateUri(uri: string): boolean {
    try {
      const url = new URL(uri);
      return ['http:', 'https:', 'at:'].includes(url.protocol);
    } catch {
      return false;
    }
  }
}

/**
 * Rate limiter to prevent abuse
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: IRateLimitConfig;
  private logger: Logger;

  constructor(config: IRateLimitConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;

    // Clean up old entries periodically
    setInterval(() => this.cleanup(), this.config.windowMs);
  }

  /**
   * Check if request is allowed for the given identifier
   */
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get existing requests for this identifier
    const userRequests = this.requests.get(identifier) || [];

    // Filter out requests outside the current window
    const recentRequests = userRequests.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    if (recentRequests.length >= this.config.maxRequests) {
      this.logger.warn('Rate limit exceeded', {
        identifier,
        requests: recentRequests.length,
        limit: this.config.maxRequests,
      });
      return false;
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);

    return true;
  }

  /**
   * Get remaining requests for identifier
   */
  getRemaining(identifier: string): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const userRequests = this.requests.get(identifier) || [];
    const recentRequests = userRequests.filter(timestamp => timestamp > windowStart);

    return Math.max(0, this.config.maxRequests - recentRequests.length);
  }

  /**
   * Get reset time for identifier
   */
  getResetTime(identifier: string): number {
    const userRequests = this.requests.get(identifier) || [];
    if (userRequests.length === 0) {
      return Date.now();
    }

    const oldestRequest = Math.min(...userRequests);
    return oldestRequest + this.config.windowMs;
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [identifier, requests] of this.requests.entries()) {
      const recentRequests = requests.filter(timestamp => timestamp > windowStart);

      if (recentRequests.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, recentRequests);
      }
    }
  }

  /**
   * Get rate limiter metrics
   */
  getMetrics() {
    return {
      trackedIdentifiers: this.requests.size,
      totalRequests: Array.from(this.requests.values()).reduce(
        (sum, requests) => sum + requests.length,
        0
      ),
    };
  }
}

/**
 * Error sanitizer to prevent information leakage
 */
export class ErrorSanitizer {
  private logger: Logger;
  private isDevelopment: boolean;

  constructor(logger: Logger, isDevelopment = false) {
    this.logger = logger;
    this.isDevelopment = isDevelopment;
  }

  /**
   * Sanitize error for client response
   */
  sanitizeError(error: Error | any): { message: string; code?: number } {
    // Log the full error for debugging
    this.logger.error('Error occurred', error);

    // In development, return more detailed errors
    if (this.isDevelopment) {
      return {
        message: error.message || 'An error occurred',
        code: error.code || -32000,
      };
    }

    // In production, return generic errors to prevent information leakage
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /key/i,
      /secret/i,
      /credential/i,
      /auth/i,
      /session/i,
      /cookie/i,
      /header/i,
      /internal/i,
      /database/i,
      /connection/i,
      /file/i,
      /path/i,
    ];

    const errorMessage = error.message || 'An error occurred';
    const containsSensitiveInfo = sensitivePatterns.some(pattern => pattern.test(errorMessage));

    if (containsSensitiveInfo) {
      return {
        message: 'An internal error occurred',
        code: -32000,
      };
    }

    // Return sanitized error message
    return {
      message: errorMessage.substring(0, 200), // Limit message length
      code: error.code || -32000,
    };
  }

  /**
   * Sanitize stack trace for logging
   */
  sanitizeStackTrace(error: Error): string {
    if (!error.stack) {
      return 'No stack trace available';
    }

    // Remove sensitive file paths and replace with generic indicators
    return error.stack
      .replace(/\/[^/\s]+\/[^/\s]+\/[^/\s]+/g, '/***/***/***') // Replace deep paths
      .replace(/at\s+[^(]+\([^)]+\)/g, 'at *** (***:***:***)') // Replace function locations
      .split('\n')
      .slice(0, 10) // Limit stack trace depth
      .join('\n');
  }
}

/**
 * Credential manager for secure storage
 */
export class CredentialManager {
  private logger: Logger;
  private credentials: Map<string, string> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Store credential securely (in production, this would use proper encryption)
   */
  store(key: string, value: string): void {
    if (!key || !value) {
      throw new Error('Key and value are required');
    }

    // In production, this should use proper encryption
    // For now, we'll just store it in memory with basic obfuscation
    const obfuscated = Buffer.from(value).toString('base64');
    this.credentials.set(key, obfuscated);

    this.logger.debug('Credential stored', { key: `${key.substring(0, 8)}***` });
  }

  /**
   * Retrieve credential
   */
  retrieve(key: string): string | undefined {
    const obfuscated = this.credentials.get(key);
    if (!obfuscated) {
      return undefined;
    }

    try {
      return Buffer.from(obfuscated, 'base64').toString();
    } catch (error) {
      this.logger.error('Failed to retrieve credential', error as Error, { key });
      return undefined;
    }
  }

  /**
   * Delete credential
   */
  delete(key: string): boolean {
    const deleted = this.credentials.delete(key);
    if (deleted) {
      this.logger.debug('Credential deleted', { key: `${key.substring(0, 8)}***` });
    }
    return deleted;
  }

  /**
   * Clear all credentials
   */
  clear(): void {
    this.credentials.clear();
    this.logger.info('All credentials cleared');
  }

  /**
   * Get credential count (for monitoring)
   */
  getCount(): number {
    return this.credentials.size;
  }
}

/**
 * Security manager that coordinates all security components
 */
export class SecurityManager {
  private inputSanitizer: InputSanitizer;
  private rateLimiter: RateLimiter;
  private errorSanitizer: ErrorSanitizer;
  private credentialManager: CredentialManager;
  private config: ISecurityConfig;
  private logger: Logger;

  constructor(config: ISecurityConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;

    this.inputSanitizer = new InputSanitizer(config.maxInputLength, logger);
    this.rateLimiter = new RateLimiter(
      {
        windowMs: 60000, // 1 minute
        maxRequests: 100, // 100 requests per minute
      },
      logger
    );
    this.errorSanitizer = new ErrorSanitizer(logger, process.env['NODE_ENV'] === 'development');
    this.credentialManager = new CredentialManager(logger);
  }

  getInputSanitizer(): InputSanitizer {
    return this.inputSanitizer;
  }

  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  getErrorSanitizer(): ErrorSanitizer {
    return this.errorSanitizer;
  }

  getCredentialManager(): CredentialManager {
    return this.credentialManager;
  }

  /**
   * Get security metrics
   */
  getMetrics() {
    return {
      rateLimiter: this.rateLimiter.getMetrics(),
      credentialCount: this.credentialManager.getCount(),
      config: {
        inputSanitizationEnabled: this.config.enableInputSanitization,
        rateLimitEnabled: this.config.enableRateLimit,
        errorSanitizationEnabled: this.config.enableErrorSanitization,
        maxInputLength: this.config.maxInputLength,
      },
    };
  }
}
