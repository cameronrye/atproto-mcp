/**
 * Tests for the AtpOAuthClient lifecycle inside AtpClient: the client must be
 * created once and reused across authenticate attempts (each instance owns a
 * 10-minute cleanup interval that would otherwise leak), and cleanup() must
 * destroy it so the interval is cleared.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AtpClient } from '../atp-client.js';
import { mockConsole } from '../../test/setup.js';
import type { IAtpConfig } from '../../types/index.js';

vi.mock('@atproto/api', () => ({
  AtpAgent: vi.fn().mockImplementation(function () {
    return {
      login: vi.fn(),
      sessionManager: { refreshSession: vi.fn() },
    };
  }),
}));

vi.mock('../oauth-client.js', () => ({
  AtpOAuthClient: vi.fn(),
}));

const oauthConfig: IAtpConfig = {
  service: 'https://bsky.social',
  identifier: 'test.bsky.social',
  authMethod: 'oauth',
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
};

describe('AtpClient OAuth client lifecycle', () => {
  let mockOAuthClient: {
    startAuthorization: ReturnType<typeof vi.fn>;
    refreshTokens: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockConsole();

    mockOAuthClient = {
      startAuthorization: vi.fn().mockResolvedValue({
        authUrl: 'https://bsky.social/oauth/authorize?state=abc',
        state: 'state-1234567890',
        codeVerifier: 'verifier',
        codeChallenge: 'challenge',
      }),
      refreshTokens: vi.fn(),
      destroy: vi.fn(),
    };

    const { AtpOAuthClient } = await import('../oauth-client.js');
    vi.mocked(AtpOAuthClient).mockImplementation(function () {
      return mockOAuthClient as unknown as InstanceType<typeof AtpOAuthClient>;
    });
  });

  it('reuses a single AtpOAuthClient across repeated authenticate attempts', async () => {
    const client = new AtpClient(oauthConfig);
    const { AtpOAuthClient } = await import('../oauth-client.js');

    // Each attempt ends in the (expected) user-interaction error.
    await expect(client.initialize()).rejects.toThrow(/OAuth flow requires user interaction/);
    await expect(client.initialize()).rejects.toThrow(/OAuth flow requires user interaction/);

    // A new instance per attempt would leak its 10-minute cleanup interval.
    expect(vi.mocked(AtpOAuthClient)).toHaveBeenCalledTimes(1);
  });

  it('destroys the OAuth client on cleanup so its interval is cleared', async () => {
    const client = new AtpClient(oauthConfig);

    await expect(client.initialize()).rejects.toThrow(/OAuth flow requires user interaction/);
    await client.cleanup();

    expect(mockOAuthClient.destroy).toHaveBeenCalledTimes(1);
  });
});
