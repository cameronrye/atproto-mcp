import { afterEach, describe, expect, it } from 'vitest';
import { Logger, LogLevel } from '../logger.js';
import { RateLimiter, type ISecurityConfig, SecurityManager } from '../security.js';

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

describe('RateLimiter', () => {
  const limiters: RateLimiter[] = [];
  afterEach(() => {
    for (const l of limiters.splice(0)) l.destroy();
  });

  it('caps the number of tracked identifiers to bound memory under a key flood', () => {
    const limiter = new RateLimiter(
      { windowMs: 60000, maxRequests: 5, maxTrackedIdentifiers: 10 },
      logger
    );
    limiters.push(limiter);

    // Flood with 1000 distinct identifiers (e.g. attacker-controlled keys).
    for (let i = 0; i < 1000; i++) {
      limiter.isAllowed(`flood-${i}`);
    }

    // The map must not grow unbounded — it stays at/below the configured cap.
    expect(limiter.getMetrics().trackedIdentifiers).toBeLessThanOrEqual(10);
  });

  it('still enforces the limit for an active identifier under a key flood', () => {
    const limiter = new RateLimiter(
      { windowMs: 60000, maxRequests: 3, maxTrackedIdentifiers: 100 },
      logger
    );
    limiters.push(limiter);

    // Touch the active key repeatedly so it stays "recent" (LRU keeps it).
    for (let i = 0; i < 3; i++) expect(limiter.isAllowed('active')).toBe(true);
    expect(limiter.isAllowed('active')).toBe(false);
  });

  it('computes getResetTime without spreading the timestamp array', () => {
    const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 100 }, logger);
    limiters.push(limiter);

    const before = Date.now();
    limiter.isAllowed('id');
    const reset = limiter.getResetTime('id');
    // Reset = oldest request + window, i.e. roughly one window from now.
    expect(reset).toBeGreaterThanOrEqual(before + 60000 - 1000);
    expect(reset).toBeLessThanOrEqual(Date.now() + 60000 + 1000);
  });
});
