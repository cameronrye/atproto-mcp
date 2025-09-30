/**
 * OAuth management tools for AT Protocol authentication
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import { AtpOAuthClient } from '../../utils/oauth-client.js';

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
      'Start OAuth authorization flow for AT Protocol authentication. Returns authorization URL that user must visit.',
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
    try {
      this.logger.info('Starting OAuth flow', { identifier: params.identifier });

      this.validateActor(params.identifier);

      // Get OAuth configuration from ATP client
      const config = this.atpClient.getAgent().service;
      const oauthClient = new AtpOAuthClient({
        service: config.toString(),
        authMethod: 'oauth',
        clientId: process.env['OAUTH_CLIENT_ID'],
        clientSecret: process.env['OAUTH_CLIENT_SECRET'],
        redirectUri: process.env['OAUTH_REDIRECT_URI'],
      });

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
          'Visit the authorization URL in your browser, complete the OAuth flow, and use the returned authorization code with the handle_oauth_callback tool.',
        expiresIn: 1800, // 30 minutes
      };
    } catch (error) {
      this.logger.error('Failed to start OAuth flow', error);
      this.formatError(error);
    }
  }
}

export class HandleOAuthCallbackTool extends BaseTool {
  public readonly schema = {
    method: 'handle_oauth_callback',
    description: 'Handle OAuth callback and exchange authorization code for access tokens.',
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
    try {
      this.logger.info('Handling OAuth callback', {
        code: `${params.code.substring(0, 10)}...`,
        state: `${params.state.substring(0, 8)}...`,
      });

      // Get OAuth configuration from ATP client
      const config = this.atpClient.getAgent().service;
      const oauthClient = new AtpOAuthClient({
        service: config.toString(),
        authMethod: 'oauth',
        clientId: process.env['OAUTH_CLIENT_ID'],
        clientSecret: process.env['OAUTH_CLIENT_SECRET'],
        redirectUri: process.env['OAUTH_REDIRECT_URI'],
      });

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
      this.formatError(error);
    }
  }
}

export class RefreshOAuthTokensTool extends BaseTool {
  public readonly schema = {
    method: 'refresh_oauth_tokens',
    description: 'Refresh OAuth access tokens using a refresh token.',
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
    try {
      this.logger.info('Refreshing OAuth tokens');

      // Get OAuth configuration from ATP client
      const config = this.atpClient.getAgent().service;
      const oauthClient = new AtpOAuthClient({
        service: config.toString(),
        authMethod: 'oauth',
        clientId: process.env['OAUTH_CLIENT_ID'],
        clientSecret: process.env['OAUTH_CLIENT_SECRET'],
        redirectUri: process.env['OAUTH_REDIRECT_URI'],
      });

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
      this.formatError(error);
    }
  }
}

export class RevokeOAuthTokensTool extends BaseTool {
  public readonly schema = {
    method: 'revoke_oauth_tokens',
    description: 'Revoke OAuth access and refresh tokens to log out.',
    params: RevokeOAuthTokensSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'RevokeOAuthTokens', ToolAuthMode.PUBLIC);
  }

  protected async execute(params: { accessToken: string; refreshToken?: string }): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      this.logger.info('Revoking OAuth tokens');

      // Get OAuth configuration from ATP client
      const config = this.atpClient.getAgent().service;
      const oauthClient = new AtpOAuthClient({
        service: config.toString(),
        authMethod: 'oauth',
        clientId: process.env['OAUTH_CLIENT_ID'],
        clientSecret: process.env['OAUTH_CLIENT_SECRET'],
        redirectUri: process.env['OAUTH_REDIRECT_URI'],
      });

      await oauthClient.revokeTokens(params.accessToken, params.refreshToken);

      this.logger.info('OAuth tokens revoked successfully');

      return {
        success: true,
        message: 'OAuth tokens revoked successfully. You have been logged out.',
      };
    } catch (error) {
      this.logger.error('Failed to revoke OAuth tokens', error);
      this.formatError(error);
    }
  }
}
