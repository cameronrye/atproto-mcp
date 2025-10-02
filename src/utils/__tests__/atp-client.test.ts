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
});
