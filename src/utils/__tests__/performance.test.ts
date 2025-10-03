/**
 * Tests for Performance Utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionPool, LRUCache, WebSocketManager, PerformanceMonitor } from '../performance.js';
import { Logger } from '../logger.js';

describe('ConnectionPool', () => {
  let pool: ConnectionPool;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('Test');
    pool = new ConnectionPool(
      {
        maxConnections: 5,
        minConnections: 1,
        acquireTimeoutMs: 5000,
        idleTimeoutMs: 10000,
        maxRetries: 3,
      },
      logger
    );
  });

  describe('Connection Management', () => {
    it('should acquire new connection', async () => {
      const conn = await pool.acquire('test-key');
      expect(conn).toBeDefined();
      expect(conn.id).toBe('test-key');
    });

    it('should reuse existing connection', async () => {
      const conn1 = await pool.acquire('test-key');
      pool.release('test-key');
      const conn2 = await pool.acquire('test-key');

      expect(conn1).toBe(conn2);
    });

    it('should throw when pool is exhausted', async () => {
      // Acquire max connections
      for (let i = 0; i < 5; i++) {
        await pool.acquire(`key-${i}`);
      }

      // Try to acquire one more
      await expect(pool.acquire('key-6')).rejects.toThrow('Connection pool exhausted');
    });

    it('should release connection', async () => {
      await pool.acquire('test-key');
      pool.release('test-key');

      const metrics = pool.getMetrics();
      expect(metrics.activeConnections).toBe(0);
    });

    it('should track active connections', async () => {
      await pool.acquire('key-1');
      await pool.acquire('key-2');

      const metrics = pool.getMetrics();
      expect(metrics.activeConnections).toBe(2);
      expect(metrics.totalConnections).toBe(2);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup idle connections', async () => {
      const conn = await pool.acquire('test-key');
      pool.release('test-key');

      // Manually set old timestamp
      conn.created = Date.now() - 20000; // 20 seconds ago

      pool.cleanup();

      const metrics = pool.getMetrics();
      expect(metrics.totalConnections).toBe(0);
    });

    it('should not cleanup active connections', async () => {
      await pool.acquire('test-key');

      pool.cleanup();

      const metrics = pool.getMetrics();
      expect(metrics.totalConnections).toBe(1);
      expect(metrics.activeConnections).toBe(1);
    });

    it('should not cleanup recently used connections', async () => {
      await pool.acquire('test-key');
      pool.release('test-key');

      pool.cleanup();

      const metrics = pool.getMetrics();
      expect(metrics.totalConnections).toBe(1);
    });
  });

  describe('Metrics', () => {
    it('should return correct metrics', async () => {
      await pool.acquire('key-1');
      await pool.acquire('key-2');
      pool.release('key-1');

      const metrics = pool.getMetrics();
      expect(metrics.totalConnections).toBe(2);
      expect(metrics.activeConnections).toBe(1);
      expect(metrics.idleConnections).toBe(1);
    });
  });
});

describe('LRUCache', () => {
  let cache: LRUCache<string>;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('Test');
    cache = new LRUCache<string>(
      {
        maxSize: 3,
        ttlMs: 1000,
        cleanupIntervalMs: 60000,
      },
      logger
    );
  });

  describe('Basic Operations', () => {
    it('should set and get value', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for missing key', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should delete value', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should clear all values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('LRU Eviction', () => {
    it('should evict oldest item when cache is full', async () => {
      cache.set('key1', 'value1');
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      cache.set('key2', 'value2');
      await new Promise(resolve => setTimeout(resolve, 10));
      cache.set('key3', 'value3');
      await new Promise(resolve => setTimeout(resolve, 10));

      // This should evict key1 (oldest timestamp)
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    it('should update access count on get', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key1');

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(2);
    });
  });

  describe('TTL Expiration', () => {
    it('should expire items after TTL', async () => {
      cache.set('key1', 'value1');

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should not expire items before TTL', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });
  });

  describe('Metrics', () => {
    it('should track cache hits and misses', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // hit
      cache.get('key2'); // miss
      cache.get('key1'); // hit

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(2);
      expect(metrics.misses).toBe(1);
      expect(metrics.hitRate).toBeCloseTo(2 / 3);
    });

    it('should track cache size', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const metrics = cache.getMetrics();
      expect(metrics.size).toBe(2);
    });

    it('should reset metrics on clear', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key2');

      cache.clear();

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.size).toBe(0);
    });

    it('should handle zero total accesses', () => {
      const metrics = cache.getMetrics();
      expect(metrics.hitRate).toBe(0);
    });
  });
});

describe('WebSocketManager', () => {
  let manager: WebSocketManager;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('Test');
    manager = new WebSocketManager(logger);
  });

  afterEach(() => {
    manager.disconnectAll();
  });

  describe('Connection Management', () => {
    it('should connect to WebSocket', async () => {
      const ws = await manager.connect('wss://example.com', 'test-key');
      expect(ws).toBeDefined();
      expect(ws.url).toBe('wss://example.com');
    });

    it('should reuse existing connection', async () => {
      const ws1 = await manager.connect('wss://example.com', 'test-key');
      const ws2 = await manager.connect('wss://example.com', 'test-key');

      expect(ws1).toBe(ws2);
    });

    it('should disconnect WebSocket', async () => {
      await manager.connect('wss://example.com', 'test-key');
      manager.disconnect('test-key');

      const metrics = manager.getMetrics();
      expect(metrics.activeConnections).toBe(0);
    });

    it('should disconnect all WebSockets', async () => {
      await manager.connect('wss://example.com', 'key-1');
      await manager.connect('wss://example.com', 'key-2');

      manager.disconnectAll();

      const metrics = manager.getMetrics();
      expect(metrics.activeConnections).toBe(0);
    });
  });

  describe('Metrics', () => {
    it('should track active connections', async () => {
      await manager.connect('wss://example.com', 'key-1');
      await manager.connect('wss://example.com', 'key-2');

      const metrics = manager.getMetrics();
      expect(metrics.activeConnections).toBe(2);
    });
  });
});

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('Test');
    monitor = new PerformanceMonitor(logger);
  });

  describe('Metrics', () => {
    it('should get basic metrics', () => {
      const metrics = monitor.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
      expect(metrics.connectionPoolSize).toBe(0);
      expect(metrics.activeConnections).toBe(0);
      expect(metrics.cacheHitRate).toBe(0);
      expect(metrics.cacheSize).toBe(0);
    });

    it('should include connection pool metrics', async () => {
      const pool = new ConnectionPool(
        {
          maxConnections: 5,
          minConnections: 1,
          acquireTimeoutMs: 5000,
          idleTimeoutMs: 10000,
          maxRetries: 3,
        },
        logger
      );

      await pool.acquire('test-key');
      monitor.setConnectionPool(pool);

      const metrics = monitor.getMetrics();
      expect(metrics.connectionPoolSize).toBe(1);
      expect(metrics.activeConnections).toBe(1);
    });

    it('should include cache metrics', () => {
      const cache = new LRUCache<string>(
        {
          maxSize: 10,
          ttlMs: 60000,
          cleanupIntervalMs: 60000,
        },
        logger
      );

      cache.set('key1', 'value1');
      cache.get('key1');
      monitor.setCache(cache);

      const metrics = monitor.getMetrics();
      expect(metrics.cacheSize).toBe(1);
      expect(metrics.cacheHitRate).toBeGreaterThan(0);
    });

    it('should include WebSocket manager', () => {
      const wsManager = new WebSocketManager(logger);
      monitor.setWebSocketManager(wsManager);

      const metrics = monitor.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('Logging', () => {
    it('should log metrics', () => {
      const logSpy = vi.spyOn(logger, 'info');
      monitor.logMetrics();

      expect(logSpy).toHaveBeenCalledWith('Performance metrics', expect.any(Object));
    });

    it('should start periodic logging', () => {
      const interval = monitor.startPeriodicLogging(100);
      expect(interval).toBeDefined();
      clearInterval(interval);
    });
  });
});
