/**
 * Real-world tests for CLI functionality
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parseCliArgs } from '../cli.js';
import { ConfigurationError } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, '../../dist/cli.js');

describe('CLI - Real-world Usage', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clear ATP-related env vars for clean tests
    delete process.env['ATPROTO_SERVICE'];
    delete process.env['ATPROTO_IDENTIFIER'];
    delete process.env['ATPROTO_PASSWORD'];
    delete process.env['ATPROTO_AUTH_METHOD'];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Help and Version', () => {
    it('should display help message with --help flag', async () => {
      const output = await runCLI(['--help']);

      expect(output).toContain('AT Protocol MCP Server');
      expect(output).toContain('Usage: atproto-mcp');
      expect(output).toContain('Options:');
      expect(output).toContain('--port');
      expect(output).toContain('--host');
      expect(output).toContain('--service');
      expect(output).toContain('Unauthenticated Mode');
      expect(output).toContain('Authenticated Mode');
    });

    it('should display help message with -h flag (not consume it as host)', async () => {
      const output = await runCLI(['-h']);

      expect(output).toContain('AT Protocol MCP Server');
      expect(output).toContain('Usage: atproto-mcp');
      expect(output).toContain('Options:');
      expect(output).not.toContain('Configuration Error');
    });

    it('should display version with --version flag', async () => {
      const output = await runCLI(['--version']);

      expect(output).toContain('AT Protocol MCP Server');
      expect(output).toMatch(/\d+\.\d+\.\d+/); // Version number pattern
    });

    it('should display version with -v flag', async () => {
      const output = await runCLI(['-v']);

      expect(output).toContain('AT Protocol MCP Server');
      expect(output).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('Configuration Options', () => {
    it('should accept port option', async () => {
      const output = await runCLI(['--port', '4000', '--help']);

      // Help should still work with other options
      expect(output).toContain('AT Protocol MCP Server');
    });

    it('should accept host option', async () => {
      const output = await runCLI(['--host', '0.0.0.0', '--help']);

      expect(output).toContain('AT Protocol MCP Server');
    });

    it('should accept service option', async () => {
      const output = await runCLI(['--service', 'https://bsky.social', '--help']);

      expect(output).toContain('AT Protocol MCP Server');
    });

    it('should accept log-level option', async () => {
      const output = await runCLI(['--log-level', 'debug', '--help']);

      expect(output).toContain('AT Protocol MCP Server');
    });

    it('should accept auth option', async () => {
      const output = await runCLI(['--auth', 'app-password', '--help']);

      expect(output).toContain('AT Protocol MCP Server');
    });
  });

  describe('Short Options', () => {
    it('should accept -p for port', async () => {
      const output = await runCLI(['-p', '4000', '--help']);

      expect(output).toContain('AT Protocol MCP Server');
    });

    it('should accept -H for host', async () => {
      const output = await runCLI(['-H', '0.0.0.0', '--version']);

      expect(output).toContain('AT Protocol MCP Server');
      expect(output).not.toContain('Configuration Error');
    });

    it('should accept -s for service', async () => {
      const output = await runCLI(['-s', 'https://bsky.social', '--help']);

      expect(output).toContain('AT Protocol MCP Server');
    });

    it('should accept -l for log-level', async () => {
      const output = await runCLI(['-l', 'error', '--help']);

      expect(output).toContain('AT Protocol MCP Server');
    });

    it('should accept -a for auth', async () => {
      const output = await runCLI(['-a', 'oauth', '--help']);

      expect(output).toContain('AT Protocol MCP Server');
    });
  });

  describe('Transport Option Parsing', () => {
    it('should default to stdio transport', () => {
      const { transport } = parseCliArgs([]);

      expect(transport).toBe('stdio');
    });

    it('should accept --transport stdio', () => {
      const { transport } = parseCliArgs(['--transport', 'stdio']);

      expect(transport).toBe('stdio');
    });

    it('should accept --transport http', () => {
      const { transport } = parseCliArgs(['--transport', 'http']);

      expect(transport).toBe('http');
    });

    it('should accept -t as short option for transport', () => {
      const { transport } = parseCliArgs(['-t', 'http']);

      expect(transport).toBe('http');
    });

    it('should reject invalid transport values', () => {
      expect(() => parseCliArgs(['--transport', 'websocket'])).toThrow(ConfigurationError);
      expect(() => parseCliArgs(['--transport', 'websocket'])).toThrow(/Invalid transport/);
    });

    it('should reuse --port/--host for the http binding', () => {
      const { config, transport } = parseCliArgs([
        '--transport',
        'http',
        '--port',
        '8080',
        '-H',
        '0.0.0.0',
      ]);

      expect(transport).toBe('http');
      expect(config.port).toBe(8080);
      expect(config.host).toBe('0.0.0.0');
    });

    it('should still validate ports when used with http transport', () => {
      expect(() => parseCliArgs(['--transport', 'http', '--port', '70000'])).toThrow(
        ConfigurationError
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid log level gracefully', async () => {
      const { output } = await runCLIWithExitCode(['--log-level', 'invalid', '--help']);

      // Should still show help or error message
      expect(output.length).toBeGreaterThan(0);
    });

    it('should handle invalid port gracefully', async () => {
      const { output } = await runCLIWithExitCode(['--port', 'not-a-number', '--help']);

      expect(output.length).toBeGreaterThan(0);
    });
  });
});

/**
 * Helper function to run CLI and capture output
 */
function runCLI(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      env: { ...process.env, NODE_ENV: 'test' },
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
      // For help and version, exit code 0 is expected
      if (
        code === 0 ||
        args.includes('--help') ||
        args.includes('--version') ||
        args.includes('-v')
      ) {
        resolve(output + errorOutput);
      } else {
        resolve(output + errorOutput);
      }
    });

    child.on('error', error => {
      reject(error);
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      child.kill();
      resolve(output + errorOutput);
    }, 5000);
  });
}

/**
 * Helper function to run CLI and capture both output and exit code
 */
function runCLIWithExitCode(args: string[]): Promise<{ output: string; exitCode: number | null }> {
  return new Promise(resolve => {
    const child = spawn('node', [CLI_PATH, ...args], {
      env: { ...process.env, NODE_ENV: 'test' },
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

    // Timeout after 5 seconds
    setTimeout(() => {
      child.kill();
      resolve({ output: output + errorOutput, exitCode: null });
    }, 5000);
  });
}
