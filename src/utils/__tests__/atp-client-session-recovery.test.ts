/**
 * Tests for AtpClient session-expiry recovery: an 'expired' event must
 * invalidate the session immediately, a failed background recovery must not
 * wedge the client (the next authenticated call retries), and concurrent
 * callers must share in-flight recovery/authentication attempts instead of
 * racing parallel logins.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AtpAgentOptions, AtpSessionData, AtpSessionEvent } from '@atproto/api';
import { AtpClient } from '../atp-client.js';
import { createMockAtpConfig, createMockSession, mockConsole } from '../../test/setup.js';

// The real AtpAgent exposes token refresh on agent.sessionManager
// (CredentialSession.refreshSession()), not on the agent itself.
vi.mock('@atproto/api', () => ({
  AtpAgent: vi.fn().mockImplementation(function () {
    return {
      login: vi.fn(),
      sessionManager: { refreshSession: vi.fn() },
    };
  }),
}));

type PersistSession = (evt: AtpSessionEvent, sess?: AtpSessionData) => void;

describe('AtpClient session expiry recovery', () => {
  let mockAgent: any;
  let client: AtpClient;
  let persistSession: PersistSession;

  beforeEach(async () => {
    mockConsole();

    mockAgent = {
      login: vi.fn(),
      sessionManager: { refreshSession: vi.fn() },
    };

    const { AtpAgent } = await import('@atproto/api');
    vi.mocked(AtpAgent).mockImplementation(function () {
      return mockAgent;
    });

    client = new AtpClient(createMockAtpConfig());

    const constructorCall = vi.mocked(AtpAgent).mock.calls[0];
    persistSession = (constructorCall?.[0] as AtpAgentOptions | undefined)
      ?.persistSession as PersistSession;
  });

  it('marks the session inactive immediately on the expired event', () => {
    // Keep the background refresh pending so we observe the immediate state.
    mockAgent.sessionManager.refreshSession.mockImplementation(() => new Promise<void>(() => {}));

    persistSession('create', createMockSession());
    expect(client.isAuthenticated()).toBe(true);

    persistSession('expired', undefined);

    expect(client.isAuthenticated()).toBe(false);
  });

  it('retries authentication on the next call after a failed background recovery', async () => {
    persistSession('create', createMockSession());

    // Background recovery fails completely: refresh fails AND the re-login fails.
    mockAgent.sessionManager.refreshSession.mockRejectedValue(new Error('refresh endpoint down'));
    mockAgent.login.mockRejectedValueOnce(new Error('login transiently down'));
    persistSession('expired', undefined);

    // Let the failed background recovery settle.
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(mockAgent.login).toHaveBeenCalledTimes(1);

    // The next authenticated call must retry authentication, not stay wedged.
    mockAgent.login.mockResolvedValue({ success: true, data: createMockSession() });
    const operation = vi.fn().mockResolvedValue('recovered');
    const result = await client.executeAuthenticatedRequest(operation);

    expect(mockAgent.login).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });

  it('makes concurrent callers wait for the in-flight recovery instead of racing', async () => {
    const events: string[] = [];
    let resolveRefresh!: () => void;
    mockAgent.sessionManager.refreshSession.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveRefresh = resolve;
        })
    );

    const mockSession = createMockSession();
    persistSession('create', mockSession);
    persistSession('expired', undefined);

    const operation = async (): Promise<string> => {
      events.push('operation');
      return 'ok';
    };
    const callA = client.executeAuthenticatedRequest(operation);
    const callB = client.executeAuthenticatedRequest(operation);

    // Give the callers a chance to (incorrectly) run before recovery completes.
    await new Promise(resolve => setTimeout(resolve, 5));

    // Complete the recovery the way the real SDK does: the 'update' session
    // event fires before refreshSession() resolves.
    persistSession('update', mockSession);
    events.push('refreshed');
    resolveRefresh();

    const [resultA, resultB] = await Promise.all([callA, callB]);

    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(true);
    // Both operations ran only after the in-flight recovery finished.
    expect(events).toEqual(['refreshed', 'operation', 'operation']);
    // The shared recovery made a re-login unnecessary.
    expect(mockAgent.login).not.toHaveBeenCalled();
    expect(mockAgent.sessionManager.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('single-flights authenticate(): concurrent callers share one login attempt', async () => {
    // No session yet — every caller needs authentication at the same time.
    mockAgent.login.mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(() => resolve({ success: true, data: createMockSession() }), 5)
        )
    );

    const operation = vi.fn().mockResolvedValue('ok');
    const results = await Promise.all([
      client.executeAuthenticatedRequest(operation),
      client.executeAuthenticatedRequest(operation),
      client.executeAuthenticatedRequest(operation),
    ]);

    expect(results.every(result => result.success)).toBe(true);
    expect(operation).toHaveBeenCalledTimes(3);
    // The three concurrent callers must share a single in-flight login.
    expect(mockAgent.login).toHaveBeenCalledTimes(1);
  });
});
