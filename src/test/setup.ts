/**
 * Test setup and configuration for the AT Protocol MCP Server
 */

import { afterEach, beforeEach, vi } from 'vitest';

// Mock environment variables for testing
const originalEnv = process.env;

beforeEach(() => {
  // Reset environment variables
  process.env = { ...originalEnv };

  // Set default test environment variables
  process.env['NODE_ENV'] = 'test';
  process.env['LOG_LEVEL'] = 'error'; // Reduce noise in tests

  // Clear all mocks
  vi.clearAllMocks();
});

afterEach(() => {
  // Restore original environment
  process.env = originalEnv;

  // Reset all mocks
  vi.resetAllMocks();
});

/**
 * Test utilities and helpers
 */

/**
 * Create a mock AT Protocol session
 */
export function createMockSession(): {
  did: 'did:plc:test123';
  handle: string;
  accessJwt: string;
  refreshJwt: string;
  active: boolean;
  status: string;
  email?: string;
  emailConfirmed?: boolean;
  emailAuthFactor?: boolean;
  didDoc?: unknown;
} {
  return {
    did: 'did:plc:test123' as const,
    handle: 'test.bsky.social',
    accessJwt: 'mock-access-jwt',
    refreshJwt: 'mock-refresh-jwt',
    active: true,
    status: 'valid',
  };
}

/**
 * Create a mock AT Protocol configuration
 */
export function createMockAtpConfig(): {
  service: string;
  identifier: string;
  password: string;
  authMethod: 'app-password';
} {
  return {
    service: 'https://bsky.social',
    identifier: 'test.bsky.social',
    password: 'test-password',
    authMethod: 'app-password' as const,
  };
}

/**
 * Create a mock MCP server configuration
 */
export function createMockServerConfig(): {
  port: number;
  host: string;
  name: string;
  version: string;
  description: string;
  atproto: {
    service: string;
    identifier: string;
    password: string;
    authMethod: 'app-password';
  };
} {
  return {
    port: 3000,
    host: 'localhost',
    name: 'atproto-mcp-test',
    version: '0.1.0',
    description: 'Test AT Protocol MCP Server',
    atproto: createMockAtpConfig(),
  };
}

/**
 * Mock console methods to reduce test noise
 */
export function mockConsole(): Record<string, unknown> {
  return {
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    info: vi.spyOn(console, 'info').mockImplementation(() => {}),
  };
}

/**
 * Create a promise that resolves after a specified delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a promise that rejects after a specified delay
 */
export function rejectAfter(ms: number, error: Error): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(error), ms));
}

/**
 * Assert that a function throws an error with specific properties
 */
export async function expectToThrow<T extends Error>(
  fn: () => Promise<unknown> | unknown,
  errorClass: new (...args: any[]) => T,
  message?: string | RegExp
): Promise<T> {
  try {
    await fn();
    throw new Error('Expected function to throw, but it did not');
  } catch (error) {
    if (!(error instanceof errorClass)) {
      throw new Error(
        `Expected error to be instance of ${errorClass.name}, but got ${error?.constructor.name}`
      );
    }

    if (message) {
      const errorMessage = error.message;
      if (typeof message === 'string') {
        if (errorMessage !== message) {
          throw new Error(`Expected error message "${message}", but got "${errorMessage}"`);
        }
      } else if (message instanceof RegExp) {
        if (!message.test(errorMessage)) {
          throw new Error(`Expected error message to match ${message}, but got "${errorMessage}"`);
        }
      }
    }

    return error;
  }
}

/**
 * Mock AT Protocol API responses
 */
export class MockAtpAgent {
  public loginResponse: any = { success: true, data: createMockSession() };
  public refreshResponse: any = { success: true };

  async login(): Promise<any> {
    return this.loginResponse;
  }

  async refreshSession(): Promise<any> {
    return this.refreshResponse;
  }

  setLoginResponse(response: any): void {
    this.loginResponse = response;
  }

  setRefreshResponse(response: any): void {
    this.refreshResponse = response;
  }
}

/**
 * Create a mock AT Protocol agent
 */
export function createMockAtpAgent(): MockAtpAgent {
  return new MockAtpAgent();
}
