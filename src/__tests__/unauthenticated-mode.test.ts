/**
 * Tests for unauthenticated mode functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AtpMcpServer } from '../index.js';
import { ConfigManager } from '../utils/config.js';
import { AtpClient } from '../utils/atp-client.js';

describe('Unauthenticated Mode', () => {
  let server: AtpMcpServer;

  beforeEach(() => {
    // Clear environment variables to ensure unauthenticated mode
    delete process.env['ATPROTO_IDENTIFIER'];
    delete process.env['ATPROTO_PASSWORD'];
    delete process.env['ATPROTO_CLIENT_ID'];
    delete process.env['ATPROTO_CLIENT_SECRET'];
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Configuration', () => {
    it('should create config without authentication credentials', () => {
      const configManager = new ConfigManager();
      const config = configManager.getConfig();

      expect(config.atproto.authMethod).toBeUndefined();
      expect(config.atproto.identifier).toBeUndefined();
      expect(config.atproto.password).toBeUndefined();
      expect(configManager.hasAuthentication()).toBe(false);
      expect(configManager.getAuthMode()).toBe('unauthenticated');
    });

    it('should validate config without authentication', () => {
      expect(() => {
        new ConfigManager();
      }).not.toThrow();
    });
  });

  describe('AtpClient', () => {
    it('should initialize without authentication', async () => {
      const configManager = new ConfigManager();
      const atpClient = new AtpClient(configManager.getAtpConfig());

      await expect(atpClient.initialize()).resolves.not.toThrow();
      expect(atpClient.isAuthenticated()).toBe(false);
      expect(atpClient.requiresAuthentication()).toBe(false);
    });

    it('should provide public agent', () => {
      const configManager = new ConfigManager();
      const atpClient = new AtpClient(configManager.getAtpConfig());

      const publicAgent = atpClient.getPublicAgent();
      expect(publicAgent).toBeDefined();
      expect(publicAgent.service.toString()).toBe('https://public.api.bsky.app/');
    });

    it('should handle public requests', async () => {
      const configManager = new ConfigManager();
      const atpClient = new AtpClient(configManager.getAtpConfig());

      const result = await atpClient.executePublicRequest(async () => ({ test: 'data' }), {
        operation: 'test',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ test: 'data' });
    });

    it('should reject authenticated requests without credentials', async () => {
      const configManager = new ConfigManager();
      const atpClient = new AtpClient(configManager.getAtpConfig());

      const result = await atpClient.executeAuthenticatedRequest(async () => ({ test: 'data' }), {
        operation: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('authentication');
    });
  });

  describe('Server Initialization', () => {
    it('should start server without authentication', async () => {
      server = new AtpMcpServer();

      await expect(server.start()).resolves.not.toThrow();

      const status = server.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.isAuthenticated).toBe(false);
      expect(status.authMode).toBe('unauthenticated');
      expect(status.hasAuthentication).toBe(false);
    });

    it('should provide system metrics in unauthenticated mode', async () => {
      server = new AtpMcpServer();
      await server.start();

      const metrics = server.getSystemMetrics();
      expect(metrics.server.authMode).toBe('unauthenticated');
      expect(metrics.server.isAuthenticated).toBe(false);
    });
  });

  describe('Tool Availability', () => {
    beforeEach(async () => {
      server = new AtpMcpServer();
      await server.start();
    });

    it('should make public tools available', () => {
      const atpClient = server.getAtpClient();

      // Test that we can create tools and check their availability
      // This is a basic test - in a real scenario we'd test specific tools
      expect(atpClient.requiresAuthentication()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing authentication gracefully', async () => {
      const configManager = new ConfigManager();
      const atpClient = new AtpClient(configManager.getAtpConfig());

      // Should not throw when trying to get public agent
      expect(() => atpClient.getPublicAgent()).not.toThrow();

      // Should throw when trying to get authenticated agent
      expect(() => atpClient.getAuthenticatedAgent()).toThrow();
    });
  });
});

describe('Mixed Authentication Mode', () => {
  let server: AtpMcpServer;

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  it('should handle partial credentials gracefully', async () => {
    // Set only identifier but not password
    process.env['ATPROTO_IDENTIFIER'] = 'test.bsky.social';

    const configManager = new ConfigManager();
    expect(configManager.hasAuthentication()).toBe(false);
    expect(configManager.getAuthMode()).toBe('unauthenticated');

    server = new AtpMcpServer();
    await expect(server.start()).resolves.not.toThrow();

    const status = server.getStatus();
    expect(status.authMode).toBe('unauthenticated');

    // Cleanup
    delete process.env['ATPROTO_IDENTIFIER'];
  });

  it('should prefer app-password when both methods have credentials', () => {
    process.env['ATPROTO_IDENTIFIER'] = 'test.bsky.social';
    process.env['ATPROTO_PASSWORD'] = 'test-password';
    process.env['ATPROTO_CLIENT_ID'] = 'test-client-id';
    process.env['ATPROTO_CLIENT_SECRET'] = 'test-client-secret';

    const configManager = new ConfigManager();
    const config = configManager.getConfig();

    expect(config.atproto.authMethod).toBe('app-password');
    expect(configManager.hasAuthentication()).toBe(true);
    expect(configManager.getAuthMode()).toBe('app-password');

    // Cleanup
    delete process.env['ATPROTO_IDENTIFIER'];
    delete process.env['ATPROTO_PASSWORD'];
    delete process.env['ATPROTO_CLIENT_ID'];
    delete process.env['ATPROTO_CLIENT_SECRET'];
  });
});
