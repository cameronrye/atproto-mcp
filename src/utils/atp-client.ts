/**
 * AT Protocol client wrapper with authentication and session management
 * Supports both authenticated and unauthenticated modes
 */

import { AtpAgent, type AtpSessionData, type AtpSessionEvent } from '@atproto/api';
import {
  AtpError,
  AuthenticationError,
  type DID,
  type IAtpConfig,
  type IAtpSession,
  RateLimitError,
  type Result,
  ValidationError,
} from '../types/index.js';
import { Logger } from './logger.js';
import type { IOAuthSession } from './oauth-client.js';

/**
 * AT Protocol client wrapper with comprehensive authentication and session management
 * Supports both authenticated and unauthenticated modes for maximum flexibility
 */
export class AtpClient {
  private agent: AtpAgent;
  private publicAgent: AtpAgent;
  private logger: Logger;
  private session: IAtpSession | null = null;
  private config: IAtpConfig;
  private sessionRefreshPromise: Promise<void> | null = null;
  private isAuthenticationRequired: boolean;

  constructor(config: IAtpConfig) {
    this.config = config;
    this.logger = new Logger('AtpClient');

    // Determine if authentication is required based on available credentials
    this.isAuthenticationRequired = this.hasAuthenticationCredentials();

    // Create authenticated agent (for user's PDS)
    this.agent = new AtpAgent({
      service: config.service,
      persistSession: (evt: AtpSessionEvent, sess?: AtpSessionData) => {
        this.handleSessionEvent(evt, sess);
      },
    });

    // Create public agent for unauthenticated requests
    this.publicAgent = new AtpAgent({
      service: 'https://public.api.bsky.app',
    });
  }

  /**
   * Check if authentication credentials are available
   */
  private hasAuthenticationCredentials(): boolean {
    if (this.config.authMethod === 'app-password') {
      return !!(this.config.identifier && this.config.password);
    } else if (this.config.authMethod === 'oauth') {
      return !!(this.config.clientId && this.config.clientSecret);
    }
    return false;
  }

  /**
   * Initialize the AT Protocol client
   * In unauthenticated mode, this will skip authentication
   * In authenticated mode, this will perform authentication
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing AT Protocol client', {
        service: this.config.service,
        authMethod: this.config.authMethod,
        authenticationRequired: this.isAuthenticationRequired,
      });

      if (this.isAuthenticationRequired) {
        await this.authenticate();
        this.logger.info('AT Protocol client initialized successfully with authentication');
      } else {
        this.logger.info('AT Protocol client initialized successfully in unauthenticated mode');
      }
    } catch (error) {
      this.logger.error('Failed to initialize AT Protocol client', error);
      throw error;
    }
  }

  /**
   * Authenticate with AT Protocol using configured method
   */
  private async authenticate(): Promise<void> {
    if (this.config.authMethod === 'app-password') {
      await this.authenticateWithAppPassword();
    } else if (this.config.authMethod === 'oauth') {
      await this.authenticateWithOAuth();
    } else {
      throw new AuthenticationError(
        `Unsupported authentication method: ${this.config.authMethod}`,
        undefined,
        { authMethod: this.config.authMethod }
      );
    }
  }

  /**
   * Authenticate using app password
   */
  private async authenticateWithAppPassword(): Promise<void> {
    if (!this.config.identifier || !this.config.password) {
      throw new AuthenticationError(
        'App password authentication requires identifier and password',
        undefined,
        { authMethod: 'app-password' }
      );
    }

    try {
      this.logger.debug('Authenticating with app password');

      const response = await this.agent.login({
        identifier: this.config.identifier,
        password: this.config.password,
      });

      if (!response.success) {
        throw new AuthenticationError('App password authentication failed', response, {
          identifier: this.config.identifier,
        });
      }

      this.logger.info('App password authentication successful', {
        did: response.data.did,
        handle: response.data.handle,
      });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      this.logger.error('App password authentication error', error);
      throw new AuthenticationError('App password authentication failed', error, {
        identifier: this.config.identifier,
      });
    }
  }

  /**
   * Authenticate using OAuth
   */
  private async authenticateWithOAuth(): Promise<void> {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new AuthenticationError(
        'OAuth authentication requires clientId and clientSecret',
        undefined,
        { authMethod: 'oauth' }
      );
    }

    try {
      this.logger.debug('Authenticating with OAuth');

      const { AtpOAuthClient } = await import('./oauth-client.js');
      const oauthClient = new AtpOAuthClient(this.config);

      // For server environments, we need a different flow
      // This implementation supports both interactive and programmatic flows
      const identifier = this.config.identifier;
      if (!identifier) {
        throw new AuthenticationError('OAuth requires an identifier (handle or DID)', undefined, {
          authMethod: 'oauth',
        });
      }

      // Check if we have stored OAuth tokens
      const storedSession = await this.loadStoredOAuthSession();
      if (storedSession && storedSession.expiresAt > new Date()) {
        // Use stored session
        this.logger.info('Using stored OAuth session', {
          did: storedSession.did,
          handle: storedSession.handle,
        });

        await this.agent.resumeSession({
          accessJwt: storedSession.accessToken,
          refreshJwt: storedSession.refreshToken,
          did: storedSession.did,
          handle: storedSession.handle,
          active: true,
        });

        return;
      }

      // Check if we have a refresh token to use
      if (storedSession?.refreshToken) {
        try {
          this.logger.info('Refreshing OAuth tokens');
          const newSession = await oauthClient.refreshTokens(storedSession.refreshToken);
          await this.storeOAuthSession(newSession);

          await this.agent.resumeSession({
            accessJwt: newSession.accessToken,
            refreshJwt: newSession.refreshToken,
            did: newSession.did,
            handle: newSession.handle,
            active: true,
          });

          return;
        } catch (refreshError) {
          this.logger.warn('OAuth token refresh failed, starting new flow', refreshError);
        }
      }

      // Start new OAuth flow
      const authRequest = await oauthClient.startAuthorization(identifier);

      this.logger.info('OAuth authorization required', {
        authUrl: authRequest.authUrl,
        state: `${authRequest.state.substring(0, 8)}...`,
      });

      // In a real implementation, you would:
      // 1. Open the authUrl in a browser or redirect user
      // 2. Handle the callback with the authorization code
      // 3. Complete the OAuth flow

      // For now, we'll throw an informative error with the auth URL
      throw new AuthenticationError(
        `OAuth flow requires user interaction. Please visit: ${authRequest.authUrl}`,
        undefined,
        {
          authMethod: 'oauth',
          authUrl: authRequest.authUrl,
          state: authRequest.state,
        }
      );
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      this.logger.error('OAuth authentication error', error);
      throw new AuthenticationError('OAuth authentication failed', error, { authMethod: 'oauth' });
    }
  }

  /**
   * Handle session events from AtpAgent
   */
  private handleSessionEvent(event: AtpSessionEvent, sessionData?: AtpSessionData): void {
    this.logger.debug('Session event received', { event, hasSessionData: !!sessionData });

    switch (event) {
      case 'create':
      case 'update':
        if (sessionData) {
          this.session = {
            did: sessionData.did as DID,
            handle: sessionData.handle,
            accessJwt: sessionData.accessJwt,
            refreshJwt: sessionData.refreshJwt,
            active: sessionData.active ?? true,
          };
          this.logger.debug('Session updated', {
            did: this.session.did,
            handle: this.session.handle,
            active: this.session.active,
          });
        }
        break;
      case 'expired':
        this.logger.warn('Session expired, attempting refresh');
        this.refreshSession().catch(error => {
          this.logger.error('Failed to refresh expired session', error);
        });
        break;
    }
  }

  /**
   * Refresh the current session
   */
  private async refreshSession(): Promise<void> {
    if (this.sessionRefreshPromise) {
      return this.sessionRefreshPromise;
    }

    this.sessionRefreshPromise = this.performSessionRefresh();

    try {
      await this.sessionRefreshPromise;
    } finally {
      this.sessionRefreshPromise = null;
    }
  }

  /**
   * Perform the actual session refresh
   */
  private async performSessionRefresh(): Promise<void> {
    try {
      this.logger.debug('Refreshing session');

      // Note: refreshSession method may not exist in current @atproto/api version
      // This is a placeholder for when the method becomes available
      if ('refreshSession' in this.agent && typeof this.agent.refreshSession === 'function') {
        const response = await (this.agent as any).refreshSession();

        if (!response.success) {
          throw new AuthenticationError('Session refresh failed', response, {
            sessionActive: this.session?.active,
          });
        }

        this.logger.info('Session refreshed successfully');
      } else {
        // Fallback: re-authenticate if refresh is not available
        this.logger.info('Session refresh not available, re-authenticating');
        await this.authenticate();
      }
    } catch (error) {
      this.logger.error('Session refresh failed', error);

      // If refresh fails, try to re-authenticate
      if (this.config.authMethod === 'app-password') {
        this.logger.info('Attempting re-authentication after refresh failure');
        await this.authenticateWithAppPassword();
      } else {
        throw new AuthenticationError(
          'Session refresh failed and re-authentication not available',
          error
        );
      }
    }
  }

  /**
   * Get the current session
   */
  public getSession(): IAtpSession | null {
    return this.session;
  }

  /**
   * Check if client is authenticated
   */
  public isAuthenticated(): boolean {
    return this.session?.active === true;
  }

  /**
   * Check if authentication is required for this client instance
   */
  public requiresAuthentication(): boolean {
    return this.isAuthenticationRequired;
  }

  /**
   * Get the underlying AtpAgent instance
   * Returns the authenticated agent if available, otherwise the public agent
   */
  public getAgent(): AtpAgent {
    return this.isAuthenticated() ? this.agent : this.publicAgent;
  }

  /**
   * Get the authenticated agent (for operations that require authentication)
   */
  public getAuthenticatedAgent(): AtpAgent {
    if (!this.isAuthenticated()) {
      throw new AuthenticationError('Authentication required for this operation', undefined, {
        operation: 'getAuthenticatedAgent',
      });
    }
    return this.agent;
  }

  /**
   * Get the public agent (for operations that don't require authentication)
   */
  public getPublicAgent(): AtpAgent {
    return this.publicAgent;
  }

  /**
   * Execute a request with automatic retry and error handling
   * Supports both authenticated and unauthenticated operations
   */
  public async executeRequest<T>(
    operation: () => Promise<T>,
    context?: Record<string, unknown>,
    requiresAuth: boolean = false
  ): Promise<Result<T, AtpError>> {
    try {
      // Only authenticate if required and authentication is available
      if (requiresAuth) {
        if (!this.isAuthenticationRequired) {
          return {
            success: false,
            error: new AuthenticationError(
              'This operation requires authentication, but no credentials were provided',
              undefined,
              { ...context, operation: 'executeRequest', requiresAuth }
            ),
          };
        }

        if (!this.isAuthenticated()) {
          await this.authenticate();
        }
      }

      const result = await operation();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: this.handleError(error, context) };
    }
  }

  /**
   * Execute a public request that doesn't require authentication
   */
  public async executePublicRequest<T>(
    operation: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<Result<T, AtpError>> {
    try {
      const result = await operation();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: this.handleError(error, context) };
    }
  }

  /**
   * Execute an authenticated request that requires authentication
   */
  public async executeAuthenticatedRequest<T>(
    operation: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<Result<T, AtpError>> {
    return this.executeRequest(operation, context, true);
  }

  /**
   * Handle and transform errors from AT Protocol operations
   */
  private handleError(error: unknown, context?: Record<string, unknown>): AtpError {
    this.logger.error('AT Protocol operation failed', error, context);

    if (error instanceof AtpError) {
      return error;
    }

    // Handle common AT Protocol errors
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as any;

      if (errorObj.status === 401) {
        return new AuthenticationError('Authentication required or invalid', errorObj, context);
      }

      if (errorObj.status === 429) {
        const retryAfter = errorObj.headers?.['retry-after'];
        return new RateLimitError(
          'Rate limit exceeded',
          retryAfter ? parseInt(retryAfter, 10) : undefined,
          context
        );
      }

      if (errorObj.status >= 400 && errorObj.status < 500) {
        return new ValidationError(
          errorObj.message || 'Client error',
          undefined,
          errorObj,
          context
        );
      }
    }

    return new AtpError(
      error instanceof Error ? error.message : 'Unknown AT Protocol error',
      'UNKNOWN_ERROR',
      undefined,
      error,
      context
    );
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.logger.info('Cleaning up AT Protocol client');

    try {
      // Cancel any pending session refresh
      if (this.sessionRefreshPromise) {
        await this.sessionRefreshPromise;
      }

      this.session = null;
      this.logger.info('AT Protocol client cleanup completed');
    } catch (error) {
      this.logger.error('Error during AT Protocol client cleanup', error);
    }
  }

  /**
   * Load stored OAuth session from secure storage
   */
  private async loadStoredOAuthSession(): Promise<IOAuthSession | null> {
    try {
      // In a real implementation, this would load from secure storage
      // For now, we'll use environment variables or return null
      const storedSession = process.env['OAUTH_STORED_SESSION'];
      if (storedSession) {
        const session = JSON.parse(storedSession);
        return {
          ...session,
          expiresAt: new Date(session.expiresAt),
        };
      }
      return null;
    } catch (error) {
      this.logger.warn('Failed to load stored OAuth session', error);
      return null;
    }
  }

  /**
   * Store OAuth session to secure storage
   */
  private async storeOAuthSession(session: IOAuthSession): Promise<void> {
    try {
      // In a real implementation, this would store to secure storage
      // For now, we'll log the session (without sensitive data)
      this.logger.info('OAuth session stored', {
        did: session.did,
        handle: session.handle,
        expiresAt: session.expiresAt.toISOString(),
      });

      // Store in environment variable for demo purposes
      // In production, use proper secure storage
      process.env['OAUTH_STORED_SESSION'] = JSON.stringify(session);
    } catch (error) {
      this.logger.warn('Failed to store OAuth session', error);
    }
  }
}
