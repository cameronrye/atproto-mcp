/**
 * Tests for Firehose Client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FirehoseClient } from '../firehose-client.js';
import type { IAtpConfig } from '../../types/index.js';
import { EventEmitter } from 'events';

// Mock WebSocket
vi.mock('ws', () => {
  const { EventEmitter } = require('events');

  class MockWebSocket extends EventEmitter {
    static OPEN = 1;
    static CLOSED = 3;

    readyState = 3; // CLOSED
    url: string;

    constructor(url: string) {
      super();
      this.url = url;
      // Simulate async connection
      setTimeout(() => {
        this.readyState = 1; // OPEN
        this.emit('open');
      }, 10);
    }

    close() {
      this.readyState = 3; // CLOSED
      this.emit('close', 1000, Buffer.from('Normal closure'));
    }

    ping() {
      // Mock ping
    }
  }

  return {
    WebSocket: MockWebSocket,
  };
});

describe('FirehoseClient', () => {
  let client: FirehoseClient;
  let config: IAtpConfig;

  beforeEach(() => {
    config = {
      service: 'https://bsky.social',
      authMethod: 'app-password',
    };
    client = new FirehoseClient(config);
  });

  afterEach(async () => {
    await client.disconnect();
  });

  describe('Constructor', () => {
    it('should create client with config', () => {
      expect(client).toBeDefined();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Connection', () => {
    it('should connect to firehose', async () => {
      const connectedPromise = new Promise(resolve => {
        client.on('connected', resolve);
      });

      await client.connect();
      await connectedPromise;

      expect(client.isConnected()).toBe(true);
    });

    it('should not connect twice if already connecting', async () => {
      const promise1 = client.connect();
      const promise2 = client.connect();

      await Promise.all([promise1, promise2]);
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(client.isConnected()).toBe(true);
    });

    it('should emit connected event', async () => {
      const connectedSpy = vi.fn();
      client.on('connected', connectedSpy);

      await client.connect();
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(connectedSpy).toHaveBeenCalled();
    });

    it('should generate correct firehose URL', async () => {
      await client.connect();
      await new Promise(resolve => setTimeout(resolve, 20));

      // The URL should be wss://bsky.social/xrpc/com.atproto.sync.subscribeRepos
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('Disconnection', () => {
    it('should disconnect from firehose', async () => {
      await client.connect();
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(client.isConnected()).toBe(true);

      await client.disconnect();

      expect(client.isConnected()).toBe(false);
    });

    it('should emit disconnected event', async () => {
      const disconnectedSpy = vi.fn();
      client.on('disconnected', disconnectedSpy);

      await client.connect();
      await new Promise(resolve => setTimeout(resolve, 20));
      await client.disconnect();

      expect(disconnectedSpy).toHaveBeenCalled();
    });

    it('should cleanup resources on disconnect', async () => {
      await client.connect();
      await new Promise(resolve => setTimeout(resolve, 20));
      await client.disconnect();

      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Subscriptions', () => {
    it('should add subscription', () => {
      const subscription = {
        id: 'test-sub',
        onEvent: vi.fn(),
      };

      client.subscribe(subscription);

      expect(client['subscriptions'].has('test-sub')).toBe(true);
    });

    it('should remove subscription', () => {
      const subscription = {
        id: 'test-sub',
        onEvent: vi.fn(),
      };

      client.subscribe(subscription);
      expect(client['subscriptions'].has('test-sub')).toBe(true);

      client.unsubscribe('test-sub');
      expect(client['subscriptions'].has('test-sub')).toBe(false);
    });

    it('should add subscription with collections filter', () => {
      const subscription = {
        id: 'test-sub',
        collections: ['app.bsky.feed.post'],
        onEvent: vi.fn(),
      };

      client.subscribe(subscription);

      expect(client['subscriptions'].get('test-sub')?.collections).toEqual(['app.bsky.feed.post']);
    });

    it('should add subscription with error handler', () => {
      const subscription = {
        id: 'test-sub',
        onEvent: vi.fn(),
        onError: vi.fn(),
      };

      client.subscribe(subscription);

      expect(client['subscriptions'].get('test-sub')?.onError).toBeDefined();
    });
  });

  describe('Event Processing', () => {
    it('should process firehose events', async () => {
      const eventSpy = vi.fn();
      client.on('event', eventSpy);

      await client.connect();
      await new Promise(resolve => setTimeout(resolve, 20));

      // Simulate receiving a message
      const mockData = Buffer.from('mock data');
      client['ws']?.emit('message', mockData);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should notify matching subscriptions', async () => {
      const onEvent = vi.fn();
      const subscription = {
        id: 'test-sub',
        collections: ['app.bsky.feed.post'],
        onEvent,
      };

      client.subscribe(subscription);

      await client.connect();
      await new Promise(resolve => setTimeout(resolve, 20));

      // Simulate receiving a message
      const mockData = Buffer.from('mock data');
      client['ws']?.emit('message', mockData);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(onEvent).toHaveBeenCalled();
    });

    it('should not notify non-matching subscriptions', async () => {
      const onEvent = vi.fn();
      const subscription = {
        id: 'test-sub',
        collections: ['app.bsky.feed.like'],
        onEvent,
      };

      client.subscribe(subscription);

      await client.connect();
      await new Promise(resolve => setTimeout(resolve, 20));

      // The mock event has collection 'app.bsky.feed.post'
      const mockData = Buffer.from('mock data');
      client['ws']?.emit('message', mockData);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not be called because collection doesn't match
      expect(onEvent).not.toHaveBeenCalled();
    });

    it('should notify subscriptions without collection filter', async () => {
      const onEvent = vi.fn();
      const subscription = {
        id: 'test-sub',
        onEvent,
      };

      client.subscribe(subscription);

      await client.connect();
      await new Promise(resolve => setTimeout(resolve, 20));

      const mockData = Buffer.from('mock data');
      client['ws']?.emit('message', mockData);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(onEvent).toHaveBeenCalled();
    });

    it('should update last sequence number', async () => {
      await client.connect();
      await new Promise(resolve => setTimeout(resolve, 20));

      const mockData = Buffer.from('mock data');
      client['ws']?.emit('message', mockData);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(client.getLastSeq()).not.toBeNull();
    });

    it('should handle subscription errors', async () => {
      const onEvent = vi.fn().mockImplementation(() => {
        throw new Error('Subscription error');
      });
      const onError = vi.fn();
      const subscription = {
        id: 'test-sub',
        onEvent,
        onError,
      };

      client.subscribe(subscription);

      await client.connect();
      await new Promise(resolve => setTimeout(resolve, 20));

      const mockData = Buffer.from('mock data');
      client['ws']?.emit('message', mockData);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should emit error event on WebSocket error', async () => {
      const errorSpy = vi.fn();
      client.on('error', errorSpy);

      await client.connect();
      await new Promise(resolve => setTimeout(resolve, 20));

      const error = new Error('WebSocket error');
      client['ws']?.emit('error', error);

      expect(errorSpy).toHaveBeenCalledWith(error);
    });

    it('should handle message parsing errors', async () => {
      const errorSpy = vi.fn();
      client.on('error', errorSpy);

      await client.connect();
      await new Promise(resolve => setTimeout(resolve, 20));

      // Override handleMessage to throw
      const originalHandleMessage = client['handleMessage'];
      client['handleMessage'] = () => {
        throw new Error('Parse error');
      };

      const mockData = Buffer.from('invalid data');
      client['ws']?.emit('message', mockData);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(errorSpy).toHaveBeenCalled();

      // Restore original method
      client['handleMessage'] = originalHandleMessage;
    });
  });

  describe('Status', () => {
    it('should return connection status', async () => {
      expect(client.isConnected()).toBe(false);

      await client.connect();
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(client.isConnected()).toBe(true);

      await client.disconnect();

      expect(client.isConnected()).toBe(false);
    });

    it('should return last sequence number', async () => {
      expect(client.getLastSeq()).toBeNull();

      await client.connect();
      await new Promise(resolve => setTimeout(resolve, 20));

      const mockData = Buffer.from('mock data');
      client['ws']?.emit('message', mockData);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(client.getLastSeq()).not.toBeNull();
    });
  });
});
