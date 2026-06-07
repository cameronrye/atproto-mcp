/**
 * Performance monitoring utilities.
 *
 * NOTE: this module previously also shipped a ConnectionPool, an LRUCache, and a
 * WebSocketManager. They were never wired into the request/tool data path — the
 * pool and websocket manager returned simulated placeholder objects and the
 * cache cached nothing — so they only produced misleading "metrics". They have
 * been removed; if real pooling/caching is needed later it should be added where
 * requests are actually issued (see AtpClient) rather than as unused scaffolding.
 */

import type { Logger } from './logger.js';

export interface IPerformanceMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  /** Milliseconds since this monitor was constructed. */
  uptime: number;
}

/**
 * Performance monitor for tracking real process-level metrics.
 */
export class PerformanceMonitor {
  private logger: Logger;
  private startTime: number;

  constructor(logger: Logger) {
    this.logger = logger;
    this.startTime = Date.now();
  }

  getMetrics(): IPerformanceMetrics {
    return {
      memoryUsage: process.memoryUsage(),
      uptime: Date.now() - this.startTime,
    };
  }

  logMetrics(): void {
    this.logger.info('Performance metrics', this.getMetrics());
  }

  startPeriodicLogging(intervalMs: number = 60000): NodeJS.Timeout {
    const timer = setInterval(() => {
      this.logMetrics();
    }, intervalMs);
    // Don't let periodic metrics logging keep the process alive on its own.
    timer.unref();
    return timer;
  }
}
