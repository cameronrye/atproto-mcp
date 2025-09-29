/**
 * OAuth Client for AT Protocol authentication
 */

// Note: @atproto/oauth-client-node doesn't exist yet, this is a mock implementation
// In production, use the actual AT Protocol OAuth client when available
import type { IAtpConfig } from '../types/index.js';
import { AuthenticationError } from '../types/index.js';
import { Logger } from './logger.js';
import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface OAuthSession {
  accessToken: string;
  refreshToken: string;
  did: string;
  handle: string;
  expiresAt: Date;
}

export interface OAuthAuthorizationRequest {
  authUrl: string;
  state: string;
  codeVerifier: string;
  codeChallenge: string;
}

export class AtpOAuthClient extends EventEmitter {
  private logger: Logger;
  private config: IAtpConfig;
  private pendingAuthorizations = new Map<
    string,
    {
      codeVerifier: string;
      timestamp: number;
    }
  >();

  constructor(config: IAtpConfig) {
    super();
    this.logger = new Logger('AtpOAuthClient');
    this.config = config;

    if (!config.clientId || !config.clientSecret) {
      throw new AuthenticationError('OAuth requires clientId and clientSecret', undefined, {
        authMethod: 'oauth',
      });
    }

    // Clean up expired authorization requests every 10 minutes
    setInterval(() => this.cleanupExpiredAuthorizations(), 10 * 60 * 1000);
  }

  /**
   * Start OAuth authorization flow
   */
  async startAuthorization(identifier: string): Promise<OAuthAuthorizationRequest> {
    try {
      this.logger.info('Starting OAuth authorization flow', { identifier });

      // Generate PKCE parameters
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = this.generateCodeChallenge(codeVerifier);
      const state = this.generateState();

      // Store the code verifier for later use
      this.pendingAuthorizations.set(state, {
        codeVerifier,
        timestamp: Date.now(),
      });

      // Generate authorization URL (mock implementation)
      const baseUrl = this.config.service.replace(/^https?:\/\//, '');
      const authUrl =
        `https://${baseUrl}/oauth/authorize?` +
        `client_id=${encodeURIComponent(this.config.clientId!)}&` +
        `redirect_uri=${encodeURIComponent(this.config.redirectUri || 'http://localhost:3000/oauth/callback')}&` +
        `response_type=code&` +
        `scope=atproto&` +
        `state=${encodeURIComponent(state)}&` +
        `code_challenge=${encodeURIComponent(codeChallenge)}&` +
        `code_challenge_method=S256`;

      this.logger.info('OAuth authorization URL generated', {
        identifier,
        state: `${state.substring(0, 8)}...`,
      });

      return {
        authUrl,
        state,
        codeVerifier,
        codeChallenge,
      };
    } catch (error) {
      this.logger.error('OAuth authorization failed', error);
      throw new AuthenticationError('Failed to start OAuth authorization flow', error, {
        identifier,
      });
    }
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleCallback(code: string, state: string): Promise<OAuthSession> {
    try {
      this.logger.info('Handling OAuth callback', {
        state: `${state.substring(0, 8)}...`,
        code: `${code.substring(0, 10)}...`,
      });

      // Retrieve the stored code verifier
      const pending = this.pendingAuthorizations.get(state);
      if (!pending) {
        throw new AuthenticationError('Invalid or expired OAuth state parameter', undefined, {
          state: `${state.substring(0, 8)}...`,
        });
      }

      // Clean up the pending authorization
      this.pendingAuthorizations.delete(state);

      // Exchange authorization code for tokens (mock implementation)
      // In a real implementation, this would make an HTTP request to the token endpoint
      const tokenResponse = {
        accessJwt: `mock_access_token_${Date.now()}`,
        refreshJwt: `mock_refresh_token_${Date.now()}`,
        did: 'did:plc:mock123',
        handle: 'mock.bsky.social',
        expiresIn: 3600,
      };

      const session: OAuthSession = {
        accessToken: tokenResponse.accessJwt,
        refreshToken: tokenResponse.refreshJwt,
        did: tokenResponse.did,
        handle: tokenResponse.handle,
        expiresAt: new Date(Date.now() + (tokenResponse.expiresIn || 3600) * 1000),
      };

      this.logger.info('OAuth authentication successful', {
        did: session.did,
        handle: session.handle,
        expiresAt: session.expiresAt.toISOString(),
      });

      // Emit session event
      this.emit('session', session);

      return session;
    } catch (error) {
      this.logger.error('OAuth callback failed', error);
      throw new AuthenticationError('OAuth callback processing failed', error, {
        code: `${code.substring(0, 10)}...`,
        state: `${state.substring(0, 8)}...`,
      });
    }
  }

  /**
   * Refresh OAuth tokens
   */
  async refreshTokens(refreshToken: string): Promise<OAuthSession> {
    try {
      this.logger.info('Refreshing OAuth tokens');

      // Refresh tokens (mock implementation)
      const tokenResponse = {
        accessJwt: `mock_refreshed_access_token_${Date.now()}`,
        refreshJwt: `mock_refreshed_refresh_token_${Date.now()}`,
        did: 'did:plc:mock123',
        handle: 'mock.bsky.social',
        expiresIn: 3600,
      };

      const session: OAuthSession = {
        accessToken: tokenResponse.accessJwt,
        refreshToken: tokenResponse.refreshJwt || refreshToken, // Keep old refresh token if new one not provided
        did: tokenResponse.did,
        handle: tokenResponse.handle,
        expiresAt: new Date(Date.now() + (tokenResponse.expiresIn || 3600) * 1000),
      };

      this.logger.info('OAuth tokens refreshed successfully', {
        did: session.did,
        handle: session.handle,
        expiresAt: session.expiresAt.toISOString(),
      });

      // Emit session event
      this.emit('session', session);

      return session;
    } catch (error) {
      this.logger.error('OAuth token refresh failed', error);
      throw new AuthenticationError('Failed to refresh OAuth tokens', error, {
        refreshToken: `${refreshToken.substring(0, 10)}...`,
      });
    }
  }

  /**
   * Revoke OAuth tokens
   */
  async revokeTokens(accessToken: string, refreshToken?: string): Promise<void> {
    try {
      this.logger.info('Revoking OAuth tokens');

      // Revoke tokens (mock implementation)
      // In a real implementation, this would make HTTP requests to revoke the tokens
      this.logger.debug('Mock token revocation', {
        accessToken: `${accessToken.substring(0, 10)}...`,
        hasRefreshToken: !!refreshToken,
      });

      this.logger.info('OAuth tokens revoked successfully');

      // Emit revocation event
      this.emit('revoked');
    } catch (error) {
      this.logger.error('OAuth token revocation failed', error);
      throw new AuthenticationError('Failed to revoke OAuth tokens', error);
    }
  }

  /**
   * Generate PKCE code verifier
   */
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate PKCE code challenge
   */
  private generateCodeChallenge(codeVerifier: string): string {
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  }

  /**
   * Generate random state parameter
   */
  private generateState(): string {
    return crypto.randomBytes(16).toString('base64url');
  }

  /**
   * Clean up expired authorization requests
   */
  private cleanupExpiredAuthorizations(): void {
    const now = Date.now();
    const expiredStates: string[] = [];

    for (const [state, { timestamp }] of this.pendingAuthorizations) {
      // Remove authorizations older than 30 minutes
      if (now - timestamp > 30 * 60 * 1000) {
        expiredStates.push(state);
      }
    }

    for (const state of expiredStates) {
      this.pendingAuthorizations.delete(state);
    }

    if (expiredStates.length > 0) {
      this.logger.debug('Cleaned up expired OAuth authorizations', {
        count: expiredStates.length,
      });
    }
  }

  /**
   * Get pending authorization count (for monitoring)
   */
  getPendingAuthorizationCount(): number {
    return this.pendingAuthorizations.size;
  }
}
