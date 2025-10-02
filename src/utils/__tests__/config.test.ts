/**
 * Tests for configuration management system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigManager } from '../config.js';
import { ConfigurationError } from '../../types/index.js';
import { mockConsole, expectToThrow } from '../../test/setup.js';

describe('ConfigManager', () => {
  beforeEach(() => {
    // Mock console to reduce test noise
    mockConsole();

    // Clear environment variables
    delete process.env.ATPROTO_SERVICE;
    delete process.env.ATPROTO_IDENTIFIER;
    delete process.env.ATPROTO_PASSWORD;
    delete process.env.ATPROTO_CLIENT_ID;
    delete process.env.ATPROTO_CLIENT_SECRET;
    delete process.env.ATPROTO_AUTH_METHOD;
    delete process.env.MCP_SERVER_PORT;
    delete process.env.MCP_SERVER_HOST;
    delete process.env.MCP_SERVER_NAME;
  });

  describe('constructor', () => {
    it('should create config with defaults', () => {
      const config = new ConfigManager();
      const result = config.getConfig();

      expect(result.port).toBe(3000);
      expect(result.host).toBe('localhost');
      expect(result.name).toBe('atproto-mcp');
      expect(result.atproto.service).toBe('https://bsky.social');
      // authMethod should be undefined when no credentials are provided (unauthenticated mode)
      expect(result.atproto.authMethod).toBeUndefined();
    });

    it('should apply environment variables', () => {
      process.env.MCP_SERVER_PORT = '8080';
      process.env.MCP_SERVER_HOST = '0.0.0.0';
      process.env.ATPROTO_SERVICE = 'https://custom.bsky.social';
      process.env.ATPROTO_IDENTIFIER = 'test.bsky.social';
      process.env.ATPROTO_PASSWORD = 'test-password';

      const config = new ConfigManager();
      const result = config.getConfig();

      expect(result.port).toBe(8080);
      expect(result.host).toBe('0.0.0.0');
      expect(result.atproto.service).toBe('https://custom.bsky.social');
      expect(result.atproto.identifier).toBe('test.bsky.social');
      expect(result.atproto.password).toBe('test-password');
    });

    it('should apply overrides with highest priority', () => {
      process.env.MCP_SERVER_PORT = '8080';

      const config = new ConfigManager({
        port: 9000,
        atproto: {
          service: 'https://override.bsky.social',
          authMethod: 'oauth',
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
        },
      });

      const result = config.getConfig();

      expect(result.port).toBe(9000); // Override wins
      expect(result.atproto.service).toBe('https://override.bsky.social');
      expect(result.atproto.authMethod).toBe('oauth');
    });
  });

  describe('validation', () => {
    it('should validate app-password authentication', () => {
      expect(() => {
        new ConfigManager({
          atproto: {
            service: 'https://bsky.social',
            authMethod: 'app-password',
            identifier: 'test.bsky.social',
            password: 'test-password',
          },
        });
      }).not.toThrow();
    });

    it('should throw error for app-password without identifier', async () => {
      // Temporarily set NODE_ENV to production to test validation
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        await expectToThrow(
          () =>
            new ConfigManager({
              atproto: {
                service: 'https://bsky.social',
                authMethod: 'app-password',
                password: 'test-password',
              },
            }),
          ConfigurationError,
          /requires both identifier and password/
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should throw error for app-password without password', async () => {
      // Temporarily set NODE_ENV to production to test validation
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        await expectToThrow(
          () =>
            new ConfigManager({
              atproto: {
                service: 'https://bsky.social',
                authMethod: 'app-password',
                identifier: 'test.bsky.social',
              },
            }),
          ConfigurationError,
          /requires both identifier and password/
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should validate oauth authentication', () => {
      expect(() => {
        new ConfigManager({
          atproto: {
            service: 'https://bsky.social',
            authMethod: 'oauth',
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
          },
        });
      }).not.toThrow();
    });

    it('should throw error for oauth without clientId', async () => {
      // Temporarily set NODE_ENV to production to test validation
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        await expectToThrow(
          () =>
            new ConfigManager({
              atproto: {
                service: 'https://bsky.social',
                authMethod: 'oauth',
                clientSecret: 'test-client-secret',
              },
            }),
          ConfigurationError,
          /requires both clientId and clientSecret/
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should throw error for invalid port', async () => {
      await expectToThrow(
        () => new ConfigManager({ port: -1 }),
        ConfigurationError,
        /validation failed/
      );
    });

    it('should throw error for invalid service URL', async () => {
      await expectToThrow(
        () =>
          new ConfigManager({
            atproto: {
              service: 'not-a-url',
              authMethod: 'app-password',
              identifier: 'test',
              password: 'test',
            },
          }),
        ConfigurationError,
        /validation failed/
      );
    });
  });

  describe('getAtpConfig', () => {
    it('should return AT Protocol configuration', () => {
      const config = new ConfigManager({
        atproto: {
          service: 'https://test.bsky.social',
          authMethod: 'app-password',
          identifier: 'test.bsky.social',
          password: 'test-password',
        },
      });

      const atpConfig = config.getAtpConfig();

      expect(atpConfig.service).toBe('https://test.bsky.social');
      expect(atpConfig.authMethod).toBe('app-password');
      expect(atpConfig.identifier).toBe('test.bsky.social');
      expect(atpConfig.password).toBe('test-password');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const config = new ConfigManager({
        atproto: {
          service: 'https://bsky.social',
          authMethod: 'app-password',
          identifier: 'test.bsky.social',
          password: 'test-password',
        },
      });

      config.updateConfig({
        port: 8080,
        atproto: {
          service: 'https://updated.bsky.social',
          authMethod: 'app-password',
          identifier: 'updated.bsky.social',
          password: 'updated-password',
        },
      });

      const result = config.getConfig();
      expect(result.port).toBe(8080);
      expect(result.atproto.service).toBe('https://updated.bsky.social');
    });

    it('should validate updated configuration', async () => {
      const config = new ConfigManager({
        atproto: {
          service: 'https://bsky.social',
          authMethod: 'app-password',
          identifier: 'test.bsky.social',
          password: 'test-password',
        },
      });

      await expectToThrow(
        () => config.updateConfig({ port: -1 }),
        ConfigurationError,
        /validation failed/
      );
    });
  });

  describe('isValidForAuth', () => {
    it('should return true for valid app-password config', () => {
      const config = new ConfigManager({
        atproto: {
          service: 'https://bsky.social',
          authMethod: 'app-password',
          identifier: 'test.bsky.social',
          password: 'test-password',
        },
      });

      expect(config.isValidForAuth('app-password')).toBe(true);
    });

    it('should return false for invalid app-password config', () => {
      // Temporarily set NODE_ENV to production to test validation
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const config = new ConfigManager({
          atproto: {
            service: 'https://bsky.social',
            authMethod: 'oauth',
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
          },
        });

        expect(config.isValidForAuth('app-password')).toBe(false);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
