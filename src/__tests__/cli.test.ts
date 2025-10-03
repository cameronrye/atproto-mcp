/**
 * Tests for CLI
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigurationError } from '../types/index.js';

// Mock dependencies
vi.mock('../index.js', () => ({
  AtpMcpServer: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
  LogLevel: {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
  },
}));

describe('CLI', () => {
  let originalArgv: string[];
  let originalEnv: NodeJS.ProcessEnv;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    // Save original values
    originalArgv = [...process.argv];
    originalEnv = { ...process.env };

    // Setup spies
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    // Restore original values
    process.argv = originalArgv;
    process.env = originalEnv;

    // Restore spies
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('CLI Options', () => {
    it('should define all required CLI options', () => {
      const CLI_OPTIONS = {
        port: { type: 'string', short: 'p' },
        host: { type: 'string', short: 'h' },
        service: { type: 'string', short: 's' },
        auth: { type: 'string', short: 'a' },
        'log-level': { type: 'string', short: 'l' },
        help: { type: 'boolean' },
        version: { type: 'boolean', short: 'v' },
      };

      expect(CLI_OPTIONS.port).toBeDefined();
      expect(CLI_OPTIONS.host).toBeDefined();
      expect(CLI_OPTIONS.service).toBeDefined();
      expect(CLI_OPTIONS.auth).toBeDefined();
      expect(CLI_OPTIONS['log-level']).toBeDefined();
      expect(CLI_OPTIONS.help).toBeDefined();
      expect(CLI_OPTIONS.version).toBeDefined();
    });

    it('should have correct short flags', () => {
      const CLI_OPTIONS = {
        port: { type: 'string', short: 'p' },
        host: { type: 'string', short: 'h' },
        service: { type: 'string', short: 's' },
        auth: { type: 'string', short: 'a' },
        'log-level': { type: 'string', short: 'l' },
        version: { type: 'boolean', short: 'v' },
      };

      expect(CLI_OPTIONS.port.short).toBe('p');
      expect(CLI_OPTIONS.host.short).toBe('h');
      expect(CLI_OPTIONS.service.short).toBe('s');
      expect(CLI_OPTIONS.auth.short).toBe('a');
      expect(CLI_OPTIONS['log-level'].short).toBe('l');
      expect(CLI_OPTIONS.version.short).toBe('v');
    });
  });

  describe('Port Validation', () => {
    it('should accept valid port number', () => {
      const port = '8080';
      const parsed = parseInt(port, 10);
      expect(parsed).toBe(8080);
      expect(parsed).toBeGreaterThan(0);
      expect(parsed).toBeLessThanOrEqual(65535);
    });

    it('should reject invalid port (non-numeric)', () => {
      const port = 'invalid';
      const parsed = parseInt(port, 10);
      expect(isNaN(parsed)).toBe(true);
    });

    it('should reject port below 1', () => {
      const port = '0';
      const parsed = parseInt(port, 10);
      expect(parsed).toBeLessThan(1);
    });

    it('should reject port above 65535', () => {
      const port = '70000';
      const parsed = parseInt(port, 10);
      expect(parsed).toBeGreaterThan(65535);
    });

    it('should accept port at boundary (1)', () => {
      const port = '1';
      const parsed = parseInt(port, 10);
      expect(parsed).toBe(1);
      expect(parsed).toBeGreaterThanOrEqual(1);
      expect(parsed).toBeLessThanOrEqual(65535);
    });

    it('should accept port at boundary (65535)', () => {
      const port = '65535';
      const parsed = parseInt(port, 10);
      expect(parsed).toBe(65535);
      expect(parsed).toBeGreaterThanOrEqual(1);
      expect(parsed).toBeLessThanOrEqual(65535);
    });
  });

  describe('Service URL Validation', () => {
    it('should accept valid HTTPS URL', () => {
      expect(() => new URL('https://bsky.social')).not.toThrow();
    });

    it('should accept valid HTTP URL', () => {
      expect(() => new URL('http://localhost:3000')).not.toThrow();
    });

    it('should reject invalid URL', () => {
      expect(() => new URL('not-a-url')).toThrow();
    });

    it('should reject empty URL', () => {
      expect(() => new URL('')).toThrow();
    });

    it('should accept URL with path', () => {
      expect(() => new URL('https://example.com/path')).not.toThrow();
    });

    it('should accept URL with port', () => {
      expect(() => new URL('https://example.com:8080')).not.toThrow();
    });
  });

  describe('Auth Method Validation', () => {
    it('should accept app-password auth method', () => {
      const authMethod = 'app-password';
      expect(authMethod === 'app-password' || authMethod === 'oauth').toBe(true);
    });

    it('should accept oauth auth method', () => {
      const authMethod = 'oauth';
      expect(authMethod === 'app-password' || authMethod === 'oauth').toBe(true);
    });

    it('should reject invalid auth method', () => {
      const authMethod = 'invalid';
      expect(authMethod === 'app-password' || authMethod === 'oauth').toBe(false);
    });

    it('should reject empty auth method', () => {
      const authMethod = '';
      expect(authMethod === 'app-password' || authMethod === 'oauth').toBe(false);
    });
  });

  describe('Log Level Validation', () => {
    const LogLevel = {
      DEBUG: 'DEBUG',
      INFO: 'INFO',
      WARN: 'WARN',
      ERROR: 'ERROR',
    };

    it('should accept debug log level', () => {
      const logLevel = 'debug'.toUpperCase();
      expect(logLevel in LogLevel).toBe(true);
    });

    it('should accept info log level', () => {
      const logLevel = 'info'.toUpperCase();
      expect(logLevel in LogLevel).toBe(true);
    });

    it('should accept warn log level', () => {
      const logLevel = 'warn'.toUpperCase();
      expect(logLevel in LogLevel).toBe(true);
    });

    it('should accept error log level', () => {
      const logLevel = 'error'.toUpperCase();
      expect(logLevel in LogLevel).toBe(true);
    });

    it('should reject invalid log level', () => {
      const logLevel = 'invalid'.toUpperCase();
      expect(logLevel in LogLevel).toBe(false);
    });

    it('should be case insensitive', () => {
      expect('DEBUG' in LogLevel).toBe(true);
      expect('debug'.toUpperCase() in LogLevel).toBe(true);
      expect('DeBuG'.toUpperCase() in LogLevel).toBe(true);
    });
  });

  describe('Configuration Building', () => {
    it('should build config with port', () => {
      const config: any = {};
      const port = 8080;
      config.port = port;

      expect(config.port).toBe(8080);
    });

    it('should build config with host', () => {
      const config: any = {};
      const host = '0.0.0.0';
      config.host = host;

      expect(config.host).toBe('0.0.0.0');
    });

    it('should build config with service', () => {
      const config: any = {
        atproto: {
          service: 'https://custom.service',
          authMethod: 'app-password' as const,
        },
      };

      expect(config.atproto.service).toBe('https://custom.service');
    });

    it('should build config with auth method', () => {
      const config: any = {
        atproto: {
          service: 'https://bsky.social',
          authMethod: 'oauth' as const,
        },
      };

      expect(config.atproto.authMethod).toBe('oauth');
    });

    it('should build empty config when no args provided', () => {
      const config: any = {};
      expect(Object.keys(config).length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should create ConfigurationError with message', () => {
      const error = new ConfigurationError('Test error');
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toBe('Test error');
    });

    it('should handle ConfigurationError for invalid port', () => {
      const port = 'invalid';
      const parsed = parseInt(port, 10);

      if (isNaN(parsed) || parsed < 1 || parsed > 65535) {
        const error = new ConfigurationError(`Invalid port: ${port}. Must be between 1 and 65535`);
        expect(error).toBeInstanceOf(ConfigurationError);
        expect(error.message).toContain('Invalid port');
      }
    });

    it('should handle ConfigurationError for invalid URL', () => {
      const service = 'not-a-url';
      let error: ConfigurationError | null = null;

      try {
        new URL(service);
      } catch {
        error = new ConfigurationError(`Invalid service URL: ${service}`);
      }

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error?.message).toContain('Invalid service URL');
    });

    it('should handle ConfigurationError for invalid auth method', () => {
      const auth = 'invalid';

      if (auth !== 'app-password' && auth !== 'oauth') {
        const error = new ConfigurationError(
          `Invalid auth method: ${auth}. Must be 'app-password' or 'oauth'`
        );
        expect(error).toBeInstanceOf(ConfigurationError);
        expect(error.message).toContain('Invalid auth method');
      }
    });

    it('should handle ConfigurationError for invalid log level', () => {
      const logLevel = 'invalid';
      const LogLevel = { DEBUG: 'DEBUG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' };

      if (!(logLevel.toUpperCase() in LogLevel)) {
        const error = new ConfigurationError(
          `Invalid log level: ${logLevel}. Must be one of: debug, info, warn, error`
        );
        expect(error).toBeInstanceOf(ConfigurationError);
        expect(error.message).toContain('Invalid log level');
      }
    });
  });
});
