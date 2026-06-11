/**
 * Tests for AT Protocol client wrapper
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AtpAgentOptions } from '@atproto/api';
import { AtpClient } from '../atp-client.js';
import { AuthenticationError, AtpError, ValidationError } from '../../types/index.js';
import {
  mockConsole,
  expectToThrow,
  createMockAtpConfig,
  createMockSession,
} from '../../test/setup.js';

// Mock the @atproto/api module. Note: the real AtpAgent does NOT expose
// refreshSession() itself — token refresh lives on agent.sessionManager
// (CredentialSession.refreshSession()), so the mock mirrors that shape.
vi.mock('@atproto/api', () => ({
  AtpAgent: vi.fn().mockImplementation(function () {
    return {
      login: vi.fn(),
      sessionManager: { refreshSession: vi.fn() },
    };
  }),
}));

describe('AtpClient', () => {
  let mockAgent: any;
  let client: AtpClient;

  beforeEach(async () => {
    mockConsole();

    // Create mock agent (refresh lives on sessionManager, as in the real SDK)
    mockAgent = {
      login: vi.fn(),
      sessionManager: { refreshSession: vi.fn() },
    };

    // Mock AtpAgent constructor
    const { AtpAgent } = await import('@atproto/api');
    vi.mocked(AtpAgent).mockImplementation(function () {
      return mockAgent;
    });

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
      const persistSession = (constructorCall?.[0] as AtpAgentOptions | undefined)?.persistSession;

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

    it('refreshes the session on expiry without a spurious re-login', async () => {
      const mockSession = createMockSession();
      mockAgent.login.mockResolvedValue({
        success: true,
        data: mockSession,
      });
      // The real @atproto/api refresh path is agent.sessionManager.refreshSession()
      // (CredentialSession), which returns Promise<void>. The client must call
      // that — AtpAgent itself has no refreshSession() — and must NOT inspect a
      // (non-existent) `.success` field on the void result.
      mockAgent.sessionManager.refreshSession.mockResolvedValue(undefined);

      await client.initialize();

      // Simulate session expired event
      const { AtpAgent } = await import('@atproto/api');
      const constructorCall = vi.mocked(AtpAgent).mock.calls[0];
      const persistSession = (constructorCall?.[0] as AtpAgentOptions | undefined)?.persistSession;

      if (persistSession) {
        persistSession('create', mockSession);
        persistSession('expired', undefined);
      }

      // Wait for refresh to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockAgent.sessionManager.refreshSession).toHaveBeenCalled();
      // login was called exactly once (initial auth) — the void refresh result
      // must not be misread as a failure that triggers re-authentication.
      expect(mockAgent.login).toHaveBeenCalledTimes(1);
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
      const persistSession = (constructorCall?.[0] as AtpAgentOptions | undefined)?.persistSession;
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

    it('maps 404 to a not-found AtpError, not a ValidationError', async () => {
      const error = { status: 404, message: 'Could not find record' };
      const result = await client.executeRequest(vi.fn().mockRejectedValue(error));

      expect(result.success).toBe(false);
      if (!result.success) {
        // A 404 must not be reported to the LLM as "invalid parameters".
        expect(result.error).toBeInstanceOf(AtpError);
        expect(result.error).not.toBeInstanceOf(ValidationError);
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.statusCode).toBe(404);
      }
    });

    it('maps 403 to a forbidden AtpError, not a ValidationError', async () => {
      const error = { status: 403, message: 'Blocked by author' };
      const result = await client.executeRequest(vi.fn().mockRejectedValue(error));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).not.toBeInstanceOf(ValidationError);
        expect(result.error.code).toBe('FORBIDDEN');
        expect(result.error.statusCode).toBe(403);
      }
    });

    it('still maps 400 to a ValidationError', async () => {
      const error = { status: 400, message: 'Invalid request body' };
      const result = await client.executeRequest(vi.fn().mockRejectedValue(error));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
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

  describe('executeAuthenticatedRequest without credentials', () => {
    it('denies the operation without invoking it when no credentials are configured', async () => {
      // No authMethod/credentials -> the auth gate must fail closed.
      const noCredClient = new AtpClient({ service: 'https://bsky.social' } as any);
      const operation = vi.fn().mockResolvedValue('should not run');

      const result = await noCredClient.executeAuthenticatedRequest(operation);

      expect(result.success).toBe(false);
      expect(operation).not.toHaveBeenCalled();
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AuthenticationError);
      }
    });
  });
});
