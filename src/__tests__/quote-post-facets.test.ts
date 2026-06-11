/**
 * Regression test: quote posts must run richtext facet detection so links,
 * @mentions and #hashtags in the quote text are real facets (clickable / resolved)
 * rather than inert plain text. Regular posts already do this via buildRichText;
 * the quote-post path previously skipped it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepostTool } from '../tools/implementations/repost-tool.js';
import type { AtpClient } from '../utils/atp-client.js';

function mockClient() {
  const post = vi.fn().mockResolvedValue({ uri: 'at://quote', cid: 'cidquote' });
  const agent = { post, session: { did: 'did:plc:self' } };

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

  return { client, post };
}

describe('quote post facet detection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('attaches detected facets (e.g. a link) to the quote post record', async () => {
    const { client, post } = mockClient();
    const tool = new RepostTool(client);

    await tool.handler({
      uri: 'at://did:plc:author/app.bsky.feed.post/1',
      cid: 'bafyreiabc123',
      text: 'check https://example.com now',
    });

    expect(post).toHaveBeenCalledTimes(1);
    const record = post.mock.calls[0]![0] as { text: string; facets?: unknown[]; embed?: any };
    expect(Array.isArray(record.facets)).toBe(true);
    expect(record.facets!.length).toBeGreaterThan(0);
    // The embedded quote is still present.
    expect(record.embed?.$type).toBe('app.bsky.embed.record');
  });
});
