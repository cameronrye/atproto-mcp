/**
 * Regression tests: read-only tools that work against the public AppView must be
 * available in unauthenticated mode (ENHANCED), not gated behind auth (PRIVATE).
 * Also covers get_list reporting the list's true size, not just the current page.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GetListTool,
  GetThreadTool,
  GetCustomFeedTool,
} from '../tools/implementations/advanced-social-tools.js';
import { AnalyzeModerationStatusTool } from '../tools/implementations/moderation-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

const unauthClient = {
  isAuthenticated: vi.fn().mockReturnValue(false),
  hasCredentials: vi.fn().mockReturnValue(false),
} as unknown as AtpClient;

describe('read-only tools are available unauthenticated', () => {
  it('get_list is available without authentication', () => {
    expect(new GetListTool(unauthClient).isAvailable()).toBe(true);
  });

  it('get_thread is available without authentication', () => {
    expect(new GetThreadTool(unauthClient).isAvailable()).toBe(true);
  });

  it('get_custom_feed is available without authentication', () => {
    expect(new GetCustomFeedTool(unauthClient).isAvailable()).toBe(true);
  });

  it('analyze_moderation_status is available without authentication', () => {
    expect(new AnalyzeModerationStatusTool(unauthClient).isAvailable()).toBe(true);
  });
});

describe('get_list itemCount reflects the whole list, not the current page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports list.listItemCount rather than items.length', async () => {
    const getList = vi.fn().mockResolvedValue({
      data: {
        list: {
          uri: 'at://did:plc:owner/app.bsky.graph.list/abc',
          name: 'My List',
          description: 'desc',
          purpose: 'app.bsky.graph.defs#curatelist',
          creator: { did: 'did:plc:owner', handle: 'owner.test' },
          listItemCount: 250,
        },
        items: [
          {
            uri: 'at://item/1',
            subject: { did: 'did:plc:a', handle: 'a.test' },
          },
        ],
        cursor: undefined,
      },
    });
    const agent = { getAgent: vi.fn(), app: { bsky: { graph: { getList } } } };

    const client = {
      getAgent: vi.fn().mockReturnValue(agent),
      isAuthenticated: vi.fn().mockReturnValue(false),
      hasCredentials: vi.fn().mockReturnValue(false),
      executePublicRequest: vi.fn().mockImplementation(async (op: () => unknown) => ({
        success: true,
        data: await op(),
      })),
      executeAuthenticatedRequest: vi.fn().mockImplementation(async (op: () => unknown) => ({
        success: true,
        data: await op(),
      })),
    } as unknown as AtpClient;

    const tool = new GetListTool(client);
    const result = await tool.handler({ listUri: 'at://did:plc:owner/app.bsky.graph.list/abc' });

    expect(result.list.itemCount).toBe(250);
  });
});
