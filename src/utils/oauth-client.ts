/**
 * OAuth Client for AT Protocol authentication
 */

// The authorization-code/token-exchange half of AT Protocol OAuth (token endpoint
// discovery, DPoP-bound token exchange, refresh, and revocation) is not yet
// implemented here. The authorization-request half (PKCE + authorization URL) is
// real. Methods that would require a real token exchange fail loudly rather than
// fabricating credentials — see OAUTH_NOT_IMPLEMENTED.
import { AuthenticationError, type IAtpConfig } from '../types/index.js';
import { Logger } from './logger.js';
import crypto from 'crypto';
import { EventEmitter } from 'events';

/**
 * Message used when an OAuth operation that requires a real token exchange is
 * invoked. Returning fabricated tokens here would manufacture a "successful"
 * session from any input (an auth-bypass hazard), so these paths fail loudly.
 */
const OAUTH_NOT_IMPLEMENTED =
  'OAuth authentication is not yet supported: the token exchange is not ' +
  'implemented. Use app-password authentication instead (ATPROTO_IDENTIFIER + ' +
  'ATPROTO_PASSWORD) — it is the supported path. This server can generate an ' +
  'OAuth authorization URL but cannot yet exchange the authorization code for tokens.';

export interface IOAuthSession {
  accessToken: string;
  refreshToken: string;
  did: string;
  handle: string;
  expiresAt: Date;
}

export interface IOAuthAuthorizationRequest {
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
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(config: IAtpConfig) {
    super();
    this.logger = new Logger('AtpOAuthClient');
    this.config = config;

    // AT Protocol OAuth public clients authenticate with PKCE and do NOT use a
    // client secret, so only clientId is required to build an authorization
    // request. (Confidential clients may additionally supply a clientSecret.)
    if (!config.clientId) {
      throw new AuthenticationError('OAuth requires clientId', undefined, {
        authMethod: 'oauth',
      });
    }

    // Clean up expired authorization requests every 10 minutes. unref() so the
    // timer never keeps the Node process alive on its own.
    this.cleanupInterval = setInterval(() => this.cleanupExpiredAuthorizations(), 10 * 60 * 1000);
    this.cleanupInterval.unref();
  }

  /**
   * Stop the background cleanup timer and clear pending authorizations.
   * Call when discarding the client to avoid leaking the interval.
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.pendingAuthorizations.clear();
  }

  /**
   * Start OAuth authorization flow
   */
  async startAuthorization(identifier: string): Promise<IOAuthAuthorizationRequest> {
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

      // Construct a best-effort authorization URL. NOTE: a spec-compliant AT
      // Protocol OAuth flow discovers the authorization server via protected-
      // resource / authorization-server metadata and uses pushed authorization
      // requests (PAR); this heuristic `${service}/oauth/authorize` URL is not a
      // substitute for that and may not be honored by every PDS.
      const baseUrl = this.config.service.replace(/^https?:\/\//, '');
      const authUrl =
        `https://${baseUrl}/oauth/authorize?` +
        `client_id=${encodeURIComponent(this.config.clientId!)}&` +
        `redirect_uri=${encodeURIComponent(this.config.redirectUri ?? 'http://localhost:3000/oauth/callback')}&` +
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
  async handleCallback(code: string, state: string): Promise<IOAuthSession> {
    this.logger.info('Handling OAuth callback', {
      state: `${state.substring(0, 8)}...`,
      code: `${code.substring(0, 10)}...`,
    });

    // Validate the state/PKCE binding established by startAuthorization.
    if (!this.pendingAuthorizations.has(state)) {
      throw new AuthenticationError('Invalid or expired OAuth state parameter', undefined, {
        state: `${state.substring(0, 8)}...`,
      });
    }
    this.pendingAuthorizations.delete(state);

    // Real token exchange is not implemented. Do NOT fabricate a session.
    throw new AuthenticationError(OAUTH_NOT_IMPLEMENTED, undefined, {
      state: `${state.substring(0, 8)}...`,
    });
  }

  /**
   * Refresh OAuth tokens
   */
  async refreshTokens(refreshToken: string): Promise<IOAuthSession> {
    // Never log even a prefix of a token — 10 chars is meaningful entropy and the
    // call always fails anyway. Log only presence, matching the [REDACTED]
    // convention in redactConfigForLog.
    this.logger.info('OAuth token refresh requested', {
      hasRefreshToken: refreshToken.length > 0,
    });
    // Real token refresh is not implemented. Do NOT fabricate a refreshed session.
    throw new AuthenticationError(OAUTH_NOT_IMPLEMENTED);
  }

  /**
   * Revoke OAuth tokens
   */
  async revokeTokens(accessToken: string, refreshToken?: string): Promise<void> {
    // Log only presence flags — never a token prefix (see refreshTokens above).
    this.logger.info('OAuth token revocation requested', {
      hasAccessToken: accessToken.length > 0,
      hasRefreshToken: !!refreshToken,
    });
    // Real token revocation is not implemented. Do NOT report success for a no-op.
    throw new AuthenticationError(OAUTH_NOT_IMPLEMENTED);
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
