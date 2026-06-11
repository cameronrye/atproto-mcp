/**
 * Tests for AtpOAuthClient: the not-implemented error must steer users to the
 * supported auth path (app passwords) and must not reference removed tools.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { AtpOAuthClient } from '../oauth-client.js';
import { AuthenticationError, type IAtpConfig } from '../../types/index.js';
import { mockConsole } from '../../test/setup.js';

const config: IAtpConfig = {
  service: 'https://bsky.social',
  authMethod: 'oauth',
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
};

describe('AtpOAuthClient not-implemented message', () => {
  let client: AtpOAuthClient;

  beforeEach(() => {
    mockConsole();
    client = new AtpOAuthClient(config);
  });

  afterEach(() => {
    client.destroy();
  });

  it('states OAuth is not yet supported and points to app-password auth, not a removed tool', async () => {
    const error: unknown = await client.refreshTokens('some-refresh-token').catch(e => e);

    expect(error).toBeInstanceOf(AuthenticationError);
    const message = (error as AuthenticationError).message;
    expect(message).toMatch(/not yet supported/i);
    expect(message).toMatch(/app-password/i);
    // start_oauth_flow was removed from the tool surface; the error must not
    // direct users to it.
    expect(message).not.toContain('start_oauth_flow');
  });
});
