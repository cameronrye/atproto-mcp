/**
 * Regression test: configuration logging must not emit credentials in plaintext.
 * Passwords/secrets are fully redacted; the identifier and clientId are masked
 * (they are sensitive enough not to belong in logs verbatim).
 */

import { describe, expect, it } from 'vitest';
import { redactConfigForLog } from '../config.js';
import type { IMcpServerConfig } from '../../types/index.js';

const baseConfig: IMcpServerConfig = {
  port: 3000,
  host: 'localhost',
  name: 'atproto-mcp',
  version: '0.0.0',
  description: 'test',
  atproto: {
    service: 'https://bsky.social',
    identifier: 'test.bsky.social',
    password: 'super-secret-pw',
    clientId: 'client-123456',
    clientSecret: 'client-secret-value',
    authMethod: 'app-password',
  },
};

describe('redactConfigForLog', () => {
  it('fully redacts password and clientSecret', () => {
    const masked = redactConfigForLog(baseConfig);
    expect(masked.atproto.password).toBe('[REDACTED]');
    expect(masked.atproto.clientSecret).toBe('[REDACTED]');
  });

  it('masks identifier and clientId rather than logging them verbatim', () => {
    const masked = redactConfigForLog(baseConfig);
    expect(masked.atproto.identifier).not.toBe('test.bsky.social');
    expect(masked.atproto.identifier).toMatch(/\*\*\*/);
    expect(masked.atproto.clientId).not.toBe('client-123456');
    expect(masked.atproto.clientId).toMatch(/\*\*\*/);
  });

  it('leaves non-sensitive fields intact', () => {
    const masked = redactConfigForLog(baseConfig);
    expect(masked.atproto.service).toBe('https://bsky.social');
    expect(masked.name).toBe('atproto-mcp');
  });
});
