/**
 * Tests for error classes
 */

import { describe, it, expect } from 'vitest';
import {
  BaseError,
  AtpError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  ConfigurationError,
} from '../index.js';

// BaseError is abstract only at the type level; instantiate it directly so the
// `error.name === 'BaseError'` assertion (name comes from constructor.name)
// keeps testing the real class rather than a test-only subclass.
const ConcreteBaseError = BaseError as unknown as new (
  message: string,
  code: string,
  context?: Record<string, unknown>
) => BaseError;

describe('Error Classes', () => {
  describe('BaseError', () => {
    it('should create error with message and code', () => {
      const error = new ConcreteBaseError('Test error', 'TEST_CODE');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.context).toBeUndefined();
      expect(error.name).toBe('BaseError');
    });

    it('should create error with context', () => {
      const context = { userId: '123', action: 'test' };
      const error = new ConcreteBaseError('Test error', 'TEST_CODE', context);
      expect(error.context).toEqual(context);
    });

    it('should be instanceof Error', () => {
      const error = new ConcreteBaseError('Test', 'CODE');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BaseError);
    });
  });

  describe('AtpError', () => {
    it('should create ATP error with status code', () => {
      const error = new AtpError('ATP failed', 'ATP_ERROR', 500);
      expect(error.message).toBe('ATP failed');
      expect(error.code).toBe('ATP_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(AtpError);
    });

    it('should create ATP error with details', () => {
      const details = { reason: 'Network timeout' };
      const error = new AtpError('Request failed', 'NETWORK_ERROR', 503, details);
      expect(error.details).toEqual(details);
    });

    it('should create ATP error with context', () => {
      const context = { endpoint: '/api/test' };
      const error = new AtpError('API error', 'API_ERROR', 400, undefined, context);
      expect(error.context).toEqual(context);
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error', () => {
      const error = new AuthenticationError('Invalid credentials');
      expect(error.message).toBe('Invalid credentials');
      expect(error.code).toBe('AUTHENTICATION_FAILED');
      expect(error.statusCode).toBe(401);
      expect(error).toBeInstanceOf(AtpError);
      expect(error).toBeInstanceOf(AuthenticationError);
    });

    it('should create authentication error with details', () => {
      const details = { reason: 'Token expired' };
      const error = new AuthenticationError('Auth failed', details);
      expect(error.details).toEqual(details);
    });

    it('should create authentication error with context', () => {
      const context = { user: 'test@example.com' };
      const error = new AuthenticationError('Login failed', undefined, context);
      expect(error.context).toEqual(context);
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error', () => {
      const error = new RateLimitError('Too many requests');
      expect(error.message).toBe('Too many requests');
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.statusCode).toBe(429);
      expect(error).toBeInstanceOf(AtpError);
      expect(error).toBeInstanceOf(RateLimitError);
    });

    it('should create rate limit error with retry after', () => {
      const error = new RateLimitError('Rate limited', 60);
      expect(error.retryAfter).toBe(60);
      expect(error.details).toEqual({ retryAfter: 60 });
    });

    it('should create rate limit error with context', () => {
      const context = { endpoint: '/api/posts' };
      const error = new RateLimitError('Rate limit', 30, context);
      expect(error.context).toEqual(context);
      expect(error.retryAfter).toBe(30);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error', () => {
      const error = new ValidationError('Invalid input');
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(ValidationError);
    });

    it('should create validation error with field and value', () => {
      const error = new ValidationError('Invalid email', 'email', 'not-an-email');
      expect(error.field).toBe('email');
      expect(error.value).toBe('not-an-email');
      expect(error.context).toEqual({ field: 'email', value: 'not-an-email' });
    });

    it('should create validation error with additional context', () => {
      const context = { min: 1, max: 100 };
      const error = new ValidationError('Out of range', 'age', 150, context);
      expect(error.context).toEqual({ ...context, field: 'age', value: 150 });
    });
  });

  describe('ConfigurationError', () => {
    it('should create configuration error', () => {
      const error = new ConfigurationError('Missing config');
      expect(error.message).toBe('Missing config');
      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error).toBeInstanceOf(BaseError);
      expect(error).toBeInstanceOf(ConfigurationError);
    });

    it('should create configuration error with context', () => {
      const context = { configFile: '.env', missingKey: 'API_KEY' };
      const error = new ConfigurationError('Config error', context);
      expect(error.context).toEqual(context);
    });
  });
});
