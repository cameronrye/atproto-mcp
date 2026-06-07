#!/usr/bin/env node

/**
 * Command-line interface for the AT Protocol MCP Server
 */

import { parseArgs } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigurationError, type IMcpServerConfig } from './types/index.js';
import { AtpMcpServer } from './index.js';
import { LogLevel, Logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = new Logger('CLI');

/**
 * Load environment variables from a `.env` file in the current working directory
 * (if present) so the documented `.env` workflow actually takes effect. Real
 * environment variables always win over `.env` values, and a missing file is a
 * no-op. Kept dependency-free and minimal on purpose.
 */
function loadEnvFile(): void {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return;
  }
  try {
    const content = readFileSync(envPath, 'utf8');
    let loaded = 0;
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (line === '' || line.startsWith('#')) {
        continue;
      }
      const eq = line.indexOf('=');
      if (eq === -1) {
        continue;
      }
      const key = line.slice(0, eq).trim();
      // Real environment variables take precedence over .env.
      if (key === '' || key in process.env) {
        continue;
      }
      let value = line.slice(eq + 1).trim();
      if (
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'")))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
      loaded++;
    }
    if (loaded > 0) {
      logger.info('Loaded environment variables from .env', { count: loaded });
    }
  } catch (error) {
    logger.warn('Failed to load .env file', error);
  }
}

/**
 * CLI argument definitions
 */
const CLI_OPTIONS = {
  port: {
    type: 'string' as const,
    short: 'p',
    description: 'Server port (default: 3000)',
  },
  host: {
    type: 'string' as const,
    short: 'h',
    description: 'Server host (default: localhost)',
  },
  service: {
    type: 'string' as const,
    short: 's',
    description: 'AT Protocol service URL (default: https://bsky.social)',
  },
  auth: {
    type: 'string' as const,
    short: 'a',
    description: 'Authentication method: app-password|oauth (optional)',
  },
  'log-level': {
    type: 'string' as const,
    short: 'l',
    description: 'Log level: debug|info|warn|error (default: info)',
  },
  help: {
    type: 'boolean' as const,
    description: 'Show help message',
  },
  version: {
    type: 'boolean' as const,
    short: 'v',
    description: 'Show version information',
  },
} as const;

/**
 * Show help message
 */
function showHelp(): void {
  console.log(`
AT Protocol MCP Server - Comprehensive interface for LLMs to interact with AT Protocol

🎯 Supports both authenticated and unauthenticated modes!

Usage: atproto-mcp [options]

Transport: this server communicates over stdio (for MCP clients such as Claude
Desktop). It does not listen on a TCP port; --port/--host are accepted but
currently have no effect.

Options:
  -p, --port <number>        Server port (reserved; stdio transport ignores it)
  -h, --host <string>        Server host (reserved; stdio transport ignores it)
  -s, --service <url>        AT Protocol service URL (default: https://bsky.social)
  -a, --auth <method>        Authentication method: app-password|oauth (optional)
  -l, --log-level <level>    Log level: debug|info|warn|error (default: info)
      --help                 Show this help message
  -v, --version              Show version information

🔓 Unauthenticated Mode (Default):
  The server works immediately without any setup. Available features:
  • Search posts and hashtags (search_posts)
  • View basic user profiles (get_user_profile)
  • Manage OAuth authentication flows

🔐 Authenticated Mode (Optional):
  Set environment variables to enable full functionality:
  • All write operations (create, like, repost, follow, etc.)
  • Access to feeds, timelines, and notifications
  • View follower/following lists
  • Resources and prompts

Environment Variables:
  ATPROTO_SERVICE           AT Protocol service URL
  ATPROTO_IDENTIFIER        Your AT Protocol identifier (handle or DID)
  ATPROTO_PASSWORD          App password for authentication
  ATPROTO_CLIENT_ID         OAuth client ID
  ATPROTO_CLIENT_SECRET     OAuth client secret
  ATPROTO_AUTH_METHOD       Authentication method (app-password|oauth)
  LOG_LEVEL                 Logging level (debug|info|warn|error)
  MCP_SERVER_PORT           Server port
  MCP_SERVER_HOST           Server host
  MCP_SERVER_NAME           Server name

Examples:
  # Start in unauthenticated mode (works immediately!)
  atproto-mcp

  # Start with custom port and debug logging
  atproto-mcp --port 8080 --log-level debug

  # Enable authentication with app password
  export ATPROTO_IDENTIFIER="your-handle.bsky.social"
  export ATPROTO_PASSWORD="your-app-password"
  atproto-mcp

  # Enable authentication with OAuth
  export ATPROTO_CLIENT_ID="your-client-id"
  export ATPROTO_CLIENT_SECRET="your-client-secret"
  atproto-mcp --auth oauth

For more information, visit: https://github.com/cameronrye/atproto-mcp
`);
}

/**
 * Show version information
 */
function showVersion(): void {
  try {
    // Read version from package.json
    const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
      name: string;
      version: string;
      description: string;
    };
    console.log(`AT Protocol MCP Server v${packageJson.version}`);
  } catch {
    console.log('AT Protocol MCP Server v0.1.0');
  }
}

/**
 * Parse command line arguments
 */
function parseCliArgs(): Partial<IMcpServerConfig> {
  try {
    const { values } = parseArgs({
      options: CLI_OPTIONS,
      allowPositionals: false,
    });

    // Handle help and version flags
    if (values.help === true) {
      showHelp();
      process.exit(0);
    }

    if (values.version === true) {
      showVersion();
      process.exit(0);
    }

    // Set log level if provided
    if (values['log-level'] != null && values['log-level'] !== '') {
      const logLevel = values['log-level'].toUpperCase();
      if (logLevel in LogLevel) {
        process.env['LOG_LEVEL'] = logLevel;
      } else {
        throw new ConfigurationError(
          `Invalid log level: ${values['log-level']}. Must be one of: debug, info, warn, error`
        );
      }
    }

    // Build configuration from CLI arguments
    const config: Partial<IMcpServerConfig> = {};

    if (values.port != null && values.port !== '') {
      const port = parseInt(values.port, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        throw new ConfigurationError(`Invalid port: ${values.port}. Must be between 1 and 65535`);
      }
      config.port = port;
    }

    if (values.host != null && values.host !== '') {
      config.host = values.host;
    }

    if (
      (values.service != null && values.service !== '') ||
      (values.auth != null && values.auth !== '')
    ) {
      // Only carry the fields the user actually provided on the CLI. Do NOT seed
      // a hardcoded service default here — otherwise passing --auth alone would
      // clobber ATPROTO_SERVICE from the environment with bsky.social.
      const atproto: Partial<IMcpServerConfig['atproto']> = {};

      if (values.service != null && values.service !== '') {
        try {
          new URL(values.service); // Validate URL
        } catch {
          throw new ConfigurationError(`Invalid service URL: ${values.service}`);
        }
        atproto.service = values.service;
      }

      if (values.auth != null && values.auth !== '') {
        if (values.auth !== 'app-password' && values.auth !== 'oauth') {
          throw new ConfigurationError(
            `Invalid auth method: ${values.auth}. Must be 'app-password' or 'oauth'`
          );
        }
        atproto.authMethod = values.auth;
      }

      config.atproto = atproto as IMcpServerConfig['atproto'];
    }

    return config;
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }

    logger.error('Failed to parse command line arguments', error);
    throw new ConfigurationError(
      'Invalid command line arguments. Use --help for usage information.'
    );
  }
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
  try {
    logger.info('Starting AT Protocol MCP Server CLI');

    // Load .env (if present) before building configuration so its values are
    // visible to ConfigManager and the rest of the server.
    loadEnvFile();

    // Parse command line arguments
    const cliConfig = parseCliArgs();

    // Create and start server
    const server = new AtpMcpServer(cliConfig);

    // Setup graceful shutdown handlers
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await server.stop();
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => {
      void shutdown('SIGINT');
    });
    process.on('SIGTERM', () => {
      void shutdown('SIGTERM');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', error => {
      logger.error('Uncaught exception', error);
      process.exit(1);
    });

    process.on('unhandledRejection', reason => {
      logger.error(
        'Unhandled rejection',
        reason instanceof Error ? reason : new Error(String(reason))
      );
      process.exit(1);
    });

    // Start the server
    await server.start();

    // Keep the process running
    logger.info('AT Protocol MCP Server is running. Press Ctrl+C to stop.');
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(`Configuration Error: ${error.message}`);
      console.error('Use --help for usage information.');
      process.exit(1);
    }

    logger.error('Failed to start AT Protocol MCP Server', error);
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as runCli };
