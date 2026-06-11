/**
 * Tests for the Bluesky direct-message tools (chat.bsky.convo via the
 * did:web:api.bsky.chat service proxy).
 *
 * - list_conversations: chat.bsky.convo.listConvos with cursor/limit/status.
 * - get_conversation_messages: chat.bsky.convo.getMessages, optionally marking
 *   the conversation read via chat.bsky.convo.updateRead (default: read-only).
 * - send_direct_message: chat.bsky.convo.sendMessage to a convoId, or to a
 *   member handle/DID resolved through chat.bsky.convo.getConvoForMembers.
 *
 * All chat calls must go through agent.withProxy('bsky_chat',
 * 'did:web:api.bsky.chat') — the chat service is NOT served by the PDS.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GetConversationMessagesTool,
  ListConversationsTool,
  SendDirectMessageTool,
} from '../tools/implementations/dm-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

const selfMember = { did: 'did:plc:self', handle: 'self.bsky.social', displayName: 'Self' };
const bobMember = { did: 'did:plc:bob', handle: 'bob.bsky.social', displayName: 'Bob' };

const sampleConvo = {
  id: 'convo123',
  rev: 'rev9',
  members: [selfMember, bobMember],
  muted: false,
  status: 'accepted',
  unreadCount: 2,
  lastMessage: {
    $type: 'chat.bsky.convo.defs#messageView',
    id: 'msg9',
    rev: 'rev9',
    text: 'hello there',
    sender: { did: 'did:plc:bob' },
    sentAt: '2026-06-01T00:00:00.000Z',
  },
};

function mockClient(options: { authenticated?: boolean } = {}) {
  const authenticated = options.authenticated ?? true;

  const listConvos = vi.fn().mockResolvedValue({ data: { convos: [], cursor: undefined } });
  const getMessages = vi.fn().mockResolvedValue({ data: { messages: [], cursor: undefined } });
  const updateRead = vi.fn().mockResolvedValue({ data: { convo: sampleConvo } });
  const getConvoForMembers = vi.fn().mockResolvedValue({ data: { convo: sampleConvo } });
  const sendMessage = vi.fn().mockResolvedValue({
    data: {
      id: 'msgNew',
      rev: 'rev10',
      text: 'hi bob',
      sender: { did: 'did:plc:self' },
      sentAt: '2026-06-02T00:00:00.000Z',
    },
  });
  const resolveHandle = vi.fn().mockResolvedValue({ data: { did: 'did:plc:bob' } });

  // The proxied agent the chat namespace must be called on.
  const chatAgent = {
    chat: {
      bsky: { convo: { listConvos, getMessages, updateRead, getConvoForMembers, sendMessage } },
    },
  };
  const withProxy = vi.fn().mockReturnValue(chatAgent);
  const agent = {
    withProxy,
    com: { atproto: { identity: { resolveHandle } } },
    session: { did: 'did:plc:self' },
  };

  const client = {
    getAgent: vi.fn().mockReturnValue(agent),
    isAuthenticated: vi.fn().mockReturnValue(authenticated),
    hasCredentials: vi.fn().mockReturnValue(authenticated),
    executeAuthenticatedRequest: vi.fn().mockImplementation(async (op: () => unknown) => {
      try {
        return { success: true, data: await op() };
      } catch (error) {
        return { success: false, error };
      }
    }),
  } as unknown as AtpClient;

  return {
    client,
    withProxy,
    listConvos,
    getMessages,
    updateRead,
    getConvoForMembers,
    sendMessage,
    resolveHandle,
  };
}

describe('list_conversations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('proxies to the chat service and returns mapped conversations + cursor', async () => {
    const { client, withProxy, listConvos } = mockClient();
    listConvos.mockResolvedValueOnce({ data: { convos: [sampleConvo], cursor: 'nextPage' } });
    const tool = new ListConversationsTool(client);

    const result = await tool.handler({ limit: 25 });

    expect(withProxy).toHaveBeenCalledWith('bsky_chat', 'did:web:api.bsky.chat');
    expect(listConvos).toHaveBeenCalledWith({ limit: 25, cursor: undefined, status: undefined });

    expect(result.success).toBe(true);
    expect(result.conversations).toHaveLength(1);
    expect(result.conversations[0]).toMatchObject({
      id: 'convo123',
      unreadCount: 2,
      muted: false,
      status: 'accepted',
    });
    expect(result.conversations[0].members).toEqual([
      { did: 'did:plc:self', handle: 'self.bsky.social', displayName: 'Self' },
      { did: 'did:plc:bob', handle: 'bob.bsky.social', displayName: 'Bob' },
    ]);
    expect(result.conversations[0].lastMessage).toMatchObject({
      id: 'msg9',
      senderDid: 'did:plc:bob',
      text: 'hello there',
      sentAt: '2026-06-01T00:00:00.000Z',
      deleted: false,
      hasEmbed: false,
    });
    expect(result.cursor).toBe('nextPage');
    expect(result.hasMore).toBe(true);
  });

  it('maps a deleted last message without text and reports no further pages', async () => {
    const { client, listConvos } = mockClient();
    listConvos.mockResolvedValueOnce({
      data: {
        convos: [
          {
            ...sampleConvo,
            status: undefined,
            lastMessage: {
              $type: 'chat.bsky.convo.defs#deletedMessageView',
              id: 'msgGone',
              rev: 'rev9',
              sender: { did: 'did:plc:bob' },
              sentAt: '2026-06-01T00:00:00.000Z',
            },
          },
        ],
        cursor: undefined,
      },
    });
    const tool = new ListConversationsTool(client);

    const result = await tool.handler({});

    expect(result.conversations[0].lastMessage.deleted).toBe(true);
    expect(result.conversations[0].lastMessage).not.toHaveProperty('text');
    expect(result.conversations[0]).not.toHaveProperty('status');
    expect(result.cursor).toBeUndefined();
    expect(result.hasMore).toBe(false);
  });

  it('passes the status filter through to listConvos', async () => {
    const { client, listConvos } = mockClient();
    const tool = new ListConversationsTool(client);

    await tool.handler({ status: 'request' });

    expect(listConvos).toHaveBeenCalledWith({ limit: 50, cursor: undefined, status: 'request' });
  });

  it('is unavailable without authentication and the error mentions DM app-password access', async () => {
    const { client } = mockClient({ authenticated: false });
    const tool = new ListConversationsTool(client);

    expect(tool.isAvailable()).toBe(false);
    await expect(tool.handler({})).rejects.toThrow(/direct messages/i);
    await expect(tool.handler({})).rejects.toThrow(/app password/i);
  });
});

describe('get_conversation_messages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns mapped messages and does NOT mark the conversation read by default', async () => {
    const { client, getMessages, updateRead } = mockClient();
    getMessages.mockResolvedValueOnce({
      data: {
        messages: [
          {
            $type: 'chat.bsky.convo.defs#messageView',
            id: 'msg2',
            rev: 'rev2',
            text: 'check this post',
            embed: { $type: 'app.bsky.embed.record#view', record: {} },
            sender: { did: 'did:plc:bob' },
            sentAt: '2026-06-01T01:00:00.000Z',
          },
          {
            $type: 'chat.bsky.convo.defs#deletedMessageView',
            id: 'msg1',
            rev: 'rev1',
            sender: { did: 'did:plc:self' },
            sentAt: '2026-06-01T00:30:00.000Z',
          },
        ],
        cursor: 'olderPage',
      },
    });
    const tool = new GetConversationMessagesTool(client);

    const result = await tool.handler({ convoId: 'convo123', limit: 30 });

    expect(getMessages).toHaveBeenCalledWith({ convoId: 'convo123', limit: 30, cursor: undefined });
    expect(updateRead).not.toHaveBeenCalled();

    expect(result.success).toBe(true);
    expect(result.convoId).toBe('convo123');
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({
      id: 'msg2',
      senderDid: 'did:plc:bob',
      text: 'check this post',
      sentAt: '2026-06-01T01:00:00.000Z',
      deleted: false,
      hasEmbed: true,
    });
    expect(result.messages[1]).toMatchObject({
      id: 'msg1',
      senderDid: 'did:plc:self',
      deleted: true,
      hasEmbed: false,
    });
    expect(result.messages[1]).not.toHaveProperty('text');
    expect(result.cursor).toBe('olderPage');
    expect(result.hasMore).toBe(true);
    expect(result.markedRead).toBe(false);
  });

  it('marks the conversation read when markRead is true', async () => {
    const { client, updateRead } = mockClient();
    const tool = new GetConversationMessagesTool(client);

    const result = await tool.handler({ convoId: 'convo123', markRead: true });

    expect(updateRead).toHaveBeenCalledWith({ convoId: 'convo123' });
    expect(result.markedRead).toBe(true);
  });

  it('rejects an empty convoId', async () => {
    const { client } = mockClient();
    const tool = new GetConversationMessagesTool(client);

    await expect(tool.handler({ convoId: '' })).rejects.toThrow(/convoId/i);
  });
});

describe('send_direct_message', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends into an existing conversation by convoId', async () => {
    const { client, sendMessage, getConvoForMembers, resolveHandle } = mockClient();
    const tool = new SendDirectMessageTool(client);

    const result = await tool.handler({ convoId: 'convo123', text: 'hi bob' });

    expect(sendMessage).toHaveBeenCalledWith({
      convoId: 'convo123',
      message: { text: 'hi bob' },
    });
    expect(getConvoForMembers).not.toHaveBeenCalled();
    expect(resolveHandle).not.toHaveBeenCalled();

    expect(result.success).toBe(true);
    expect(result.convoId).toBe('convo123');
    expect(result.sentMessage).toMatchObject({
      id: 'msgNew',
      text: 'hi bob',
      senderDid: 'did:plc:self',
      sentAt: '2026-06-02T00:00:00.000Z',
    });
  });

  it('resolves a member handle to a conversation via getConvoForMembers', async () => {
    const { client, sendMessage, getConvoForMembers, resolveHandle } = mockClient();
    const tool = new SendDirectMessageTool(client);

    const result = await tool.handler({ member: 'bob.bsky.social', text: 'hi bob' });

    expect(resolveHandle).toHaveBeenCalledWith({ handle: 'bob.bsky.social' });
    expect(getConvoForMembers).toHaveBeenCalledWith({ members: ['did:plc:bob'] });
    expect(sendMessage).toHaveBeenCalledWith({
      convoId: 'convo123',
      message: { text: 'hi bob' },
    });
    expect(result.convoId).toBe('convo123');
    expect(result.recipientDid).toBe('did:plc:bob');
  });

  it('skips handle resolution when member is already a DID', async () => {
    const { client, getConvoForMembers, resolveHandle } = mockClient();
    const tool = new SendDirectMessageTool(client);

    await tool.handler({ member: 'did:plc:bob', text: 'hi bob' });

    expect(resolveHandle).not.toHaveBeenCalled();
    expect(getConvoForMembers).toHaveBeenCalledWith({ members: ['did:plc:bob'] });
  });

  it('rejects when both convoId and member are provided, or neither', async () => {
    const { client } = mockClient();
    const tool = new SendDirectMessageTool(client);

    await expect(
      tool.handler({ convoId: 'convo123', member: 'bob.bsky.social', text: 'hi' })
    ).rejects.toThrow(/exactly one of convoId or member/i);
    await expect(tool.handler({ text: 'hi' })).rejects.toThrow(/exactly one of convoId or member/i);
  });

  it('enforces the 1000-grapheme chat message limit', async () => {
    const { client, sendMessage } = mockClient();
    const tool = new SendDirectMessageTool(client);

    await expect(tool.handler({ convoId: 'convo123', text: 'a'.repeat(1001) })).rejects.toThrow(
      /1000/
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('enforces the 10000-byte chat message limit for grapheme-dense text', async () => {
    const { client, sendMessage } = mockClient();
    const tool = new SendDirectMessageTool(client);

    // 500 family emoji = 500 graphemes (within 1000) but 12,500 UTF-8 bytes.
    await expect(tool.handler({ convoId: 'convo123', text: '👨‍👩‍👧‍👦'.repeat(500) })).rejects.toThrow(
      /10000/
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('surfaces the app-password-without-DM-scope failure clearly', async () => {
    const { client, sendMessage } = mockClient();
    // The canonical chat-service rejection when the app password was created
    // without "Allow access to your direct messages".
    sendMessage.mockRejectedValue({
      status: 401,
      error: 'InvalidToken',
      message: 'Bad token scope',
    });
    const tool = new SendDirectMessageTool(client);

    const call = tool.handler({ convoId: 'convo123', text: 'hi' });
    await expect(call).rejects.toThrow(/app password/i);
    await expect(tool.handler({ convoId: 'convo123', text: 'hi' })).rejects.toThrow(
      /direct messages/i
    );
  });
});
