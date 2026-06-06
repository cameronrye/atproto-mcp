import { afterEach, describe, expect, it } from 'vitest';
import { Logger, LogLevel } from '../logger.js';
import { type ISecurityConfig, SecurityManager } from '../security.js';

const logger = new Logger('SecurityTest', LogLevel.ERROR);

function config(overrides: Partial<ISecurityConfig> = {}): ISecurityConfig {
  return {
    enableInputSanitization: true,
    enableRateLimit: true,
    enableErrorSanitization: true,
    maxInputLength: 10000,
    allowedOrigins: ['*'],
    trustedProxies: [],
    ...overrides,
  };
}

describe('SecurityManager.checkRateLimit', () => {
  const managers: SecurityManager[] = [];
  afterEach(() => {
    for (const m of managers.splice(0)) m.destroy();
  });

  it('allows requests up to the limit then blocks further requests', () => {
    const sm = new SecurityManager(config(), logger);
    managers.push(sm);

    // The configured limit is 100 requests/minute.
    for (let i = 0; i < 100; i++) {
      expect(sm.checkRateLimit('tool:create_post')).toBe(true);
    }
    expect(sm.checkRateLimit('tool:create_post')).toBe(false);
  });

  it('tracks identifiers independently', () => {
    const sm = new SecurityManager(config(), logger);
    managers.push(sm);

    for (let i = 0; i < 100; i++) sm.checkRateLimit('tool:a');
    expect(sm.checkRateLimit('tool:a')).toBe(false);
    // A different tool still has its own budget.
    expect(sm.checkRateLimit('tool:b')).toBe(true);
  });

  it('never blocks when rate limiting is disabled', () => {
    const sm = new SecurityManager(config({ enableRateLimit: false }), logger);
    managers.push(sm);

    for (let i = 0; i < 250; i++) {
      expect(sm.checkRateLimit('tool:create_post')).toBe(true);
    }
  });
});
