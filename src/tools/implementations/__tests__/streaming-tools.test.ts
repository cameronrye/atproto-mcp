/**
 * Tests for Streaming Tools
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  StartStreamingTool,
  StopStreamingTool,
  GetStreamingStatusTool,
  GetRecentEventsTool,
} from '../streaming-tools.js';
import { AtpClient } from '../../../utils/atp-client.js';
import { ValidationError } from '../../../types/index.js';

// Mock FirehoseClient
vi.mock('../../../utils/firehose-client.js', () => ({
  FirehoseClient: class {
    on() {
      return this;
    }
    connect() {
      return Promise.resolve();
    }
    disconnect() {
      return Promise.resolve();
    }
    subscribe() {}
    unsubscribe() {}
    isConnected() {
      return true;
    }
    getLastSeq() {
      return 12345;
    }
    subscriptions = new Map();
  },
}));

// Mock AtpClient
vi.mock('../../../utils/atp-client.js');

describe('StartStreamingTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: StartStreamingTool;

  beforeEach(() => {
    mockAgent = {
      service: { toString: () => 'https://bsky.social' },
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    tool = new StartStreamingTool(mockAtpClient);

    // Reset static properties
    (StartStreamingTool as any).firehoseClient = null;
    (StartStreamingTool as any).eventBuffer = [];
  });

  afterEach(() => {
    // Clean up static properties
    (StartStreamingTool as any).firehoseClient = null;
    (StartStreamingTool as any).eventBuffer = [];
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('start_streaming');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('streaming');
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty subscription ID', async () => {
      await expect(tool.handler({ subscriptionId: '' })).rejects.toThrow(ValidationError);
    });

    it('should accept optional collections array', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      const result = await tool.handler({
        subscriptionId: 'test-sub',
        collections: ['app.bsky.feed.post'],
      });

      expect(result.success).toBe(true);
      expect(result.subscription.collections).toEqual(['app.bsky.feed.post']);
    });

    it('should default to empty collections array', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      const result = await tool.handler({ subscriptionId: 'test-sub' });

      expect(result.success).toBe(true);
      expect(result.subscription.collections).toEqual([]);
    });
  });

  describe('Start Streaming', () => {
    it('should start streaming successfully', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      const result = await tool.handler({
        subscriptionId: 'test-subscription',
        collections: ['app.bsky.feed.post'],
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Started streaming');
      expect(result.subscription.id).toBe('test-subscription');
      expect(result.subscription.status).toBe('active');
      expect(result.firehoseStatus.connected).toBe(true);
    });

    it('should initialize firehose client on first use', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      expect((StartStreamingTool as any).firehoseClient).toBeNull();

      await tool.handler({ subscriptionId: 'test-sub' });

      expect((StartStreamingTool as any).firehoseClient).not.toBeNull();
    });

    it('should reuse existing firehose client', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      await tool.handler({ subscriptionId: 'test-sub-1' });
      const firstClient = (StartStreamingTool as any).firehoseClient;

      await tool.handler({ subscriptionId: 'test-sub-2' });
      const secondClient = (StartStreamingTool as any).firehoseClient;

      expect(firstClient).toBe(secondClient);
    });

    it('should return firehose status', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      const result = await tool.handler({ subscriptionId: 'test-sub' });

      expect(result.firehoseStatus).toBeDefined();
      expect(result.firehoseStatus.connected).toBe(true);
      expect(result.firehoseStatus.lastSeq).toBe(12345);
      expect(typeof result.firehoseStatus.subscriptionCount).toBe('number');
    });
  });
});

describe('StopStreamingTool', () => {
  let mockAtpClient: any;
  let tool: StopStreamingTool;

  beforeEach(() => {
    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue({ service: { toString: () => 'https://bsky.social' } }),
    };

    tool = new StopStreamingTool(mockAtpClient);

    // Reset static properties
    (StartStreamingTool as any).firehoseClient = null;
    (StartStreamingTool as any).eventBuffer = [];
  });

  afterEach(() => {
    (StartStreamingTool as any).firehoseClient = null;
    (StartStreamingTool as any).eventBuffer = [];
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('stop_streaming');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Stop');
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty subscription ID', async () => {
      await expect(tool.handler({ subscriptionId: '' })).rejects.toThrow(ValidationError);
    });
  });

  describe('Stop Streaming', () => {
    it('should stop streaming successfully', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      // Set up a mock firehose client
      const mockFirehoseClient = {
        unsubscribe: vi.fn(),
        isConnected: vi.fn().mockReturnValue(true),
        getLastSeq: vi.fn().mockReturnValue(12345),
      };
      (StartStreamingTool as any).firehoseClient = mockFirehoseClient;

      const result = await tool.handler({ subscriptionId: 'test-subscription' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Stopped streaming');
      expect(result.subscription.id).toBe('test-subscription');
      expect(result.subscription.status).toBe('stopped');
      expect(mockFirehoseClient.unsubscribe).toHaveBeenCalledWith('test-subscription');
    });

    it('should handle no active firehose client', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      const result = await tool.handler({ subscriptionId: 'test-subscription' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('No active firehose client');
      expect(result.subscription.status).toBe('not_found');
    });
  });
});

describe('GetStreamingStatusTool', () => {
  let mockAtpClient: any;
  let tool: GetStreamingStatusTool;

  beforeEach(() => {
    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue({ service: { toString: () => 'https://bsky.social' } }),
    };

    tool = new GetStreamingStatusTool(mockAtpClient);

    // Reset static properties
    (StartStreamingTool as any).firehoseClient = null;
    (StartStreamingTool as any).eventBuffer = [];
  });

  afterEach(() => {
    (StartStreamingTool as any).firehoseClient = null;
    (StartStreamingTool as any).eventBuffer = [];
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('get_streaming_status');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('status');
    });
  });

  describe('Get Streaming Status', () => {
    it('should get status when no client exists', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      const result = await tool.handler({});

      expect(result.success).toBe(true);
      expect(result.firehoseStatus.connected).toBe(false);
      expect(result.firehoseStatus.lastSeq).toBeNull();
      expect(result.firehoseStatus.subscriptionCount).toBe(0);
      expect(result.recentEvents).toEqual([]);
      expect(result.eventBufferSize).toBe(0);
    });

    it('should get status with active client', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      // Set up a mock firehose client
      const mockFirehoseClient = {
        isConnected: vi.fn().mockReturnValue(true),
        getLastSeq: vi.fn().mockReturnValue(54321),
        subscriptions: new Map([
          ['sub1', {}],
          ['sub2', {}],
        ]),
      };
      (StartStreamingTool as any).firehoseClient = mockFirehoseClient;

      // Add some events to buffer
      (StartStreamingTool as any).eventBuffer = [
        {
          type: 'commit',
          seq: 1,
          time: '2024-01-01T00:00:00Z',
          repo: 'did:plc:test',
          commit: { collection: 'app.bsky.feed.post', operation: 'create' },
          receivedAt: '2024-01-01T00:00:01Z',
        },
      ];

      const result = await tool.handler({});

      expect(result.success).toBe(true);
      expect(result.firehoseStatus.connected).toBe(true);
      expect(result.firehoseStatus.lastSeq).toBe(54321);
      expect(result.firehoseStatus.subscriptionCount).toBe(2);
      expect(result.recentEvents).toHaveLength(1);
      expect(result.eventBufferSize).toBe(1);
    });
  });
});

describe('GetRecentEventsTool', () => {
  let mockAtpClient: any;
  let tool: GetRecentEventsTool;

  beforeEach(() => {
    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue({ service: { toString: () => 'https://bsky.social' } }),
    };

    tool = new GetRecentEventsTool(mockAtpClient);

    // Reset static properties
    (StartStreamingTool as any).firehoseClient = null;
    (StartStreamingTool as any).eventBuffer = [];
  });

  afterEach(() => {
    (StartStreamingTool as any).firehoseClient = null;
    (StartStreamingTool as any).eventBuffer = [];
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('get_recent_events');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('recent events');
    });
  });

  describe('Parameter Validation', () => {
    it('should reject limit below 1', async () => {
      await expect(tool.handler({ limit: 0 })).rejects.toThrow(ValidationError);
    });

    it('should reject limit above 100', async () => {
      await expect(tool.handler({ limit: 101 })).rejects.toThrow(ValidationError);
    });

    it('should accept limit at boundaries', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      const result1 = await tool.handler({ limit: 1 });
      expect(result1.success).toBe(true);

      const result2 = await tool.handler({ limit: 100 });
      expect(result2.success).toBe(true);
    });

    it('should default limit to 20', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      // Add 30 events to buffer
      const events = Array.from({ length: 30 }, (_, i) => ({
        type: 'commit',
        seq: i,
        time: '2024-01-01T00:00:00Z',
        repo: 'did:plc:test',
        commit: { collection: 'app.bsky.feed.post', operation: 'create' },
        receivedAt: '2024-01-01T00:00:01Z',
      }));
      (StartStreamingTool as any).eventBuffer = events;

      const result = await tool.handler({});

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(20);
    });
  });

  describe('Get Recent Events', () => {
    it('should get recent events without filter', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      // Add events to buffer
      (StartStreamingTool as any).eventBuffer = [
        {
          type: 'commit',
          seq: 1,
          time: '2024-01-01T00:00:00Z',
          repo: 'did:plc:test1',
          commit: {
            collection: 'app.bsky.feed.post',
            operation: 'create',
            record: { text: 'Hello' },
          },
          receivedAt: '2024-01-01T00:00:01Z',
        },
        {
          type: 'commit',
          seq: 2,
          time: '2024-01-01T00:00:02Z',
          repo: 'did:plc:test2',
          commit: { collection: 'app.bsky.feed.like', operation: 'create', record: {} },
          receivedAt: '2024-01-01T00:00:03Z',
        },
      ];

      const result = await tool.handler({ limit: 10 });

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(2);
      expect(result.totalBuffered).toBe(2);
      expect(result.filtered).toBe(false);
      expect(result.events[0].seq).toBe(1);
      expect(result.events[1].seq).toBe(2);
    });

    it('should filter events by collection', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      // Add events to buffer
      (StartStreamingTool as any).eventBuffer = [
        {
          type: 'commit',
          seq: 1,
          time: '2024-01-01T00:00:00Z',
          repo: 'did:plc:test1',
          commit: { collection: 'app.bsky.feed.post', operation: 'create' },
          receivedAt: '2024-01-01T00:00:01Z',
        },
        {
          type: 'commit',
          seq: 2,
          time: '2024-01-01T00:00:02Z',
          repo: 'did:plc:test2',
          commit: { collection: 'app.bsky.feed.like', operation: 'create' },
          receivedAt: '2024-01-01T00:00:03Z',
        },
        {
          type: 'commit',
          seq: 3,
          time: '2024-01-01T00:00:04Z',
          repo: 'did:plc:test3',
          commit: { collection: 'app.bsky.feed.post', operation: 'create' },
          receivedAt: '2024-01-01T00:00:05Z',
        },
      ];

      const result = await tool.handler({ limit: 10, collection: 'app.bsky.feed.post' });

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(2);
      expect(result.filtered).toBe(true);
      expect(result.events[0].collection).toBe('app.bsky.feed.post');
      expect(result.events[1].collection).toBe('app.bsky.feed.post');
    });

    it('should respect limit parameter', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      // Add 10 events to buffer
      const events = Array.from({ length: 10 }, (_, i) => ({
        type: 'commit',
        seq: i,
        time: '2024-01-01T00:00:00Z',
        repo: 'did:plc:test',
        commit: { collection: 'app.bsky.feed.post', operation: 'create' },
        receivedAt: '2024-01-01T00:00:01Z',
      }));
      (StartStreamingTool as any).eventBuffer = events;

      const result = await tool.handler({ limit: 5 });

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(5);
      expect(result.totalBuffered).toBe(10);
      // Should get the most recent 5 events (seq 5-9)
      expect(result.events[0].seq).toBe(5);
      expect(result.events[4].seq).toBe(9);
    });

    it('should handle empty buffer', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      const result = await tool.handler({ limit: 10 });

      expect(result.success).toBe(true);
      expect(result.events).toEqual([]);
      expect(result.totalBuffered).toBe(0);
      expect(result.filtered).toBe(false);
    });
  });
});
