/**
 * Unit tests for FirehoseClient lifecycle logic.
 *
 * These exercise the reconnect/backoff/teardown logic WITHOUT real network or
 * real timers. The class only opens a WebSocket inside connect(); the lifecycle
 * helpers under test (scheduleReconnect/teardownSocket/disconnect/getFirehoseUrl)
 * never touch the socket on their own, so we can drive them via casting and fake
 * timers. Regression guards for:
 *  - the error-then-close double-schedule race (guard in scheduleReconnect)
 *  - the exponential backoff being capped at 30s
 *  - disconnect() fully tearing down (subscriptions cleared, shutting-down set)
 *  - teardownSocket() being a no-op when no socket is attached
 *  - getFirehoseUrl() scheme selection from ATPROTO_RELAY
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FirehoseClient } from '../firehose-client.js';

const makeClient = (): FirehoseClient =>
  new FirehoseClient({ service: 'https://bsky.social' } as never);

describe('FirehoseClient lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('scheduleReconnect()', () => {
    it('increments reconnectAttempts and arms a reconnectTimer', () => {
      const client = makeClient();
      const c = client as any;

      expect(c.reconnectAttempts).toBe(0);
      expect(c.reconnectTimer).toBeNull();

      c.scheduleReconnect();

      expect(c.reconnectAttempts).toBe(1);
      expect(c.reconnectTimer).not.toBeNull();
    });

    it('does not double-increment while a reconnect timer is already pending', () => {
      const client = makeClient();
      const c = client as any;

      // Both the 'close' and 'error' handlers can call scheduleReconnect for one
      // failed connection; the second call must be a no-op because reconnectTimer
      // is still set.
      c.scheduleReconnect();
      c.scheduleReconnect();

      expect(c.reconnectAttempts).toBe(1);
    });

    it('does nothing when the client is shutting down', () => {
      const client = makeClient();
      const c = client as any;
      c.isShuttingDown = true;

      c.scheduleReconnect();

      expect(c.reconnectAttempts).toBe(0);
      expect(c.reconnectTimer).toBeNull();
    });

    it('bounds the backoff delay at 30000ms even with a high attempt count', () => {
      const client = makeClient();
      const c = client as any;
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      // Force the exponential term well past the cap (2^49 * 1000) and pin
      // Math.random to its max so jitter pushes the delay to its upper bound.
      c.reconnectAttempts = 49;
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999999);

      c.scheduleReconnect();

      // The reconnect timer is armed by the scheduleReconnect's setTimeout. Find
      // the call whose delay is the bounded backoff (the only one this method
      // makes for the reconnect itself).
      const delays = setTimeoutSpy.mock.calls.map(call => call[1] as number);
      const maxDelay = Math.max(...delays);

      expect(maxDelay).toBeLessThanOrEqual(30000);
      // base is capped at 30000, full-jitter floor is base/2, so the upper-bound
      // jittered delay lands in (15000, 30000].
      expect(maxDelay).toBeGreaterThan(15000);

      randomSpy.mockRestore();
    });

    it('keeps the delay within the full-jitter window [base/2, base] for the first attempt', () => {
      const client = makeClient();
      const c = client as any;
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      // First attempt: base = min(1000 * 2^0, 30000) = 1000, jitter window
      // [500, 1000].
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

      c.scheduleReconnect();

      const delay = setTimeoutSpy.mock.calls.map(call => call[1] as number).find(d => d <= 1000);
      // random=0 -> delay = round(base/2) = 500 (the floor of the jitter window).
      expect(delay).toBe(500);

      randomSpy.mockRestore();
    });
  });

  describe('disconnect()', () => {
    it('sets isShuttingDown and clears all subscriptions', async () => {
      const client = makeClient();
      const c = client as any;

      client.subscribe({ id: 'sub-a', onEvent: () => {} });
      client.subscribe({ id: 'sub-b', onEvent: () => {} });
      expect(client.getSubscriptionCount()).toBe(2);

      await client.disconnect();

      expect(c.isShuttingDown).toBe(true);
      expect(client.getSubscriptionCount()).toBe(0);
    });
  });

  describe('teardownSocket()', () => {
    it('is a no-op (does not throw) when no socket is attached', () => {
      const client = makeClient();
      const c = client as any;

      expect(c.ws).toBeNull();
      expect(() => c.teardownSocket()).not.toThrow();
      expect(c.ws).toBeNull();
    });
  });

  describe('getFirehoseUrl()', () => {
    const originalRelay = process.env['ATPROTO_RELAY'];

    afterEach(() => {
      if (originalRelay === undefined) {
        delete process.env['ATPROTO_RELAY'];
      } else {
        process.env['ATPROTO_RELAY'] = originalRelay;
      }
    });

    it('defaults to the wss public relay subscribeRepos endpoint', () => {
      delete process.env['ATPROTO_RELAY'];
      const c = makeClient() as any;

      expect(c.getFirehoseUrl()).toBe('wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos');
    });

    it('preserves an explicit ws:// scheme for local relays', () => {
      process.env['ATPROTO_RELAY'] = 'ws://localhost:6008';
      const c = makeClient() as any;

      expect(c.getFirehoseUrl()).toBe('ws://localhost:6008/xrpc/com.atproto.sync.subscribeRepos');
    });

    it('maps https:// and bare hosts to secure wss://', () => {
      process.env['ATPROTO_RELAY'] = 'https://relay.example.com';
      const c = makeClient() as any;

      expect(c.getFirehoseUrl()).toBe(
        'wss://relay.example.com/xrpc/com.atproto.sync.subscribeRepos'
      );
    });

    it('appends a cursor from lastSeq so the reconnect resumes the stream', () => {
      delete process.env['ATPROTO_RELAY'];
      const c = makeClient() as any;
      c.lastSeq = 12345;

      expect(c.getFirehoseUrl()).toBe(
        'wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos?cursor=12345'
      );
    });
  });
});
