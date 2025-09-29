#!/usr/bin/env node

/**
 * Command-line interface for the AT Protocol MCP Server
 */

import { parseArgs } from 'node:util';
import type { IMcpServerConfig } from './types/index.js';
import { ConfigurationError } from './types/index.js';
import { AtpMcpServer } from './index.js';
import { LogLevel, Logger } from './utils/logger.js';

const logger = new Logger('CLI');

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

🎯 Works out-of-the-box without authentication for public data access!

Usage: atproto-mcp [options]

Options:
  -p, --port <number>        Server port (default: 3000)
  -h, --host <string>        Server host (default: localhost)
  -s, --service <url>        AT Protocol service URL (default: https://bsky.social)
  -a, --auth <method>        Authentication method: app-password|oauth (optional)
  -l, --log-level <level>    Log level: debug|info|warn|error (default: info)
      --help                 Show this help message
  -v, --version              Show version information

🔓 Unauthenticated Mode (Default):
  The server works immediately without any setup. Available features:
  • Search posts and hashtags
  • View user profiles and follower lists
  • Browse public feeds and threads
  • Access public timelines

🔐 Authenticated Mode (Optional):
  Set environment variables to enable write operations and private data:

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
    const packageJson = JSON.parse(
      require('fs').readFileSync(
        require('path').join(__dirname, '..', 'package.json'),
        'utf8'
      )
    );
    console.log(`AT Protocol MCP Server v${packageJson.version}`);
  } catch (error) {
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
    if (values.help) {
      showHelp();
      process.exit(0);
    }

    if (values.version) {
      showVersion();
      process.exit(0);
    }

    // Set log level if provided
    if (values['log-level']) {
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

    if (values.port) {
      const port = parseInt(values.port, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        throw new ConfigurationError(`Invalid port: ${values.port}. Must be between 1 and 65535`);
      }
      config.port = port;
    }

    if (values.host) {
      config.host = values.host;
    }

    if (values.service || values.auth) {
      config.atproto = {
        service: 'https://bsky.social',
        authMethod: 'app-password',
      };

      if (values.service) {
        try {
          new URL(values.service); // Validate URL
          config.atproto.service = values.service;
        } catch {
          throw new ConfigurationError(`Invalid service URL: ${values.service}`);
        }
      }

      if (values.auth) {
        if (values.auth !== 'app-password' && values.auth !== 'oauth') {
          throw new ConfigurationError(
            `Invalid auth method: ${values.auth}. Must be 'app-password' or 'oauth'`
          );
        }
        config.atproto.authMethod = values.auth as 'app-password' | 'oauth';
      }
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

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

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
