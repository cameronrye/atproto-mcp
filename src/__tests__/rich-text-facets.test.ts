/**
 * Regression test: create_post must validate caller-supplied facets and build
 * quote (record) embeds. Byte offsets that exceed the text's UTF-8 length produce
 * mis-aligned (or server-rejected) facets, and a mention must reference a DID — a
 * bare handle yields an invalid mention facet, so handles are resolved to DIDs.
 *
 * These assertions were migrated from the now-removed create_rich_text_post tool,
 * which folded its facet + quote-embed capabilities into create_post.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreatePostTool } from '../tools/implementations/create-post-tool.js';
import { ValidationError } from '../types/index.js';
import type { AtpClient } from '../utils/atp-client.js';

function mockClient() {
  const post = vi
    .fn()
    .mockResolvedValue({ uri: 'at://did:plc:self/app.bsky.feed.post/x', cid: 'bafyreiabc' });
  const resolveHandle = vi.fn().mockResolvedValue({ data: { did: 'did:plc:bob' } });
  const agent = {
    post,
    com: { atproto: { identity: { resolveHandle } } },
    session: { did: 'did:plc:self' },
  };
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
  return { client, post, resolveHandle };
}

describe('create_post explicit facets', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a facet whose byteEnd exceeds the text byte length', async () => {
    const { client, post } = mockClient();
    const tool = new CreatePostTool(client);

    await expect(
      tool.handler({
        text: 'hello', // 5 bytes
        facets: [
          {
            index: { byteStart: 0, byteEnd: 99 },
            features: [{ type: 'link', value: 'https://x.com' }],
          },
        ],
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(post).not.toHaveBeenCalled();
  });

  it('enforces the 300-grapheme post limit on the explicit-facets path', async () => {
    const { client, post } = mockClient();
    const tool = new CreatePostTool(client);

    await expect(
      tool.handler({
        text: 'a'.repeat(301), // 301 graphemes — over the 300 limit
        facets: [
          {
            index: { byteStart: 0, byteEnd: 5 },
            features: [{ type: 'link', value: 'https://x.com' }],
          },
        ],
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects a facet whose byteStart is not before byteEnd', async () => {
    const { client, post } = mockClient();
    const tool = new CreatePostTool(client);

    await expect(
      tool.handler({
        text: 'hello',
        facets: [
          {
            index: { byteStart: 3, byteEnd: 3 },
            features: [{ type: 'link', value: 'https://x.com' }],
          },
        ],
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(post).not.toHaveBeenCalled();
  });

  it('resolves a mention handle to a DID in the facet record', async () => {
    const { client, post, resolveHandle } = mockClient();
    const tool = new CreatePostTool(client);

    await tool.handler({
      text: 'hi @bob',
      facets: [
        { index: { byteStart: 3, byteEnd: 7 }, features: [{ type: 'mention', value: 'bob.test' }] },
      ],
    });

    expect(resolveHandle).toHaveBeenCalledWith({ handle: 'bob.test' });
    const record = post.mock.calls[0]![0] as {
      facets: Array<{ features: Array<{ did?: string }> }>;
    };
    expect(record.facets[0]!.features[0]!.did).toBe('did:plc:bob');
  });

  it('maps a link facet to the on-the-wire app.bsky.richtext.facet#link shape', async () => {
    const { client, post } = mockClient();
    const tool = new CreatePostTool(client);

    const text = 'see https://example.com';
    await tool.handler({
      text,
      facets: [
        {
          index: { byteStart: 4, byteEnd: 23 },
          features: [{ type: 'link', value: 'https://example.com' }],
        },
      ],
    });

    const record = post.mock.calls[0]![0];
    expect(record.text).toBe(text);
    expect(Array.isArray(record.facets)).toBe(true);
    expect(record.facets).toHaveLength(1);
    expect(record.facets[0].features[0]).toEqual({
      $type: 'app.bsky.richtext.facet#link',
      uri: 'https://example.com',
    });
    expect(record.facets[0].index).toEqual({ byteStart: 4, byteEnd: 23 });
  });

  it('uses caller-supplied facets verbatim instead of auto-detecting from the text', async () => {
    const { client, post } = mockClient();
    const tool = new CreatePostTool(client);

    // Text contains a hashtag that auto-detection would normally pick up, but the
    // caller supplied an explicit (single link) facet set, which must win.
    await tool.handler({
      text: 'visit #here',
      facets: [
        {
          index: { byteStart: 0, byteEnd: 5 },
          features: [{ type: 'link', value: 'https://x.com' }],
        },
      ],
    });

    const record = post.mock.calls[0]![0];
    expect(record.facets).toHaveLength(1);
    expect(record.facets[0].features[0]).toEqual({
      $type: 'app.bsky.richtext.facet#link',
      uri: 'https://x.com',
    });
  });
});

describe('create_post quote (record) embed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('builds an app.bsky.embed.record embed from a quote reference', async () => {
    const { client, post } = mockClient();
    const tool = new CreatePostTool(client);

    await tool.handler({
      text: 'quoting this',
      quote: { uri: 'at://did:plc:other/app.bsky.feed.post/x', cid: 'cidx' },
    });

    const record = post.mock.calls[0]![0];
    expect(record.embed).toEqual({
      $type: 'app.bsky.embed.record',
      record: { uri: 'at://did:plc:other/app.bsky.feed.post/x', cid: 'cidx' },
    });
  });
});

describe('create_post embed union (images XOR external XOR quote)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects combining images and a quote embed', async () => {
    const { client, post } = mockClient();
    const tool = new CreatePostTool(client);

    await expect(
      tool.handler({
        text: 'both',
        embed: { images: [{ alt: 'x', image: new Blob(['x']) }] },
        quote: { uri: 'at://did:plc:other/app.bsky.feed.post/x', cid: 'cidx' },
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects combining an external link and a quote embed', async () => {
    const { client, post } = mockClient();
    const tool = new CreatePostTool(client);

    await expect(
      tool.handler({
        text: 'both',
        embed: {
          external: { uri: 'https://x.com', title: 't', description: 'd' },
        },
        quote: { uri: 'at://did:plc:other/app.bsky.feed.post/x', cid: 'cidx' },
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects combining images and an external link', async () => {
    const { client, post } = mockClient();
    const tool = new CreatePostTool(client);

    await expect(
      tool.handler({
        text: 'both',
        embed: {
          images: [{ alt: 'x', image: new Blob(['x']) }],
          external: { uri: 'https://x.com', title: 't', description: 'd' },
        },
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(post).not.toHaveBeenCalled();
  });
});
