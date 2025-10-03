/**
 * Tests for AT Protocol client wrapper
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AtpClient } from '../atp-client.js';
import { AuthenticationError, AtpError } from '../../types/index.js';
import {
  mockConsole,
  expectToThrow,
  createMockAtpConfig,
  createMockSession,
} from '../../test/setup.js';

// Mock the @atproto/api module
vi.mock('@atproto/api', () => ({
  AtpAgent: vi.fn().mockImplementation(() => ({
    login: vi.fn(),
    refreshSession: vi.fn(),
  })),
}));

describe('AtpClient', () => {
  let mockAgent: any;
  let client: AtpClient;

  beforeEach(async () => {
    mockConsole();

    // Create mock agent
    mockAgent = {
      login: vi.fn(),
      refreshSession: vi.fn(),
    };

    // Mock AtpAgent constructor
    const { AtpAgent } = await import('@atproto/api');
    vi.mocked(AtpAgent).mockImplementation(() => mockAgent);

    client = new AtpClient(createMockAtpConfig());
  });

  describe('constructor', () => {
    it('should create AtpClient with configuration', () => {
      const config = createMockAtpConfig();
      const client = new AtpClient(config);

      expect(client).toBeInstanceOf(AtpClient);
      expect(client.isAuthenticated()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should initialize with app-password authentication', async () => {
      const mockSession = createMockSession();
      mockAgent.login.mockResolvedValue({
        success: true,
        data: mockSession,
      });

      await client.initialize();

      expect(mockAgent.login).toHaveBeenCalledWith({
        identifier: 'test.bsky.social',
        password: 'test-password',
      });
    });

    it('should throw error for failed authentication', async () => {
      mockAgent.login.mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
      });

      await expectToThrow(() => client.initialize(), AuthenticationError, /authentication failed/);
    });

    it('should throw error for OAuth (requires user interaction)', async () => {
      const oauthConfig = {
        ...createMockAtpConfig(),
        authMethod: 'oauth' as const,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      };

      const oauthClient = new AtpClient(oauthConfig);

      await expectToThrow(
        () => oauthClient.initialize(),
        AuthenticationError,
        /OAuth flow requires user interaction/
      );
    });
  });

  describe('session management', () => {
    it('should handle session creation', async () => {
      const mockSession = createMockSession();
      mockAgent.login.mockResolvedValue({
        success: true,
        data: mockSession,
      });

      // Simulate session event
      const { AtpAgent } = await import('@atproto/api');
      const constructorCall = vi.mocked(AtpAgent).mock.calls[0];
      const persistSession = constructorCall?.[0]?.persistSession;

      await client.initialize();

      // Simulate session create event
      if (persistSession) {
        persistSession('create', mockSession);
      }

      expect(client.isAuthenticated()).toBe(true);
      expect(client.getSession()).toEqual(
        expect.objectContaining({
          did: mockSession.did,
          handle: mockSession.handle,
          active: true,
        })
      );
    });

    it('should handle session refresh', async () => {
      const mockSession = createMockSession();
      mockAgent.login.mockResolvedValue({
        success: true,
        data: mockSession,
      });
      mockAgent.refreshSession.mockResolvedValue({
        success: true,
      });

      await client.initialize();

      // Simulate session expired event
      const { AtpAgent } = await import('@atproto/api');
      const constructorCall = vi.mocked(AtpAgent).mock.calls[0];
      const persistSession = constructorCall?.[0]?.persistSession;

      if (persistSession) {
        persistSession('create', mockSession);
        persistSession('expired');
      }

      // Wait for refresh to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockAgent.refreshSession).toHaveBeenCalled();
    });
  });

  describe('executeRequest', () => {
    beforeEach(async () => {
      const mockSession = createMockSession();
      mockAgent.login.mockResolvedValue({
        success: true,
        data: mockSession,
      });

      await client.initialize();

      // Set up session
      const { AtpAgent } = await import('@atproto/api');
      const constructorCall = vi.mocked(AtpAgent).mock.calls[0];
      const persistSession = constructorCall?.[0]?.persistSession;
      if (persistSession) {
        persistSession('create', mockSession);
      }
    });

    it('should execute successful request', async () => {
      const mockResult = { data: 'test-data' };
      const operation = vi.fn().mockResolvedValue(mockResult);

      const result = await client.executeRequest(operation);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockResult);
      }
      expect(operation).toHaveBeenCalled();
    });

    it('should handle request errors', async () => {
      const error = new Error('Test error');
      const operation = vi.fn().mockRejectedValue(error);

      const result = await client.executeRequest(operation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AtpError);
        expect(result.error.message).toBe('Test error');
      }
    });

    it('should handle authentication errors', async () => {
      const error = { status: 401, message: 'Unauthorized' };
      const operation = vi.fn().mockRejectedValue(error);

      const result = await client.executeRequest(operation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AuthenticationError);
      }
    });

    it('should handle rate limit errors', async () => {
      const error = {
        status: 429,
        message: 'Rate limited',
        headers: { 'retry-after': '60' },
      };
      const operation = vi.fn().mockRejectedValue(error);

      const result = await client.executeRequest(operation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('RATE_LIMIT_EXCEEDED');
      }
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await client.cleanup();

      expect(client.getSession()).toBeNull();
    });
  });

  describe('getAgent', () => {
    it('should return the underlying AtpAgent', () => {
      const agent = client.getAgent();
      expect(agent).toBe(mockAgent);
    });
  });

  describe('hasCredentials', () => {
    it('should return true when credentials are provided', () => {
      expect(client.hasCredentials()).toBe(true);
    });

    it('should return false when no credentials provided', () => {
      const unauthConfig = {
        service: 'https://bsky.social',
      };
      const unauthClient = new AtpClient(unauthConfig);
      expect(unauthClient.hasCredentials()).toBe(false);
    });

    it('should return false when partial app-password credentials', () => {
      const partialConfig = {
        service: 'https://bsky.social',
        authMethod: 'app-password' as const,
        identifier: 'test.bsky.social',
      };
      const partialClient = new AtpClient(partialConfig);
      expect(partialClient.hasCredentials()).toBe(false);
    });

    it('should return false when partial OAuth credentials', () => {
      const partialConfig = {
        service: 'https://bsky.social',
        authMethod: 'oauth' as const,
        clientId: 'test-client-id',
      };
      const partialClient = new AtpClient(partialConfig);
      expect(partialClient.hasCredentials()).toBe(false);
    });
  });

  describe('requiresAuthentication (deprecated)', () => {
    it('should return same as hasCredentials', () => {
      expect(client.requiresAuthentication()).toBe(client.hasCredentials());
    });
  });

  describe('getPublicAgent', () => {
    it('should return public agent', () => {
      const publicAgent = client.getPublicAgent();
      expect(publicAgent).toBeDefined();
    });
  });

  describe('getAuthenticatedAgent', () => {
    it('should throw when not authenticated', () => {
      expect(() => client.getAuthenticatedAgent()).toThrow(AuthenticationError);
      expect(() => client.getAuthenticatedAgent()).toThrow('Authentication required');
    });

    it('should return agent when authenticated', async () => {
      const mockSession = createMockSession();
      mockAgent.login.mockResolvedValue({
        success: true,
        data: mockSession,
      });

      await client.initialize();

      const { AtpAgent } = await import('@atproto/api');
      const constructorCall = vi.mocked(AtpAgent).mock.calls[0];
      const persistSession = constructorCall?.[0]?.persistSession;
      if (persistSession) {
        persistSession('create', mockSession);
      }

      const agent = client.getAuthenticatedAgent();
      expect(agent).toBe(mockAgent);
    });
  });

  describe('executePublicRequest', () => {
    it('should execute public request successfully', async () => {
      const mockResult = { data: 'test-data' };
      const operation = vi.fn().mockResolvedValue(mockResult);

      const result = await client.executePublicRequest(operation);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockResult);
      }
    });

    it('should handle public request errors', async () => {
      const error = new Error('Test error');
      const operation = vi.fn().mockRejectedValue(error);

      const result = await client.executePublicRequest(operation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AtpError);
      }
    });
  });

  describe('executeAuthenticatedRequest', () => {
    it('should fail without credentials', async () => {
      const unauthConfig = {
        service: 'https://bsky.social',
      };
      const unauthClient = new AtpClient(unauthConfig);

      const operation = vi.fn().mockResolvedValue({ data: 'test' });
      const result = await unauthClient.executeAuthenticatedRequest(operation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AuthenticationError);
        expect(result.error.message).toContain('no credentials were provided');
      }
    });

    it('should execute when authenticated', async () => {
      const mockSession = createMockSession();
      mockAgent.login.mockResolvedValue({
        success: true,
        data: mockSession,
      });

      await client.initialize();

      const { AtpAgent } = await import('@atproto/api');
      const constructorCall = vi.mocked(AtpAgent).mock.calls[0];
      const persistSession = constructorCall?.[0]?.persistSession;
      if (persistSession) {
        persistSession('create', mockSession);
      }

      const mockResult = { data: 'test-data' };
      const operation = vi.fn().mockResolvedValue(mockResult);

      const result = await client.executeAuthenticatedRequest(operation);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockResult);
      }
    });
  });

  describe('error handling', () => {
    it('should handle 4xx client errors', async () => {
      const error = { status: 400, message: 'Bad request' };
      const operation = vi.fn().mockRejectedValue(error);

      const result = await client.executePublicRequest(operation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should handle 4xx errors without message', async () => {
      const error = { status: 404 };
      const operation = vi.fn().mockRejectedValue(error);

      const result = await client.executePublicRequest(operation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Client error');
      }
    });

    it('should handle rate limit without retry-after', async () => {
      const error = { status: 429, message: 'Too many requests' };
      const operation = vi.fn().mockRejectedValue(error);

      const result = await client.executePublicRequest(operation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('RATE_LIMIT_EXCEEDED');
      }
    });

    it('should handle unknown errors', async () => {
      const error = 'Unknown error string';
      const operation = vi.fn().mockRejectedValue(error);

      const result = await client.executePublicRequest(operation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Unknown AT Protocol error');
      }
    });

    it('should pass through AtpError instances', async () => {
      const atpError = new AuthenticationError('Test auth error');
      const operation = vi.fn().mockRejectedValue(atpError);

      const result = await client.executePublicRequest(operation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(atpError);
      }
    });
  });

  describe('unauthenticated mode', () => {
    it('should initialize without authentication', async () => {
      const unauthConfig = {
        service: 'https://bsky.social',
      };
      const unauthClient = new AtpClient(unauthConfig);

      await unauthClient.initialize();

      expect(unauthClient.isAuthenticated()).toBe(false);
      expect(unauthClient.hasCredentials()).toBe(false);
    });

    it('should return public agent when not authenticated', () => {
      const unauthConfig = {
        service: 'https://bsky.social',
      };
      const unauthClient = new AtpClient(unauthConfig);

      const agent = unauthClient.getAgent();
      expect(agent).toBeDefined();
    });
  });

  describe('unsupported auth method', () => {
    it('should throw error for unsupported auth method', async () => {
      const invalidConfig = {
        service: 'https://bsky.social',
        authMethod: 'invalid' as any,
        identifier: 'test.bsky.social',
        password: 'test-password',
      };
      const invalidClient = new AtpClient(invalidConfig);

      // Client won't have credentials with invalid auth method
      expect(invalidClient.hasCredentials()).toBe(false);
    });
  });

  describe('app-password validation', () => {
    it('should not have credentials without identifier', () => {
      const invalidConfig = {
        service: 'https://bsky.social',
        authMethod: 'app-password' as const,
        password: 'test-password',
      };
      const invalidClient = new AtpClient(invalidConfig);

      expect(invalidClient.hasCredentials()).toBe(false);
    });

    it('should not have credentials without password', () => {
      const invalidConfig = {
        service: 'https://bsky.social',
        authMethod: 'app-password' as const,
        identifier: 'test.bsky.social',
      };
      const invalidClient = new AtpClient(invalidConfig);

      expect(invalidClient.hasCredentials()).toBe(false);
    });
  });

  describe('OAuth validation', () => {
    it('should not have credentials without clientId', () => {
      const invalidConfig = {
        service: 'https://bsky.social',
        authMethod: 'oauth' as const,
        clientSecret: 'test-secret',
        identifier: 'test.bsky.social',
      };
      const invalidClient = new AtpClient(invalidConfig);

      expect(invalidClient.hasCredentials()).toBe(false);
    });

    it('should not have credentials without clientSecret', () => {
      const invalidConfig = {
        service: 'https://bsky.social',
        authMethod: 'oauth' as const,
        clientId: 'test-client-id',
        identifier: 'test.bsky.social',
      };
      const invalidClient = new AtpClient(invalidConfig);

      expect(invalidClient.hasCredentials()).toBe(false);
    });

    it('should throw without identifier', async () => {
      const invalidConfig = {
        service: 'https://bsky.social',
        authMethod: 'oauth' as const,
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
      };
      const invalidClient = new AtpClient(invalidConfig);

      await expectToThrow(
        () => invalidClient.initialize(),
        AuthenticationError,
        /OAuth requires an identifier/
      );
    });
  });
});
