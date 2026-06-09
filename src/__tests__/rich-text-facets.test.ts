/**
 * Regression test: create_rich_text_post must validate caller-supplied facets.
 * Byte offsets that exceed the text's UTF-8 length produce mis-aligned (or
 * server-rejected) facets, and a mention must reference a DID — a bare handle
 * yields an invalid mention facet, so handles are resolved to DIDs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateRichTextPostTool } from '../tools/implementations/media-tools.js';
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

describe('create_rich_text_post facet validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a facet whose byteEnd exceeds the text byte length', async () => {
    const { client, post } = mockClient();
    const tool = new CreateRichTextPostTool(client);

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

  it('rejects a facet whose byteStart is not before byteEnd', async () => {
    const { client, post } = mockClient();
    const tool = new CreateRichTextPostTool(client);

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
    const tool = new CreateRichTextPostTool(client);

    await tool.handler({
      text: 'hi @bob',
      facets: [
        { index: { byteStart: 3, byteEnd: 7 }, features: [{ type: 'mention', value: 'bob.test' }] },
      ],
    });

    expect(resolveHandle).toHaveBeenCalledWith({ handle: 'bob.test' });
    const record = post.mock.calls[0][0] as {
      facets: Array<{ features: Array<{ did?: string }> }>;
    };
    expect(record.facets[0].features[0].did).toBe('did:plc:bob');
  });
});
