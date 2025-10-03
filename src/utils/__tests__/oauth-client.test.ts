/**
 * Tests for OAuth Client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AtpOAuthClient } from '../oauth-client.js';
import { AuthenticationError } from '../../types/index.js';

describe('AtpOAuthClient', () => {
  let client: AtpOAuthClient;

  beforeEach(() => {
    client = new AtpOAuthClient({
      service: 'https://bsky.social',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/oauth/callback',
    });
  });

  describe('Constructor', () => {
    it('should create OAuth client with valid config', () => {
      expect(client).toBeDefined();
      expect(client.getPendingAuthorizationCount()).toBe(0);
    });

    it('should throw error without clientId', () => {
      expect(() => {
        new AtpOAuthClient({
          service: 'https://bsky.social',
          clientSecret: 'test-client-secret',
        } as any);
      }).toThrow(AuthenticationError);
    });

    it('should throw error without clientSecret', () => {
      expect(() => {
        new AtpOAuthClient({
          service: 'https://bsky.social',
          clientId: 'test-client-id',
        } as any);
      }).toThrow(AuthenticationError);
    });

    it('should throw error with specific message', () => {
      expect(() => {
        new AtpOAuthClient({
          service: 'https://bsky.social',
        } as any);
      }).toThrow('OAuth requires clientId and clientSecret');
    });
  });

  describe('Start Authorization', () => {
    it('should start authorization flow', async () => {
      const result = await client.startAuthorization('user.bsky.social');

      expect(result).toBeDefined();
      expect(result.authUrl).toContain('oauth/authorize');
      expect(result.authUrl).toContain('client_id=test-client-id');
      expect(result.authUrl).toContain('response_type=code');
      expect(result.authUrl).toContain('scope=atproto');
      expect(result.state).toBeDefined();
      expect(result.codeVerifier).toBeDefined();
      expect(result.codeChallenge).toBeDefined();
    });

    it('should include redirect URI in auth URL', async () => {
      const result = await client.startAuthorization('user.bsky.social');
      expect(result.authUrl).toContain(
        'redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Foauth%2Fcallback'
      );
    });

    it('should include state in auth URL', async () => {
      const result = await client.startAuthorization('user.bsky.social');
      expect(result.authUrl).toContain(`state=${encodeURIComponent(result.state)}`);
    });

    it('should include code challenge in auth URL', async () => {
      const result = await client.startAuthorization('user.bsky.social');
      expect(result.authUrl).toContain(
        `code_challenge=${encodeURIComponent(result.codeChallenge)}`
      );
      expect(result.authUrl).toContain('code_challenge_method=S256');
    });

    it('should store pending authorization', async () => {
      await client.startAuthorization('user.bsky.social');
      expect(client.getPendingAuthorizationCount()).toBe(1);
    });

    it('should generate unique state for each authorization', async () => {
      const result1 = await client.startAuthorization('user1.bsky.social');
      const result2 = await client.startAuthorization('user2.bsky.social');

      expect(result1.state).not.toBe(result2.state);
      expect(client.getPendingAuthorizationCount()).toBe(2);
    });

    it('should generate unique code verifier for each authorization', async () => {
      const result1 = await client.startAuthorization('user1.bsky.social');
      const result2 = await client.startAuthorization('user2.bsky.social');

      expect(result1.codeVerifier).not.toBe(result2.codeVerifier);
    });

    it('should handle service URL with protocol', async () => {
      const result = await client.startAuthorization('user.bsky.social');
      expect(result.authUrl).toContain('https://bsky.social/oauth/authorize');
    });
  });

  describe('Handle Callback', () => {
    it('should handle valid callback', async () => {
      const authRequest = await client.startAuthorization('user.bsky.social');
      const session = await client.handleCallback('test-code-123', authRequest.state);

      expect(session).toBeDefined();
      expect(session.accessToken).toBeDefined();
      expect(session.refreshToken).toBeDefined();
      expect(session.did).toBeDefined();
      expect(session.handle).toBeDefined();
      expect(session.expiresAt).toBeInstanceOf(Date);
    });

    it('should remove pending authorization after callback', async () => {
      const authRequest = await client.startAuthorization('user.bsky.social');
      expect(client.getPendingAuthorizationCount()).toBe(1);

      await client.handleCallback('test-code-123', authRequest.state);
      expect(client.getPendingAuthorizationCount()).toBe(0);
    });

    it('should throw error for invalid state', async () => {
      await expect(client.handleCallback('test-code-123', 'invalid-state')).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should throw error with specific message for invalid state', async () => {
      await expect(client.handleCallback('test-code-123', 'invalid-state')).rejects.toThrow(
        'OAuth callback processing failed'
      );
    });

    it('should emit session event on successful callback', async () => {
      const authRequest = await client.startAuthorization('user.bsky.social');
      const sessionPromise = new Promise(resolve => {
        client.once('session', resolve);
      });

      await client.handleCallback('test-code-123', authRequest.state);
      const emittedSession = await sessionPromise;

      expect(emittedSession).toBeDefined();
    });

    it('should set expiration time correctly', async () => {
      const authRequest = await client.startAuthorization('user.bsky.social');
      const beforeTime = Date.now();
      const session = await client.handleCallback('test-code-123', authRequest.state);
      const afterTime = Date.now();

      const expiresAtTime = session.expiresAt.getTime();
      expect(expiresAtTime).toBeGreaterThan(beforeTime);
      expect(expiresAtTime).toBeLessThan(afterTime + 3600 * 1000 + 1000); // 1 hour + 1 second buffer
    });
  });

  describe('Refresh Tokens', () => {
    it('should refresh tokens', async () => {
      const session = await client.refreshTokens('old-refresh-token');

      expect(session).toBeDefined();
      expect(session.accessToken).toBeDefined();
      expect(session.refreshToken).toBeDefined();
      expect(session.did).toBeDefined();
      expect(session.handle).toBeDefined();
      expect(session.expiresAt).toBeInstanceOf(Date);
    });

    it('should emit session event on token refresh', async () => {
      const sessionPromise = new Promise(resolve => {
        client.once('session', resolve);
      });

      await client.refreshTokens('old-refresh-token');
      const emittedSession = await sessionPromise;

      expect(emittedSession).toBeDefined();
    });

    it('should generate new access token', async () => {
      const session1 = await client.refreshTokens('refresh-token-1');
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait a bit
      const session2 = await client.refreshTokens('refresh-token-2');

      expect(session1.accessToken).not.toBe(session2.accessToken);
    });

    it('should set expiration time correctly', async () => {
      const beforeTime = Date.now();
      const session = await client.refreshTokens('old-refresh-token');
      const afterTime = Date.now();

      const expiresAtTime = session.expiresAt.getTime();
      expect(expiresAtTime).toBeGreaterThan(beforeTime);
      expect(expiresAtTime).toBeLessThan(afterTime + 3600 * 1000 + 1000);
    });
  });

  describe('Revoke Tokens', () => {
    it('should revoke access token', async () => {
      await expect(client.revokeTokens('access-token')).resolves.toBeUndefined();
    });

    it('should revoke access and refresh tokens', async () => {
      await expect(client.revokeTokens('access-token', 'refresh-token')).resolves.toBeUndefined();
    });

    it('should emit revoked event', async () => {
      const revokedPromise = new Promise(resolve => {
        client.once('revoked', resolve);
      });

      await client.revokeTokens('access-token', 'refresh-token');
      await revokedPromise;

      expect(true).toBe(true); // Event was emitted
    });
  });

  describe('Pending Authorizations', () => {
    it('should track pending authorization count', async () => {
      expect(client.getPendingAuthorizationCount()).toBe(0);

      await client.startAuthorization('user1.bsky.social');
      expect(client.getPendingAuthorizationCount()).toBe(1);

      await client.startAuthorization('user2.bsky.social');
      expect(client.getPendingAuthorizationCount()).toBe(2);
    });

    it('should decrease count after successful callback', async () => {
      const authRequest = await client.startAuthorization('user.bsky.social');
      expect(client.getPendingAuthorizationCount()).toBe(1);

      await client.handleCallback('test-code', authRequest.state);
      expect(client.getPendingAuthorizationCount()).toBe(0);
    });

    it('should maintain count after failed callback', async () => {
      await client.startAuthorization('user.bsky.social');
      expect(client.getPendingAuthorizationCount()).toBe(1);

      await expect(client.handleCallback('test-code', 'invalid-state')).rejects.toThrow();
      expect(client.getPendingAuthorizationCount()).toBe(1);
    });
  });

  describe('Event Emitter', () => {
    it('should extend EventEmitter', () => {
      expect(client.on).toBeDefined();
      expect(client.emit).toBeDefined();
      expect(client.once).toBeDefined();
    });

    it('should allow multiple listeners', async () => {
      let listener1Called = false;
      let listener2Called = false;

      client.on('session', () => {
        listener1Called = true;
      });
      client.on('session', () => {
        listener2Called = true;
      });

      await client.refreshTokens('refresh-token');

      expect(listener1Called).toBe(true);
      expect(listener2Called).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should wrap errors in AuthenticationError for callback', async () => {
      try {
        await client.handleCallback('code', 'invalid-state');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
      }
    });

    it('should include context in error for callback', async () => {
      try {
        await client.handleCallback('test-code-123', 'invalid-state');
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('OAuth callback processing failed');
      }
    });
  });
});
