/**
 * Tests for AtpClient resilience: XRPC lexicon error-name fidelity and bounded
 * rate-limit retry. These exercise the live read/write hot path an LLM drives.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AtpClient } from '../atp-client.js';
import { RateLimitError } from '../../types/index.js';
import { mockConsole, createMockAtpConfig } from '../../test/setup.js';

vi.mock('@atproto/api', () => ({
  AtpAgent: vi.fn().mockImplementation(function () {
    return { login: vi.fn(), refreshSession: vi.fn() };
  }),
}));

function xrpcError(
  status: number,
  error: string,
  message: string,
  headers?: Record<string, string>
) {
  return Object.assign(new Error(message), { status, error, headers });
}

describe('AtpClient resilience', () => {
  let client: AtpClient;

  beforeEach(() => {
    mockConsole();
    client = new AtpClient(createMockAtpConfig());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('XRPC error-name fidelity', () => {
    it('threads the lexicon error name into the message the caller sees', async () => {
      const result = await client.executePublicRequest(async () => {
        throw xrpcError(400, 'DuplicateRecord', 'Record already exists');
      });

      expect(result.success).toBe(false);
      expect(result.success === false && result.error.message).toContain('DuplicateRecord');
    });

    it('does not double-prefix when the name is already in the message', async () => {
      const result = await client.executePublicRequest(async () => {
        throw xrpcError(403, 'BlockedActor', 'BlockedActor: you are blocked');
      });

      expect(result.success).toBe(false);
      const msg = result.success === false ? result.error.message : '';
      expect(msg.match(/BlockedActor/g)?.length).toBe(1);
    });
  });

  describe('bounded rate-limit retry', () => {
    it('retries a 429 with a short retry-after and then succeeds', async () => {
      vi.useFakeTimers();
      let calls = 0;
      const op = async () => {
        calls++;
        if (calls === 1)
          throw xrpcError(429, 'RateLimitExceeded', 'slow down', { 'retry-after': '1' });
        return 'ok';
      };

      const promise = client.executePublicRequest(op);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(calls).toBe(2);
      expect(result.success).toBe(true);
      expect(result.success === true && result.data).toBe('ok');
    });

    it('does not retry when retry-after exceeds the cap; fails fast with RateLimitError', async () => {
      let calls = 0;
      const op = async () => {
        calls++;
        throw xrpcError(429, 'RateLimitExceeded', 'slow down', { 'retry-after': '600' });
      };

      const result = await client.executePublicRequest(op);

      expect(calls).toBe(1);
      expect(result.success).toBe(false);
      expect(result.success === false && result.error).toBeInstanceOf(RateLimitError);
    });
  });
});
