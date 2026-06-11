/**
 * discover must advertise a FAITHFUL outputSchema: every key the tool actually
 * returns (in both modes) has to be declared, typed, and described — MCP
 * clients validate structuredContent against the advertised schema, so an
 * undeclared-but-returned property or a wrong type is a contract violation.
 *
 * The validator below covers the JSON-Schema subset this project's
 * outputSchemas use (type/object/array/properties/required/items/enum) and is
 * strict about undeclared properties, which is exactly the failure mode this
 * test guards against.
 */

import { describe, expect, it, vi } from 'vitest';
import { DiscoverTool } from '../tools/implementations/discover-tool.js';
import type { AtpClient } from '../utils/atp-client.js';

function validateAgainstSchema(schema: any, value: any, path: string, errors: string[]): void {
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: ${JSON.stringify(value)} not in enum ${JSON.stringify(schema.enum)}`);
  }
  switch (schema.type) {
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push(`${path}: expected object, got ${JSON.stringify(value)}`);
        return;
      }
      const properties = schema.properties ?? {};
      for (const required of schema.required ?? []) {
        if (value[required] === undefined) {
          errors.push(`${path}.${required}: required property missing`);
        }
      }
      for (const [key, entry] of Object.entries(value)) {
        if (entry === undefined) continue;
        const propSchema = properties[key];
        if (!propSchema) {
          errors.push(`${path}.${key}: returned but not declared in outputSchema`);
          continue;
        }
        validateAgainstSchema(propSchema, entry, `${path}.${key}`, errors);
      }
      return;
    }
    case 'array': {
      if (!Array.isArray(value)) {
        errors.push(`${path}: expected array, got ${JSON.stringify(value)}`);
        return;
      }
      if (schema.items) {
        value.forEach((item, i) =>
          validateAgainstSchema(schema.items, item, `${path}[${i}]`, errors)
        );
      }
      return;
    }
    case 'string':
    case 'number':
    case 'boolean': {
      if (typeof value !== schema.type) {
        errors.push(`${path}: expected ${schema.type}, got ${JSON.stringify(value)}`);
      }
      return;
    }
    default:
      // Untyped/freeform schema node — accepts anything (and hides mismatches),
      // which is why the assertions below also require typed declarations.
      return;
  }
}

function timelinePost(i: number, text: string) {
  return {
    post: {
      uri: `at://post-${i}`,
      cid: `cid-${i}`,
      author: { did: `did:plc:a${i}`, handle: `a${i}.test`, displayName: `A${i}` },
      record: { text, createdAt: new Date().toISOString() },
      likeCount: 10 + i,
      replyCount: 4,
      repostCount: 2,
      indexedAt: new Date().toISOString(),
      viewer: {},
    },
  };
}

function mockClient() {
  const getTimeline = vi.fn().mockResolvedValue({
    data: {
      feed: [
        timelinePost(1, 'incredible astronomy photos tonight #space'),
        timelinePost(2, 'more astronomy photos from the telescope #space'),
        timelinePost(3, 'just had lunch'),
      ],
    },
  });
  const agent = { session: { did: 'did:plc:self', handle: 'self.test' }, getTimeline };

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

describe('discover outputSchema fidelity', () => {
  it('mode=trending result validates against the advertised outputSchema', async () => {
    const tool = new DiscoverTool(mockClient());

    const result = await tool.handler({ mode: 'trending' });

    // Non-empty result so the items schemas are actually exercised.
    expect(result.trendingHashtags.length).toBeGreaterThan(0);
    expect(result.trendingTopics.length).toBeGreaterThan(0);
    expect(result.trendingPosts.length).toBeGreaterThan(0);

    const errors: string[] = [];
    validateAgainstSchema(tool.schema.outputSchema, result, '$', errors);
    expect(errors).toEqual([]);
  });

  it('mode=recommended result validates against the advertised outputSchema', async () => {
    const tool = new DiscoverTool(mockClient());

    const result = await tool.handler({ mode: 'recommended' });

    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.insights.length).toBeGreaterThan(0);

    const errors: string[] = [];
    validateAgainstSchema(tool.schema.outputSchema, result, '$', errors);
    expect(errors).toEqual([]);
  });

  it('declares the rich per-mode structures with typed, described properties', () => {
    const tool = new DiscoverTool(mockClient());
    const properties = (tool.schema.outputSchema as any).properties;

    // trending
    expect(properties.trendingHashtags.items.properties.tag.type).toBe('string');
    expect(properties.trendingTopics.items.properties.engagementScore.type).toBe('number');
    expect(properties.trendingPosts.items.properties.author.properties.handle.type).toBe('string');
    expect(properties.summary.properties.timeRange.properties.start.type).toBe('string');
    // recommended
    expect(properties.recommendations.items.properties.recommendationScore.type).toBe('number');
    expect(properties.recommendations.items.properties.recommendationReasons.items.type).toBe(
      'string'
    );
    expect(properties.insights.items.type).toBe('string');

    // Every declared property carries a description (tool-definition quality).
    const missing: string[] = [];
    const walk = (node: any, path: string): void => {
      if (!node || typeof node !== 'object') return;
      for (const [key, prop] of Object.entries<any>(node.properties ?? {})) {
        const p = `${path}.${key}`;
        if (typeof prop.description !== 'string' || prop.description.length === 0) {
          missing.push(p);
        }
        walk(prop, p);
        if (prop.items) walk(prop.items, `${p}[]`);
      }
    };
    walk(tool.schema.outputSchema, '$');
    expect(missing, `outputSchema properties missing description: ${missing.join(', ')}`).toEqual(
      []
    );
  });
});
