/**
 * Tests for streaming intelligence tools
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MonitorKeywordsTool,
  TrackUsersTool,
  StartStreamingTool,
} from '../tools/implementations/streaming-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

// Mock AtpClient
const createMockAtpClient = () => {
  const mockAgent = {
    service: { toString: () => 'https://bsky.social' },
  };

  return {
    getAgent: vi.fn().mockReturnValue(mockAgent),
    isAuthenticated: vi.fn().mockReturnValue(true),
  } as unknown as AtpClient;
};

describe('MonitorKeywordsTool', () => {
  let tool: MonitorKeywordsTool;
  let mockClient: AtpClient;

  beforeEach(() => {
    mockClient = createMockAtpClient();
    tool = new MonitorKeywordsTool(mockClient);

    // Clear event buffer and populate with test data
    StartStreamingTool.eventBuffer = [
      {
        type: 'commit',
        seq: 1,
        time: '2024-01-01T00:00:00Z',
        repo: 'did:plc:user1',
        commit: {
          collection: 'app.bsky.feed.post',
          operation: 'create',
          rkey: 'post1',
          record: {
            text: 'Hello world! This is a test post about AI.',
            createdAt: '2024-01-01T00:00:00Z',
          },
        },
        receivedAt: '2024-01-01T00:00:01Z',
      },
      {
        type: 'commit',
        seq: 2,
        time: '2024-01-01T00:01:00Z',
        repo: 'did:plc:user2',
        commit: {
          collection: 'app.bsky.feed.post',
          operation: 'create',
          rkey: 'post2',
          record: {
            text: 'Machine learning is fascinating!',
            createdAt: '2024-01-01T00:01:00Z',
          },
        },
        receivedAt: '2024-01-01T00:01:01Z',
      },
      {
        type: 'commit',
        seq: 3,
        time: '2024-01-01T00:02:00Z',
        repo: 'did:plc:user3',
        commit: {
          collection: 'app.bsky.feed.post',
          operation: 'create',
          rkey: 'post3',
          record: {
            text: 'Just had a great coffee!',
            createdAt: '2024-01-01T00:02:00Z',
          },
        },
        receivedAt: '2024-01-01T00:02:01Z',
      },
    ];
  });

  afterEach(() => {
    StartStreamingTool.eventBuffer = [];
  });

  it('should find posts matching keywords (case insensitive)', async () => {
    const result = await tool.handler({
      keywords: ['AI', 'machine learning'],
      limit: 10,
      caseSensitive: false,
    });

    expect(result.success).toBe(true);
    expect(result.matches).toHaveLength(2);
    expect(result.totalMatches).toBe(2);
    expect(result.matches[0].post.text).toContain('AI');
    expect(result.matches[1].post.text).toContain('learning');
  });

  it('should respect case sensitivity', async () => {
    const result = await tool.handler({
      keywords: ['ai'], // lowercase
      limit: 10,
      caseSensitive: true,
    });

    expect(result.success).toBe(true);
    expect(result.matches).toHaveLength(0); // Should not match 'AI' in uppercase
  });

  it('should limit results correctly', async () => {
    const result = await tool.handler({
      keywords: ['a'], // Very common letter
      limit: 1,
      caseSensitive: false,
    });

    expect(result.success).toBe(true);
    expect(result.matches.length).toBeLessThanOrEqual(1);
  });

  it('should return empty results when no matches found', async () => {
    const result = await tool.handler({
      keywords: ['nonexistent keyword xyz'],
      limit: 10,
      caseSensitive: false,
    });

    expect(result.success).toBe(true);
    expect(result.matches).toHaveLength(0);
    expect(result.totalMatches).toBe(0);
  });

  it('should require at least one keyword', async () => {
    await expect(tool.handler({ keywords: [], limit: 10 })).rejects.toThrow();
  });
});

describe('TrackUsersTool', () => {
  let tool: TrackUsersTool;
  let mockClient: AtpClient;

  beforeEach(() => {
    mockClient = createMockAtpClient();
    tool = new TrackUsersTool(mockClient);

    // Clear event buffer and populate with test data
    StartStreamingTool.eventBuffer = [
      {
        type: 'commit',
        seq: 1,
        time: '2024-01-01T00:00:00Z',
        repo: 'did:plc:alice',
        commit: {
          collection: 'app.bsky.feed.post',
          operation: 'create',
          rkey: 'post1',
          record: { text: 'Alice post', createdAt: '2024-01-01T00:00:00Z' },
        },
        receivedAt: '2024-01-01T00:00:01Z',
      },
      {
        type: 'commit',
        seq: 2,
        time: '2024-01-01T00:01:00Z',
        repo: 'did:plc:bob',
        commit: {
          collection: 'app.bsky.feed.like',
          operation: 'create',
          rkey: 'like1',
          record: {},
        },
        receivedAt: '2024-01-01T00:01:01Z',
      },
    ];
  });

  afterEach(() => {
    StartStreamingTool.eventBuffer = [];
  });

  it('should track posts from specific users', async () => {
    const result = await tool.handler({
      users: ['did:plc:alice'],
      limit: 10,
      eventTypes: ['post'],
    });

    expect(result.success).toBe(true);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].user).toBe('did:plc:alice');
    expect(result.events[0].eventType).toBe('post');
  });

  it('should track multiple event types', async () => {
    const result = await tool.handler({
      users: ['did:plc:alice', 'did:plc:bob'],
      limit: 10,
      eventTypes: ['post', 'like'],
    });

    expect(result.success).toBe(true);
    expect(result.events).toHaveLength(2);
  });

  it('should filter by user correctly', async () => {
    const result = await tool.handler({
      users: ['did:plc:alice'],
      limit: 10,
      eventTypes: ['post', 'like'],
    });

    expect(result.success).toBe(true);
    expect(result.events).toHaveLength(1);
    expect(result.events.every((e: any) => e.user === 'did:plc:alice')).toBe(true);
  });

  it('should require at least one user', async () => {
    await expect(tool.handler({ users: [], limit: 10 })).rejects.toThrow();
  });
});
