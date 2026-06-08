/**
 * Security utilities for production deployment
 */

import type { Logger } from './logger.js';

export interface IRateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  /**
   * Maximum number of distinct identifiers tracked at once. When exceeded, the
   * least-recently-used entry is evicted. Bounds memory so a flood of distinct
   * (e.g. attacker-controlled) keys cannot exhaust the heap between cleanup
   * sweeps. Defaults to 50_000.
   */
  maxTrackedIdentifiers?: number;
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
  private readonly cleanupTimer: NodeJS.Timeout;
  private readonly maxTrackedIdentifiers: number;

  constructor(config: IRateLimitConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.maxTrackedIdentifiers = config.maxTrackedIdentifiers ?? 50_000;

    // Clean up old entries periodically. unref() so the timer never keeps the
    // process alive on its own.
    this.cleanupTimer = setInterval(() => this.cleanup(), this.config.windowMs);
    this.cleanupTimer.unref();
  }

  /** Stop the background cleanup timer and clear tracked state. */
  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.requests.clear();
  }

  /**
   * Check if request is allowed for the given identifier
   */
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get existing requests for this identifier and drop those outside the window.
    const userRequests = this.requests.get(identifier) ?? [];
    const recentRequests = userRequests.filter(timestamp => timestamp > windowStart);

    // Delete first so the subsequent set() moves this key to the most-recently-
    // used position (Map preserves insertion order; last inserted = most recent).
    this.requests.delete(identifier);

    // Check if limit exceeded
    if (recentRequests.length >= this.config.maxRequests) {
      this.requests.set(identifier, recentRequests);
      this.logger.warn('Rate limit exceeded', {
        identifier,
        requests: recentRequests.length,
        limit: this.config.maxRequests,
      });
      return false;
    }

    // Add current request
    recentRequests.push(now);

    // Bound the identifier cardinality: when at capacity and inserting a NEW
    // key, evict the least-recently-used (oldest-inserted) entry so a flood of
    // distinct identifiers cannot exhaust memory between cleanup sweeps.
    if (this.requests.size >= this.maxTrackedIdentifiers) {
      const lruKey = this.requests.keys().next().value;
      if (lruKey !== undefined) {
        this.requests.delete(lruKey);
      }
    }

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
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const userRequests = (this.requests.get(identifier) ?? []).filter(
      timestamp => timestamp > windowStart
    );
    if (userRequests.length === 0) {
      return now;
    }

    // Reduce-based min (no array spread, which can overflow the call stack for
    // very large arrays).
    const oldestRequest = userRequests.reduce((min, t) => (t < min ? t : min), Infinity);
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
 * Security manager that coordinates all security components
 */
export class SecurityManager {
  private inputSanitizer: InputSanitizer;
  private rateLimiter: RateLimiter;
  private errorSanitizer: ErrorSanitizer;
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
  }

  /**
   * Check whether a request for the given identifier may proceed. Returns true
   * (allowed) when rate limiting is disabled in config.
   */
  checkRateLimit(identifier: string): boolean {
    if (!this.config.enableRateLimit) {
      return true;
    }
    return this.rateLimiter.isAllowed(identifier);
  }

  /** Release background resources (rate-limiter cleanup timer). */
  destroy(): void {
    this.rateLimiter.destroy();
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

  /**
   * Get security metrics
   */
  getMetrics() {
    return {
      rateLimiter: this.rateLimiter.getMetrics(),
      config: {
        inputSanitizationEnabled: this.config.enableInputSanitization,
        rateLimitEnabled: this.config.enableRateLimit,
        errorSanitizationEnabled: this.config.enableErrorSanitization,
        maxInputLength: this.config.maxInputLength,
      },
    };
  }
}
