#!/usr/bin/env node

/**
 * Health check script for Docker container
 * Works in both authenticated and unauthenticated modes
 */

import { AtpMcpServer } from './index.js';

async function healthCheck(): Promise<void> {
  try {
    // Create a minimal server instance for health checking
    // Use default configuration which supports unauthenticated mode
    const server = new AtpMcpServer({
      // Only override service if explicitly set in environment
      ...(process.env['ATPROTO_SERVICE'] != null && process.env['ATPROTO_SERVICE'] !== '' && {
        atproto: {
          service: process.env['ATPROTO_SERVICE'],
        },
      }),
    });

    // Get server status without starting the full server
    const status = server.getStatus();

    // Check if server is properly configured
    if (status.config == null) {
      throw new Error('Server configuration not found');
    }

    // Get system metrics
    const metrics = server.getSystemMetrics();

    // Check memory usage (fail if over 90% of limit)
    const memoryUsage = metrics.performance.memoryUsage;
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    if (memoryUsagePercent > 90) {
      throw new Error(`High memory usage: ${memoryUsagePercent.toFixed(2)}%`);
    }

    // Check if uptime is reasonable (server should have been running for at least 10 seconds)
    if (metrics.performance.uptime < 10000) {
      console.log('Server is starting up...');
    }

    console.log('Health check passed', {
      authMode: status.authMode,
      isAuthenticated: status.isAuthenticated,
      uptime: metrics.performance.uptime,
      memoryUsage: `${memoryUsagePercent.toFixed(2)}%`,
      cacheSize: metrics.performance.cacheSize,
      activeConnections: metrics.performance.activeConnections,
    });

    process.exit(0);
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  }
}

// Run health check if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  healthCheck();
}
