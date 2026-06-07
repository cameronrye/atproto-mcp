/**
 * OAuth management tools for AT Protocol authentication
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import { AtpOAuthClient } from '../../utils/oauth-client.js';

/**
 * Resolve OAuth client credentials from the environment.
 *
 * The canonical names match the rest of the server's config (`ATPROTO_CLIENT_ID`
 * / `ATPROTO_CLIENT_SECRET`). The legacy `OAUTH_*` names are accepted as a
 * fallback for backward compatibility so OAuth is configurable by either scheme.
 */
function resolveOAuthClientConfig(service: string) {
  return {
    service,
    authMethod: 'oauth' as const,
    clientId: process.env['ATPROTO_CLIENT_ID'] ?? process.env['OAUTH_CLIENT_ID'],
    clientSecret: process.env['ATPROTO_CLIENT_SECRET'] ?? process.env['OAUTH_CLIENT_SECRET'],
    redirectUri: process.env['ATPROTO_OAUTH_REDIRECT_URI'] ?? process.env['OAUTH_REDIRECT_URI'],
  };
}

const StartOAuthFlowSchema = z.object({
  identifier: z.string().min(1, 'Identifier (handle or DID) is required'),
});

const HandleOAuthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
});

const RefreshOAuthTokensSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const RevokeOAuthTokensSchema = z.object({
  accessToken: z.string().min(1, 'Access token is required'),
  refreshToken: z.string().optional(),
});

export class StartOAuthFlowTool extends BaseTool {
  public readonly schema = {
    method: 'start_oauth_flow',
    description:
      'Generate a PKCE OAuth authorization URL for AT Protocol. EXPERIMENTAL: the URL is ' +
      'constructed heuristically (no authorization-server metadata discovery / PAR) and the ' +
      'token-exchange step (handle_oauth_callback) is not implemented, so this cannot yet ' +
      'complete a login. For working auth use app passwords (ATPROTO_IDENTIFIER + ' +
      'ATPROTO_PASSWORD). No authentication required.',
    params: StartOAuthFlowSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'StartOAuthFlow', ToolAuthMode.PUBLIC);
  }

  protected async execute(params: { identifier: string }): Promise<{
    success: boolean;
    authUrl: string;
    state: string;
    instructions: string;
    expiresIn: number;
  }> {
    let oauthClient: AtpOAuthClient | undefined;
    try {
      this.logger.info('Starting OAuth flow', { identifier: params.identifier });

      this.validateActor(params.identifier);

      // Get OAuth configuration from ATP client + environment
      const service = this.atpClient.getAgent().service.toString();
      oauthClient = new AtpOAuthClient(resolveOAuthClientConfig(service));

      const authRequest = await oauthClient.startAuthorization(params.identifier);

      this.logger.info('OAuth authorization URL generated', {
        identifier: params.identifier,
        state: `${authRequest.state.substring(0, 8)}...`,
      });

      return {
        success: true,
        authUrl: authRequest.authUrl,
        state: authRequest.state,
        instructions:
          'EXPERIMENTAL: this authorization URL is generated heuristically and the ' +
          'token-exchange step (handle_oauth_callback) is not implemented, so the flow ' +
          'cannot currently complete a login. For working authentication, use app passwords ' +
          '(ATPROTO_IDENTIFIER + ATPROTO_PASSWORD) instead.',
        expiresIn: 1800, // 30 minutes
      };
    } catch (error) {
      this.logger.error('Failed to start OAuth flow', error);
      return this.formatError(error);
    } finally {
      // Avoid leaking the per-call client's background cleanup interval.
      oauthClient?.destroy();
    }
  }
}

export class HandleOAuthCallbackTool extends BaseTool {
  public readonly schema = {
    method: 'handle_oauth_callback',
    description:
      'Exchange an OAuth authorization code for access tokens. NOT IMPLEMENTED: token ' +
      'exchange is not wired in, so this always returns an error. Use app-password auth instead.',
    params: HandleOAuthCallbackSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'HandleOAuthCallback', ToolAuthMode.PUBLIC);
  }

  protected async execute(params: { code: string; state: string }): Promise<{
    success: boolean;
    session: {
      did: string;
      handle: string;
      expiresAt: string;
    };
    message: string;
  }> {
    let oauthClient: AtpOAuthClient | undefined;
    try {
      this.logger.info('Handling OAuth callback', {
        code: `${params.code.substring(0, 10)}...`,
        state: `${params.state.substring(0, 8)}...`,
      });

      // Get OAuth configuration from ATP client + environment
      const service = this.atpClient.getAgent().service.toString();
      oauthClient = new AtpOAuthClient(resolveOAuthClientConfig(service));

      const session = await oauthClient.handleCallback(params.code, params.state);

      this.logger.info('OAuth authentication successful', {
        did: session.did,
        handle: session.handle,
      });

      return {
        success: true,
        session: {
          did: session.did,
          handle: session.handle,
          expiresAt: session.expiresAt.toISOString(),
        },
        message: 'OAuth authentication completed successfully. You can now use AT Protocol tools.',
      };
    } catch (error) {
      this.logger.error('Failed to handle OAuth callback', error);
      return this.formatError(error);
    } finally {
      oauthClient?.destroy();
    }
  }
}

export class RefreshOAuthTokensTool extends BaseTool {
  public readonly schema = {
    method: 'refresh_oauth_tokens',
    description:
      'Refresh OAuth access tokens using a refresh token. NOT IMPLEMENTED: token refresh is ' +
      'not wired in, so this always returns an error. Use app-password auth instead.',
    params: RefreshOAuthTokensSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'RefreshOAuthTokens', ToolAuthMode.PUBLIC);
  }

  protected async execute(params: { refreshToken: string }): Promise<{
    success: boolean;
    session: {
      did: string;
      handle: string;
      expiresAt: string;
    };
    message: string;
  }> {
    let oauthClient: AtpOAuthClient | undefined;
    try {
      this.logger.info('Refreshing OAuth tokens');

      // Get OAuth configuration from ATP client + environment
      const service = this.atpClient.getAgent().service.toString();
      oauthClient = new AtpOAuthClient(resolveOAuthClientConfig(service));

      const session = await oauthClient.refreshTokens(params.refreshToken);

      this.logger.info('OAuth tokens refreshed successfully', {
        did: session.did,
        handle: session.handle,
      });

      return {
        success: true,
        session: {
          did: session.did,
          handle: session.handle,
          expiresAt: session.expiresAt.toISOString(),
        },
        message: 'OAuth tokens refreshed successfully.',
      };
    } catch (error) {
      this.logger.error('Failed to refresh OAuth tokens', error);
      return this.formatError(error);
    } finally {
      oauthClient?.destroy();
    }
  }
}

export class RevokeOAuthTokensTool extends BaseTool {
  public readonly schema = {
    method: 'revoke_oauth_tokens',
    description:
      'Revoke OAuth access and refresh tokens to log out. NOT IMPLEMENTED: token revocation ' +
      'is not wired in, so this always returns an error. Use app-password auth instead.',
    params: RevokeOAuthTokensSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'RevokeOAuthTokens', ToolAuthMode.PUBLIC);
  }

  protected async execute(params: { accessToken: string; refreshToken?: string }): Promise<{
    success: boolean;
    message: string;
  }> {
    let oauthClient: AtpOAuthClient | undefined;
    try {
      this.logger.info('Revoking OAuth tokens');

      // Get OAuth configuration from ATP client + environment
      const service = this.atpClient.getAgent().service.toString();
      oauthClient = new AtpOAuthClient(resolveOAuthClientConfig(service));

      await oauthClient.revokeTokens(params.accessToken, params.refreshToken);

      this.logger.info('OAuth tokens revoked successfully');

      return {
        success: true,
        message: 'OAuth tokens revoked successfully. You have been logged out.',
      };
    } catch (error) {
      this.logger.error('Failed to revoke OAuth tokens', error);
      return this.formatError(error);
    } finally {
      oauthClient?.destroy();
    }
  }
}
