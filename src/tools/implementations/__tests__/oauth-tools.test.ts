/**
 * Tests for OAuth Tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  StartOAuthFlowTool,
  HandleOAuthCallbackTool,
  RefreshOAuthTokensTool,
  RevokeOAuthTokensTool,
} from '../oauth-tools.js';
import { AtpClient } from '../../../utils/atp-client.js';
import { ValidationError } from '../../../types/index.js';

// Create mock OAuth client methods
const mockStartAuthorization = vi.fn();
const mockHandleCallback = vi.fn();
const mockRefreshTokens = vi.fn();
const mockRevokeTokens = vi.fn();

// Mock AtpOAuthClient
vi.mock('../../../utils/oauth-client.js', () => ({
  AtpOAuthClient: class {
    startAuthorization = mockStartAuthorization;
    handleCallback = mockHandleCallback;
    refreshTokens = mockRefreshTokens;
    revokeTokens = mockRevokeTokens;
  },
}));

// Mock AtpClient
vi.mock('../../../utils/atp-client.js');

describe('StartOAuthFlowTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: StartOAuthFlowTool;

  beforeEach(() => {
    mockAgent = {
      service: { toString: () => 'https://bsky.social' },
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(false),
      hasCredentials: vi.fn().mockReturnValue(false),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    tool = new StartOAuthFlowTool(mockAtpClient);

    // Set up environment variables
    process.env['OAUTH_CLIENT_ID'] = 'test-client-id';
    process.env['OAUTH_CLIENT_SECRET'] = 'test-client-secret';
    process.env['OAUTH_REDIRECT_URI'] = 'http://localhost:3000/callback';
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('start_oauth_flow');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('OAuth');
    });

    it('should be available without authentication', () => {
      expect(tool.isAvailable()).toBe(true);
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty identifier', async () => {
      await expect(tool.handler({ identifier: '' })).rejects.toThrow(ValidationError);
    });

    it('should validate identifier format', async () => {
      mockStartAuthorization.mockResolvedValue({
        authUrl: 'https://bsky.social/oauth/authorize?...',
        state: 'test-state-123',
      });

      await expect(tool.handler({ identifier: 'invalid' })).rejects.toThrow();
    });
  });

  describe('Start OAuth Flow', () => {
    it('should start OAuth flow successfully', async () => {
      mockStartAuthorization.mockResolvedValue({
        authUrl: 'https://bsky.social/oauth/authorize?client_id=test&state=abc123',
        state: 'abc123def456',
      });

      const result = await tool.handler({ identifier: 'user.bsky.social' });

      expect(result.success).toBe(true);
      expect(result.authUrl).toBe(
        'https://bsky.social/oauth/authorize?client_id=test&state=abc123'
      );
      expect(result.state).toBe('abc123def456');
      expect(result.instructions).toContain('authorization URL');
      expect(result.expiresIn).toBe(1800);
      expect(mockStartAuthorization).toHaveBeenCalledWith('user.bsky.social');
    });

    it('should handle OAuth client initialization', async () => {
      mockStartAuthorization.mockResolvedValue({
        authUrl: 'https://bsky.social/oauth/authorize',
        state: 'test-state',
      });

      const result = await tool.handler({ identifier: 'user.bsky.social' });

      expect(result.success).toBe(true);
      expect(mockStartAuthorization).toHaveBeenCalled();
    });

    it('should handle authorization failure', async () => {
      mockStartAuthorization.mockRejectedValue(new Error('Authorization failed'));

      await expect(tool.handler({ identifier: 'user.bsky.social' })).rejects.toThrow();
    });
  });
});

describe('HandleOAuthCallbackTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: HandleOAuthCallbackTool;

  beforeEach(() => {
    mockAgent = {
      service: { toString: () => 'https://bsky.social' },
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(false),
      hasCredentials: vi.fn().mockReturnValue(false),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    tool = new HandleOAuthCallbackTool(mockAtpClient);

    process.env['OAUTH_CLIENT_ID'] = 'test-client-id';
    process.env['OAUTH_CLIENT_SECRET'] = 'test-client-secret';
    process.env['OAUTH_REDIRECT_URI'] = 'http://localhost:3000/callback';
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('handle_oauth_callback');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('callback');
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty code', async () => {
      await expect(tool.handler({ code: '', state: 'test-state' })).rejects.toThrow(
        ValidationError
      );
    });

    it('should reject empty state', async () => {
      await expect(tool.handler({ code: 'test-code', state: '' })).rejects.toThrow(ValidationError);
    });
  });

  describe('Handle OAuth Callback', () => {
    it('should handle callback successfully', async () => {
      mockHandleCallback.mockResolvedValue({
        did: 'did:plc:test123',
        handle: 'user.bsky.social',
        expiresAt: new Date('2024-12-31T23:59:59Z'),
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
      });

      const result = await tool.handler({
        code: 'auth-code-123',
        state: 'state-456',
      });

      expect(result.success).toBe(true);
      expect(result.session.did).toBe('did:plc:test123');
      expect(result.session.handle).toBe('user.bsky.social');
      expect(result.session.expiresAt).toBe('2024-12-31T23:59:59.000Z');
      expect(result.message).toContain('completed successfully');
      expect(mockHandleCallback).toHaveBeenCalledWith('auth-code-123', 'state-456');
    });

    it('should handle callback failure', async () => {
      mockHandleCallback.mockRejectedValue(new Error('Invalid authorization code'));

      await expect(tool.handler({ code: 'invalid-code', state: 'test-state' })).rejects.toThrow();
    });
  });
});

describe('RefreshOAuthTokensTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: RefreshOAuthTokensTool;

  beforeEach(() => {
    mockAgent = {
      service: { toString: () => 'https://bsky.social' },
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(false),
      hasCredentials: vi.fn().mockReturnValue(false),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    tool = new RefreshOAuthTokensTool(mockAtpClient);

    process.env['OAUTH_CLIENT_ID'] = 'test-client-id';
    process.env['OAUTH_CLIENT_SECRET'] = 'test-client-secret';
    process.env['OAUTH_REDIRECT_URI'] = 'http://localhost:3000/callback';
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('refresh_oauth_tokens');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Refresh');
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty refresh token', async () => {
      await expect(tool.handler({ refreshToken: '' })).rejects.toThrow(ValidationError);
    });
  });

  describe('Refresh OAuth Tokens', () => {
    it('should refresh tokens successfully', async () => {
      mockRefreshTokens.mockResolvedValue({
        did: 'did:plc:test123',
        handle: 'user.bsky.social',
        expiresAt: new Date('2024-12-31T23:59:59Z'),
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      const result = await tool.handler({ refreshToken: 'old-refresh-token' });

      expect(result.success).toBe(true);
      expect(result.session.did).toBe('did:plc:test123');
      expect(result.session.handle).toBe('user.bsky.social');
      expect(result.session.expiresAt).toBe('2024-12-31T23:59:59.000Z');
      expect(result.message).toContain('refreshed successfully');
      expect(mockRefreshTokens).toHaveBeenCalledWith('old-refresh-token');
    });

    it('should handle refresh failure', async () => {
      mockRefreshTokens.mockRejectedValue(new Error('Invalid refresh token'));

      await expect(tool.handler({ refreshToken: 'invalid-token' })).rejects.toThrow();
    });
  });
});

describe('RevokeOAuthTokensTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: RevokeOAuthTokensTool;

  beforeEach(() => {
    mockAgent = {
      service: { toString: () => 'https://bsky.social' },
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(false),
      hasCredentials: vi.fn().mockReturnValue(false),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    tool = new RevokeOAuthTokensTool(mockAtpClient);

    process.env['OAUTH_CLIENT_ID'] = 'test-client-id';
    process.env['OAUTH_CLIENT_SECRET'] = 'test-client-secret';
    process.env['OAUTH_REDIRECT_URI'] = 'http://localhost:3000/callback';
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('revoke_oauth_tokens');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Revoke');
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty access token', async () => {
      await expect(tool.handler({ accessToken: '' })).rejects.toThrow(ValidationError);
    });

    it('should accept optional refresh token', async () => {
      mockRevokeTokens.mockResolvedValue(undefined);

      const result = await tool.handler({ accessToken: 'access-token' });
      expect(result.success).toBe(true);
    });
  });

  describe('Revoke OAuth Tokens', () => {
    it('should revoke tokens successfully', async () => {
      mockRevokeTokens.mockResolvedValue(undefined);

      const result = await tool.handler({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('revoked successfully');
      expect(mockRevokeTokens).toHaveBeenCalledWith('access-token-123', 'refresh-token-456');
    });

    it('should revoke access token only', async () => {
      mockRevokeTokens.mockResolvedValue(undefined);

      const result = await tool.handler({ accessToken: 'access-token-123' });

      expect(result.success).toBe(true);
      expect(mockRevokeTokens).toHaveBeenCalledWith('access-token-123', undefined);
    });

    it('should handle revocation failure', async () => {
      mockRevokeTokens.mockRejectedValue(new Error('Revocation failed'));

      await expect(tool.handler({ accessToken: 'access-token' })).rejects.toThrow();
    });
  });
});
