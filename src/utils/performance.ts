/**
 * Performance optimization utilities for production deployment
 */

import type { Logger } from './logger.js';

export interface IConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  maxRetries: number;
}

export interface ICacheConfig {
  maxSize: number;
  ttlMs: number;
  cleanupIntervalMs: number;
}

export interface IPerformanceMetrics {
  connectionPoolSize: number;
  activeConnections: number;
  cacheHitRate: number;
  cacheSize: number;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
}

/**
 * Simple connection pool for managing AT Protocol connections
 */
export class ConnectionPool {
  private connections: Map<string, any> = new Map();
  private activeConnections: Set<string> = new Set();
  private config: IConnectionPoolConfig;
  private logger: Logger;

  constructor(config: IConnectionPoolConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async acquire(key: string): Promise<any> {
    if (this.connections.has(key) && !this.activeConnections.has(key)) {
      this.activeConnections.add(key);
      this.logger.debug('Reusing existing connection', { key });
      return this.connections.get(key);
    }

    if (this.activeConnections.size >= this.config.maxConnections) {
      throw new Error('Connection pool exhausted');
    }

    // Create new connection (placeholder - would be actual AT Protocol connection)
    const connection = { id: key, created: Date.now() };
    this.connections.set(key, connection);
    this.activeConnections.add(key);

    this.logger.debug('Created new connection', { key, poolSize: this.connections.size });
    return connection;
  }

  release(key: string): void {
    this.activeConnections.delete(key);
    this.logger.debug('Released connection', { key, activeCount: this.activeConnections.size });
  }

  cleanup(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [key, connection] of this.connections.entries()) {
      if (
        !this.activeConnections.has(key) &&
        now - connection.created > this.config.idleTimeoutMs
      ) {
        toRemove.push(key);
      }
    }

    for (const key of toRemove) {
      this.connections.delete(key);
      this.logger.debug('Cleaned up idle connection', { key });
    }
  }

  getMetrics() {
    return {
      totalConnections: this.connections.size,
      activeConnections: this.activeConnections.size,
      idleConnections: this.connections.size - this.activeConnections.size,
    };
  }
}

/**
 * LRU Cache implementation for caching API responses
 */
export class LRUCache<T> {
  private cache: Map<string, { value: T; timestamp: number; accessCount: number }> = new Map();
  private config: ICacheConfig;
  private logger: Logger;
  private hits = 0;
  private misses = 0;

  constructor(config: ICacheConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;

    // Start cleanup interval
    setInterval(() => this.cleanup(), config.cleanupIntervalMs);
  }

  get(key: string): T | undefined {
    const item = this.cache.get(key);

    if (!item) {
      this.misses++;
      return undefined;
    }

    const now = Date.now();
    if (now - item.timestamp > this.config.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    item.accessCount++;
    this.hits++;
    return item.value;
  }

  set(key: string, value: T): void {
    const now = Date.now();

    // Remove oldest items if cache is full
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      timestamp: now,
      accessCount: 1,
    });

    this.logger.debug('Cached item', { key, cacheSize: this.cache.size });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.logger.info('Cache cleared');
  }

  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestTime = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.logger.debug('Evicted LRU item', { key: oldestKey });
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.config.ttlMs) {
        toRemove.push(key);
      }
    }

    for (const key of toRemove) {
      this.cache.delete(key);
    }

    if (toRemove.length > 0) {
      this.logger.debug('Cleaned up expired cache items', { count: toRemove.length });
    }
  }

  getMetrics() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }
}

/**
 * WebSocket connection manager for efficient streaming
 */
export class WebSocketManager {
  private connections: Map<string, WebSocket> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private logger: Logger;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async connect(url: string, key: string): Promise<WebSocket> {
    if (this.connections.has(key)) {
      const existing = this.connections.get(key)!;
      if (existing.readyState === WebSocket.OPEN) {
        return existing;
      }
    }

    return new Promise((resolve, reject) => {
      try {
        // Note: In a real implementation, you'd use the 'ws' package
        // For now, this is a placeholder structure
        const ws = {
          readyState: 1, // WebSocket.OPEN
          url,
          onopen: null as any,
          onclose: null as any,
          onerror: null as any,
          onmessage: null as any,
          send: (data: string) => {
            this.logger.debug('WebSocket send', { key, dataLength: data.length });
          },
          close: () => {
            this.logger.debug('WebSocket closed', { key });
            this.connections.delete(key);
          },
        } as any;

        ws.onopen = () => {
          this.connections.set(key, ws);
          this.reconnectAttempts.delete(key);
          this.logger.info('WebSocket connected', { key, url });
          resolve(ws);
        };

        ws.onerror = (error: any) => {
          this.logger.error('WebSocket error', error, { key, url });
          reject(error);
        };

        ws.onclose = () => {
          this.connections.delete(key);
          this.handleReconnect(url, key);
        };

        // Simulate connection
        setTimeout(() => {
          if (ws.onopen) ws.onopen({} as any);
        }, 100);
      } catch (error) {
        this.logger.error('Failed to create WebSocket', error as Error, { key, url });
        reject(error);
      }
    });
  }

  private async handleReconnect(url: string, key: string): Promise<void> {
    const attempts = this.reconnectAttempts.get(key) || 0;

    if (attempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnect attempts reached', { key, attempts });
      return;
    }

    this.reconnectAttempts.set(key, attempts + 1);

    setTimeout(
      async () => {
        try {
          await this.connect(url, key);
        } catch (error) {
          this.logger.error('Reconnect failed', error as Error, { key, attempt: attempts + 1 });
        }
      },
      this.reconnectDelay * Math.pow(2, attempts)
    ); // Exponential backoff
  }

  disconnect(key: string): void {
    const ws = this.connections.get(key);
    if (ws) {
      ws.close();
      this.connections.delete(key);
    }
  }

  disconnectAll(): void {
    for (const [key, ws] of this.connections.entries()) {
      ws.close();
    }
    this.connections.clear();
    this.reconnectAttempts.clear();
  }

  getMetrics() {
    return {
      activeConnections: this.connections.size,
      reconnectAttempts: Array.from(this.reconnectAttempts.values()).reduce((a, b) => a + b, 0),
    };
  }
}

/**
 * Performance monitor for tracking system metrics
 */
export class PerformanceMonitor {
  private logger: Logger;
  private startTime: number;
  private connectionPool?: ConnectionPool;
  private cache?: LRUCache<any>;
  private wsManager?: WebSocketManager;

  constructor(logger: Logger) {
    this.logger = logger;
    this.startTime = Date.now();
  }

  setConnectionPool(pool: ConnectionPool): void {
    this.connectionPool = pool;
  }

  setCache(cache: LRUCache<any>): void {
    this.cache = cache;
  }

  setWebSocketManager(wsManager: WebSocketManager): void {
    this.wsManager = wsManager;
  }

  getMetrics(): IPerformanceMetrics {
    const memoryUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;

    const poolMetrics = this.connectionPool?.getMetrics() || {
      totalConnections: 0,
      activeConnections: 0,
    };
    const cacheMetrics = this.cache?.getMetrics() || { size: 0, hitRate: 0 };

    return {
      connectionPoolSize: poolMetrics.totalConnections,
      activeConnections: poolMetrics.activeConnections,
      cacheHitRate: cacheMetrics.hitRate,
      cacheSize: cacheMetrics.size,
      memoryUsage,
      uptime,
    };
  }

  logMetrics(): void {
    const metrics = this.getMetrics();
    this.logger.info('Performance metrics', metrics);
  }

  startPeriodicLogging(intervalMs: number = 60000): NodeJS.Timeout {
    return setInterval(() => {
      this.logMetrics();
    }, intervalMs);
  }
}
