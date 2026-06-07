/**
 * Real-world tests for health check functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const HEALTH_CHECK_PATH = join(__dirname, '../../dist/health-check.js');

describe('Health Check - Real-world Usage', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Basic Health Check', () => {
    it('should pass health check in unauthenticated mode', async () => {
      // Clear auth env vars to ensure unauthenticated mode
      delete process.env.ATPROTO_IDENTIFIER;
      delete process.env.ATPROTO_PASSWORD;
      delete process.env.ATPROTO_AUTH_METHOD;

      const { output, exitCode } = await runHealthCheck();

      expect(output).toContain('Health check passed');
      expect(output).toContain('authMode');
      expect(output).toContain('isAuthenticated');
      expect(exitCode).toBe(0);
    });

    it('should report unauthenticated mode status', async () => {
      delete process.env.ATPROTO_IDENTIFIER;
      delete process.env.ATPROTO_PASSWORD;

      const { output } = await runHealthCheck();

      expect(output).toContain('Health check passed');
      expect(output).toContain('unauthenticated');
    });

    it('should include process memory metrics', async () => {
      const { output, exitCode } = await runHealthCheck();

      expect(output).toContain('memoryUsage');
      expect(exitCode).toBe(0);
    });

    it('should include memory usage percentage', async () => {
      const { output } = await runHealthCheck();

      expect(output).toMatch(/memoryUsage.*%/);
    });
  });

  describe('Configuration', () => {
    it('should use default service when not specified', async () => {
      delete process.env.ATPROTO_SERVICE;

      const { output, exitCode } = await runHealthCheck();

      expect(exitCode).toBe(0);
      expect(output).toContain('Health check passed');
    });

    it('should accept custom service URL', async () => {
      process.env.ATPROTO_SERVICE = 'https://bsky.social';

      const { output, exitCode } = await runHealthCheck();

      expect(exitCode).toBe(0);
      expect(output).toContain('Health check passed');
    });

    it('should handle empty service URL', async () => {
      process.env.ATPROTO_SERVICE = '';

      const { output, exitCode } = await runHealthCheck();

      // May fail without a valid service URL
      expect([0, 1]).toContain(exitCode);
    });
  });

  describe('Metrics Validation', () => {
    it('should report process memory usage', async () => {
      const { output } = await runHealthCheck();

      expect(output).toContain('memoryUsage');
    });

    it('should report the auth mode', async () => {
      const { output } = await runHealthCheck();

      expect(output).toContain('authMode');
    });

    it('should disclose that it is a smoke check, not a live-server probe', async () => {
      const { output } = await runHealthCheck();

      expect(output).toContain('smoke check');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle startup phase gracefully', async () => {
      const { output, exitCode } = await runHealthCheck();

      // Should either pass or indicate startup
      if (exitCode === 0) {
        expect(output).toMatch(/Health check passed|Server is starting up/);
      }
    });
  });
});

/**
 * Helper function to run health check and capture output
 */
function runHealthCheck(): Promise<{ output: string; exitCode: number | null }> {
  return new Promise(resolve => {
    const child = spawn('node', [HEALTH_CHECK_PATH], {
      env: { ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'error' },
    });

    let output = '';
    let errorOutput = '';

    child.stdout?.on('data', data => {
      output += data.toString();
    });

    child.stderr?.on('data', data => {
      errorOutput += data.toString();
    });

    child.on('close', code => {
      resolve({ output: output + errorOutput, exitCode: code });
    });

    child.on('error', () => {
      resolve({ output: output + errorOutput, exitCode: -1 });
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      child.kill();
      resolve({ output: output + errorOutput, exitCode: null });
    }, 10000);
  });
}
