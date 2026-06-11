/**
 * Behavioral tests for analyze_account dimension:'engagement' (previously the
 * standalone analyze_engagement tool, ~3% covered):
 * - media detection must recognize video / recordWithMedia embeds (not just images)
 * - an empty author feed must not emit Infinity/-Infinity for optimalTextLength
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyzeAccountTool } from '../tools/implementations/analyze-account-tool.js';
import type { AtpClient } from '../utils/atp-client.js';

const SELF = 'did:plc:self';

function mockClient(feed: unknown[]) {
  const getAuthorFeed = vi.fn().mockResolvedValue({ data: { feed } });
  const agent = { getAuthorFeed, session: { did: SELF } };
  const client = {
    getAgent: vi.fn().mockReturnValue(agent),
    isAuthenticated: vi.fn().mockReturnValue(true),
    hasCredentials: vi.fn().mockReturnValue(true),
    executeAuthenticatedRequest: vi.fn().mockImplementation(async (op: () => unknown) => {
      try {
        return { success: true, data: await op() };
      } catch (error) {
        return { success: false, error };
      }
    }),
  } as unknown as AtpClient;
  return { client, getAuthorFeed };
}

function postItem(embed: unknown, extra: Record<string, unknown> = {}) {
  return {
    post: {
      uri: `at://${SELF}/app.bsky.feed.post/1`,
      cid: 'cid1',
      record: { text: 'hello world', createdAt: '2026-01-01T00:00:00.000Z' },
      likeCount: 10,
      repostCount: 2,
      replyCount: 1,
      embed,
      ...extra,
    },
  };
}

/**
 * Minimal JSON-Schema checker covering exactly the constructs the
 * analyze_account outputSchema literal uses (type, properties, required,
 * items, enum, anyOf). Returns a list of human-readable violations.
 */
function schemaViolations(schema: any, value: unknown, path = '$'): string[] {
  const errors: string[] = [];
  if (Array.isArray(schema.anyOf)) {
    const branches: string[][] = schema.anyOf.map((branch: any) =>
      schemaViolations(branch, value, path)
    );
    if (!branches.some(branchErrors => branchErrors.length === 0)) {
      errors.push(`${path}: matched no anyOf branch (${branches.map(b => b[0]).join(' | ')})`);
    }
    return errors;
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push(`${path}: ${JSON.stringify(value)} not in enum ${JSON.stringify(schema.enum)}`);
  }
  switch (schema.type) {
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push(`${path}: expected object, got ${JSON.stringify(value)}`);
        break;
      }
      const record = value as Record<string, unknown>;
      for (const key of schema.required ?? []) {
        if (record[key] === undefined) {
          errors.push(`${path}.${key}: missing required property`);
        }
      }
      for (const [key, propValue] of Object.entries(record)) {
        const propSchema = schema.properties?.[key];
        if (propSchema && propValue !== undefined) {
          errors.push(...schemaViolations(propSchema, propValue, `${path}.${key}`));
        }
      }
      break;
    }
    case 'array': {
      if (!Array.isArray(value)) {
        errors.push(`${path}: expected array, got ${JSON.stringify(value)}`);
        break;
      }
      if (schema.items) {
        value.forEach((entry, index) =>
          errors.push(...schemaViolations(schema.items, entry, `${path}[${index}]`))
        );
      }
      break;
    }
    case 'string':
      if (typeof value !== 'string') errors.push(`${path}: expected string`);
      break;
    case 'number':
      if (typeof value !== 'number') errors.push(`${path}: expected number`);
      break;
    case 'boolean':
      if (typeof value !== 'boolean') errors.push(`${path}: expected boolean`);
      break;
    default:
      // No type constraint: accepts anything.
      break;
  }
  return errors;
}

describe('analyze_account outputSchema contract', () => {
  beforeEach(() => vi.clearAllMocks());

  const feedItem = (rkey: string, text: string, embed?: unknown) => ({
    post: {
      uri: `at://${SELF}/app.bsky.feed.post/${rkey}`,
      cid: `cid-${rkey}`,
      record: { text, createdAt: '2026-01-01T00:00:00.000Z' },
      indexedAt: '2026-01-01T00:00:00.000Z',
      likeCount: 4,
      repostCount: 2,
      replyCount: 1,
      ...(embed !== undefined && { embed }),
    },
  });

  const richFeed = [
    feedItem('1', 'hello #bsky world https://example.com'),
    feedItem('2', 'media post #bsky', { $type: 'app.bsky.embed.images#view', images: [{}] }),
    feedItem('3', 'plain words only here'),
  ];

  function networkClient() {
    const followers = [
      { did: 'did:plc:f1', handle: 'f1.test' },
      { did: 'did:plc:f2', handle: 'f2.test' },
    ];
    const follows = [{ did: 'did:plc:f1', handle: 'f1.test' }];
    const agent = {
      session: { did: SELF },
      getProfile: vi.fn().mockResolvedValue({
        data: { did: SELF, handle: 'self.test', followersCount: 2, followsCount: 1, postsCount: 9 },
      }),
      getFollowers: vi.fn().mockResolvedValue({ data: { followers } }),
      getFollows: vi.fn().mockResolvedValue({ data: { follows } }),
      getProfiles: vi.fn().mockImplementation(async ({ actors }: { actors: string[] }) => ({
        data: {
          profiles: actors.map(did => ({
            did,
            handle: `${did.replace('did:plc:', '')}.test`,
            displayName: 'F',
            followersCount: 5,
          })),
        },
      })),
    };
    return {
      getAgent: vi.fn().mockReturnValue(agent),
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executeAuthenticatedRequest: vi.fn().mockImplementation(async (op: () => unknown) => {
        try {
          return { success: true, data: await op() };
        } catch (error) {
          return { success: false, error };
        }
      }),
    } as unknown as AtpClient;
  }

  async function dimensionResult(dimension: 'engagement' | 'network' | 'strategy') {
    if (dimension === 'network') {
      const tool = new AnalyzeAccountTool(networkClient());
      return await tool.handler({ dimension, actor: 'self.test' });
    }
    const { client } = mockClient(richFeed);
    const tool = new AnalyzeAccountTool(client);
    return await tool.handler(
      dimension === 'strategy' ? { dimension, actor: SELF } : { dimension }
    );
  }

  it.each(['engagement', 'network', 'strategy'] as const)(
    'describes every top-level key the %s dimension returns',
    async dimension => {
      const result = await dimensionResult(dimension);
      const tool = new AnalyzeAccountTool(mockClient(richFeed).client);
      const properties = (tool.schema.outputSchema as any).properties as Record<string, unknown>;

      for (const key of Object.keys(result)) {
        expect(
          properties,
          `outputSchema must describe top-level key '${key}' (${dimension})`
        ).toHaveProperty(key);
      }
    }
  );

  it.each(['engagement', 'network', 'strategy'] as const)(
    'the %s dimension result validates against the outputSchema literal',
    async dimension => {
      const result = await dimensionResult(dimension);
      const tool = new AnalyzeAccountTool(mockClient(richFeed).client);

      expect(schemaViolations(tool.schema.outputSchema, result)).toEqual([]);
    }
  );
});

describe("analyze_account dimension:'engagement'", () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects a video embed as media', async () => {
    const { client } = mockClient([
      postItem({ $type: 'app.bsky.embed.video#view', cid: 'v', playlist: 'p.m3u8' }),
    ]);
    const tool = new AnalyzeAccountTool(client);

    const result = await tool.handler({ dimension: 'engagement' });

    expect(result.dimension).toBe('engagement');
    expect(result.topPosts[0]?.hasMedia).toBe(true);
  });

  it('detects recordWithMedia (quote + image) as media', async () => {
    const { client } = mockClient([
      postItem({
        $type: 'app.bsky.embed.recordWithMedia#view',
        record: {},
        media: { $type: 'app.bsky.embed.images#view', images: [{}] },
      }),
    ]);
    const tool = new AnalyzeAccountTool(client);

    const result = await tool.handler({ dimension: 'engagement' });

    expect(result.topPosts[0]?.hasMedia).toBe(true);
  });

  it('floors the engagement-rate age at 24h so sub-hour posts do not dominate', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
    try {
      const item = (rkey: string, createdAt: string, likeCount: number) => ({
        post: {
          uri: `at://${SELF}/app.bsky.feed.post/${rkey}`,
          cid: `cid-${rkey}`,
          record: { text: `post ${rkey}`, createdAt },
          likeCount,
          repostCount: 0,
          replyCount: 0,
        },
      });
      const { client } = mockClient([
        // 30 minutes old with 6 likes: raw per-hour rate would be 12/h.
        item('fresh', '2026-06-01T11:30:00.000Z', 6),
        // 30 days (720h) old with 720 likes: true rate 1/h.
        item('old', '2026-05-02T12:00:00.000Z', 720),
      ]);
      const tool = new AnalyzeAccountTool(client);

      const result = await tool.handler({ dimension: 'engagement' });

      const byUri = new Map<string, { engagementRate: number }>(
        result.topPosts.map((p: { uri: string; engagementRate: number }) => [p.uri, p])
      );
      // The fresh post's age denominator is floored at 24h (6/24), not 0.5h (12).
      expect(byUri.get(`at://${SELF}/app.bsky.feed.post/fresh`)?.engagementRate).toBeCloseTo(
        6 / 24
      );
      // Posts older than 24h keep their true age denominator.
      expect(byUri.get(`at://${SELF}/app.bsky.feed.post/old`)?.engagementRate).toBeCloseTo(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns finite optimalTextLength for an empty feed (no Infinity)', async () => {
    const { client } = mockClient([]);
    const tool = new AnalyzeAccountTool(client);

    const result = await tool.handler({ dimension: 'engagement' });

    expect(result.success).toBe(true);
    expect(result.dimension).toBe('engagement');
    expect(result.summary.totalPosts).toBe(0);
    expect(Number.isFinite(result.insights.optimalTextLength.min)).toBe(true);
    expect(Number.isFinite(result.insights.optimalTextLength.max)).toBe(true);
  });
});
