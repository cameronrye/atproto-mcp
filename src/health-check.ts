#!/usr/bin/env node

/**
 * Health check for the Docker container.
 *
 * IMPORTANT: this server speaks MCP over stdio and binds no port, so a separate
 * health-check process cannot connect to the running server to probe it. This
 * script therefore performs a *process-local smoke check*: it verifies the
 * package loads and the configuration builds/validates, and it checks this
 * process's own memory. It deliberately does NOT report "uptime", cache size, or
 * connection counts of the running server — a fresh process cannot observe those
 * and reporting them would be misleading.
 */

import { isMainModule } from './cli.js';
import { AtpMcpServer } from './index.js';

function healthCheck(): void {
  try {
    // Constructing the server validates configuration (throws on bad config).
    const server = new AtpMcpServer({
      // Only override service if explicitly set in environment
      ...(process.env['ATPROTO_SERVICE'] != null &&
        process.env['ATPROTO_SERVICE'] !== '' && {
          atproto: {
            service: process.env['ATPROTO_SERVICE'],
          },
        }),
    });

    const status = server.getStatus();
    if (status.config == null) {
      throw new Error('Server configuration not found');
    }

    // Check this process's memory (fail if heap is nearly exhausted).
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 90) {
      throw new Error(`High memory usage: ${memoryUsagePercent.toFixed(2)}%`);
    }

    console.log('Health check passed', {
      check: 'config+process smoke check (stdio server is not probed)',
      authMode: status.authMode,
      isAuthenticated: status.isAuthenticated,
      memoryUsage: `${memoryUsagePercent.toFixed(2)}%`,
    });

    process.exit(0);
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  }
}

// Run health check if this script is executed directly
if (isMainModule(import.meta.url, process.argv[1])) {
  void healthCheck();
}
