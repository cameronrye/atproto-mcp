/**
 * Direct Message Tools - Bluesky chat (chat.bsky.convo) on AT Protocol
 *
 * The chat endpoints are NOT served by the user's PDS: every call must be
 * proxied to the Bluesky chat service via the `atproto-proxy` header. The SDK
 * does this with agent.withProxy('bsky_chat', 'did:web:api.bsky.chat'), which
 * clones the agent (sharing the session) and sets the proxy for all requests
 * made through the clone.
 *
 * AUTHENTICATION: all DM tools are PRIVATE, and the session's app password
 * must have been created with "Allow access to your direct messages" enabled —
 * otherwise the chat service rejects every call with 401 "Bad token scope".
 */

import { z } from 'zod';
import { RichText } from '@atproto/api';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import { AtpError, AuthenticationError, ValidationError } from '../../types/index.js';

/** DID of the Bluesky chat service every chat.bsky.convo call is proxied to. */
const BSKY_CHAT_SERVICE_DID = 'did:web:api.bsky.chat';
/** Service type used in the atproto-proxy header (did#service_type). */
const BSKY_CHAT_PROXY_SERVICE = 'bsky_chat';

/**
 * chat.bsky.convo.defs#messageInput text limits from the lexicon:
 * maxGraphemes 1000, maxLength 10000 (UTF-8 bytes). Distinct from the
 * 300/3000 post limits enforced by BaseTool.assertPostTextWithinLimits.
 */
const DM_MAX_GRAPHEMES = 1000;
const DM_MAX_BYTES = 10000;

const DM_AUTH_REQUIREMENT =
  'Bluesky direct messages require an authenticated session whose app password was created with ' +
  '"Allow access to your direct messages" enabled (bsky.app → Settings → Privacy and Security → App Passwords). ' +
  'A 401 "Bad token scope" from the chat service means the current app password was created without direct-message access.';

/** A conversation member (chat.bsky.actor.defs#profileViewBasic, trimmed). */
interface IDmMember {
  did: string;
  handle: string;
  displayName?: string;
  chatDisabled?: boolean;
}

/**
 * A normalized chat message. The API returns a union of messageView and
 * deletedMessageView; deleted messages keep their id/sender/sentAt but carry
 * no text or embed.
 */
interface IDmMessage {
  id?: string;
  senderDid?: string;
  text?: string;
  sentAt?: string;
  deleted: boolean;
  hasEmbed: boolean;
}

interface IDmConversation {
  id: string;
  members: IDmMember[];
  unreadCount: number;
  muted: boolean;
  status?: string;
  lastMessage?: IDmMessage;
}

function mapMember(member: any): IDmMember {
  return {
    did: member.did,
    handle: member.handle,
    ...(member.displayName !== undefined ? { displayName: member.displayName } : {}),
    ...(member.chatDisabled !== undefined ? { chatDisabled: member.chatDisabled } : {}),
  };
}

function mapMessage(message: any): IDmMessage {
  // The union is open ({ $type: string }); treat anything without a string
  // text as deleted/unreadable rather than emitting text: undefined.
  const deleted = typeof message.text !== 'string';
  return {
    id: message.id,
    senderDid: message.sender?.did,
    ...(deleted ? {} : { text: message.text }),
    sentAt: message.sentAt,
    deleted,
    hasEmbed: message.embed != null,
  };
}

function mapConvo(convo: any): IDmConversation {
  return {
    id: convo.id,
    members: Array.isArray(convo.members) ? convo.members.map(mapMember) : [],
    unreadCount: convo.unreadCount,
    muted: convo.muted,
    ...(convo.status !== undefined ? { status: convo.status } : {}),
    ...(convo.lastMessage != null ? { lastMessage: mapMessage(convo.lastMessage) } : {}),
  };
}

/** JSON Schema literal for a normalized chat message (shared by all 3 tools). */
const MESSAGE_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Id of the message within the chat service.' },
    senderDid: { type: 'string', description: 'DID of the account that sent the message.' },
    text: {
      type: 'string',
      description: 'Plain-text message body. Absent when the message was deleted.',
    },
    sentAt: { type: 'string', description: 'ISO 8601 timestamp when the message was sent.' },
    deleted: { type: 'boolean', description: 'True when the message was deleted by its sender.' },
    hasEmbed: {
      type: 'boolean',
      description:
        'True when the message carries an embed (a shared post). The embed content itself is not expanded.',
    },
  },
  required: ['deleted', 'hasEmbed'],
} as const;

/**
 * Shared base for the DM tools: builds the chat-proxied agent and converts the
 * canonical chat-service authentication failure (401 "Bad token scope" from an
 * app password created without DM access) into an actionable error message.
 */
abstract class BaseDmTool extends BaseTool {
  constructor(atpClient: AtpClient, toolName: string) {
    // DMs always require an authenticated session — never PUBLIC/ENHANCED.
    super(atpClient, toolName, ToolAuthMode.PRIVATE);
  }

  /**
   * Agent clone with the atproto-proxy header set to
   * did:web:api.bsky.chat#bsky_chat. Shares the session with the base agent.
   */
  protected getChatAgent(): ReturnType<ReturnType<AtpClient['getAgent']>['withProxy']> {
    return this.atpClient.getAgent().withProxy(BSKY_CHAT_PROXY_SERVICE, BSKY_CHAT_SERVICE_DID);
  }

  /**
   * executeAtpOperation wrapper for chat-service calls that augments 401
   * failures with the app-password DM-scope requirement, the single most
   * common reason chat calls fail for otherwise-working credentials.
   */
  protected async executeChatOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: Record<string, unknown>
  ): Promise<T> {
    try {
      return await this.executeAtpOperation(operation, operationName, context);
    } catch (error) {
      throw this.withDmScopeHint(error, operationName);
    }
  }

  private withDmScopeHint(error: unknown, operationName: string): unknown {
    const status =
      error instanceof AtpError
        ? error.statusCode
        : typeof error === 'object' && error !== null
          ? (error as { status?: number }).status
          : undefined;

    if (status === 401) {
      const baseMessage =
        error instanceof Error && error.message
          ? error.message
          : 'Authentication with the Bluesky chat service failed';
      return new AuthenticationError(`${baseMessage} — ${DM_AUTH_REQUIREMENT}`, error, {
        tool: this.schema.method,
        operation: operationName,
        chatService: BSKY_CHAT_SERVICE_DID,
      });
    }
    return error;
  }

  /**
   * Enforce the chat.bsky.convo.defs#messageInput text limits (1000 graphemes /
   * 10000 UTF-8 bytes) — counted on graphemes via RichText, not UTF-16 units,
   * so emoji-heavy messages are measured the way the lexicon specifies.
   */
  protected assertDmTextWithinLimits(text: string): void {
    const rt = new RichText({ text });
    if (rt.graphemeLength > DM_MAX_GRAPHEMES) {
      throw new ValidationError(
        `Message text is ${rt.graphemeLength} graphemes; the direct-message maximum is ${DM_MAX_GRAPHEMES}.`,
        'text'
      );
    }
    const byteLength = Buffer.byteLength(text, 'utf8');
    if (byteLength > DM_MAX_BYTES) {
      throw new ValidationError(
        `Message text is ${byteLength} bytes; the direct-message maximum is ${DM_MAX_BYTES}.`,
        'text'
      );
    }
  }
}

/**
 * Zod schema for list_conversations parameters
 */
const ListConversationsSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Max conversations per page (1-100, default 50).'),
  cursor: z
    .string()
    .optional()
    .describe(
      'Opaque pagination cursor from the previous response cursor field; omit for the first page.'
    ),
  status: z
    .enum(['request', 'accepted'])
    .optional()
    .describe(
      "Filter by conversation status: 'request' = incoming chat requests not yet accepted; 'accepted' = active conversations. Omit to list both."
    ),
});

/**
 * Tool for listing the authenticated user's direct-message conversations.
 *
 * AUTHENTICATION REQUIREMENT:
 * - PRIVATE: requires an authenticated session whose app password has
 *   direct-message access enabled.
 */
export class ListConversationsTool extends BaseDmTool {
  public readonly schema = {
    method: 'list_conversations',
    description:
      'List the authenticated user\'s Bluesky direct-message conversations (chat.bsky.convo.listConvos, proxied to the bsky.chat service). Returns each conversation\'s id, members, unread count, mute state, status (request/accepted) and a last-message preview, plus a pagination cursor. Requires authentication with an app password created with "Allow access to your direct messages" enabled. Use get_conversation_messages to read a conversation and send_direct_message to reply. Subject to per-tool rate limiting.',
    params: ListConversationsSchema,
    outputSchema: {
      type: 'object',
      description: "Paginated list of the user's direct-message conversations.",
      properties: {
        success: { type: 'boolean', description: 'Whether the request succeeded.' },
        conversations: {
          type: 'array',
          description: 'The conversations for this page, most recently active first.',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description:
                  'Conversation id; pass to get_conversation_messages or send_direct_message.',
              },
              members: {
                type: 'array',
                description: 'All members of the conversation, including the authenticated user.',
                items: {
                  type: 'object',
                  properties: {
                    did: { type: 'string', description: 'Decentralized identifier.' },
                    handle: { type: 'string', description: 'AT Protocol handle.' },
                    displayName: { type: 'string', description: 'Display name, if set.' },
                    chatDisabled: {
                      type: 'boolean',
                      description:
                        'True when this member cannot actively participate in conversations.',
                    },
                  },
                  required: ['did', 'handle'],
                },
              },
              unreadCount: {
                type: 'number',
                description: 'Number of unread messages in the conversation.',
              },
              muted: {
                type: 'boolean',
                description: 'Whether the authenticated user muted the conversation.',
              },
              status: {
                type: 'string',
                description:
                  "Conversation status: 'request' (pending acceptance) or 'accepted'. The lexicon union is open, so other values may appear; may be absent.",
              },
              lastMessage: {
                ...MESSAGE_OUTPUT_SCHEMA,
                description:
                  'Preview of the most recent message; absent when the conversation has no messages.',
              },
            },
            required: ['id', 'members', 'unreadCount', 'muted'],
          },
        },
        cursor: {
          type: 'string',
          description: 'Opaque cursor for the next page; absent when there are no more results.',
        },
        hasMore: {
          type: 'boolean',
          description: 'Whether another page is available (a cursor was returned).',
        },
      },
      required: ['success', 'conversations', 'hasMore'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'ListConversations');
  }

  protected async execute(params: {
    limit?: number;
    cursor?: string;
    status?: 'request' | 'accepted';
  }): Promise<{
    success: boolean;
    conversations: IDmConversation[];
    cursor?: string;
    hasMore: boolean;
  }> {
    try {
      this.logger.info('Listing direct-message conversations', {
        limit: params.limit,
        hasCursor: !!params.cursor,
        status: params.status,
      });

      const limit = params.limit ?? 50;

      const response = await this.executeChatOperation(
        async () => {
          const chatAgent = this.getChatAgent();
          return await chatAgent.chat.bsky.convo.listConvos({
            limit,
            cursor: params.cursor,
            status: params.status,
          });
        },
        'listConvos',
        { limit, status: params.status }
      );

      const conversations = response.data.convos.map(mapConvo);

      return {
        success: true,
        conversations,
        cursor: response.data.cursor,
        hasMore: !!response.data.cursor,
      };
    } catch (error) {
      this.logger.error('Failed to list conversations', error);
      this.formatError(error);
    }
  }
}

/**
 * Zod schema for get_conversation_messages parameters
 */
const GetConversationMessagesSchema = z.object({
  convoId: z
    .string()
    .min(1, 'convoId is required')
    .describe(
      'Id of the conversation to read, from list_conversations or a send_direct_message response.'
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Max messages per page (1-100, default 50). Messages are returned newest first.'),
  cursor: z
    .string()
    .optional()
    .describe(
      'Opaque pagination cursor from the previous response cursor field; omit for the newest page.'
    ),
  markRead: z
    .boolean()
    .optional()
    .describe(
      'When true, also mark the conversation read (chat.bsky.convo.updateRead) after fetching, clearing its unread count. Default false: reading is side-effect free.'
    ),
});

/**
 * Tool for reading the messages of a direct-message conversation.
 *
 * AUTHENTICATION REQUIREMENT:
 * - PRIVATE: requires an authenticated session whose app password has
 *   direct-message access enabled.
 */
export class GetConversationMessagesTool extends BaseDmTool {
  public readonly schema = {
    method: 'get_conversation_messages',
    description:
      'Read the messages of a Bluesky direct-message conversation (chat.bsky.convo.getMessages, proxied to the bsky.chat service), newest first with cursor pagination. Read-only by default: the conversation is only marked read (unread count cleared) when markRead is true. Requires authentication with an app password created with "Allow access to your direct messages" enabled. Use list_conversations to find conversation ids and send_direct_message to reply. Subject to per-tool rate limiting.',
    params: GetConversationMessagesSchema,
    outputSchema: {
      type: 'object',
      description: 'One page of messages from the conversation, newest first.',
      properties: {
        success: { type: 'boolean', description: 'Whether the request succeeded.' },
        convoId: { type: 'string', description: 'Id of the conversation that was read.' },
        messages: {
          type: 'array',
          description:
            'The messages for this page, newest first. Deleted messages keep their id/sender/timestamp but have no text.',
          items: MESSAGE_OUTPUT_SCHEMA,
        },
        cursor: {
          type: 'string',
          description:
            'Opaque cursor for the next (older) page; absent when there are no more messages.',
        },
        hasMore: {
          type: 'boolean',
          description: 'Whether another (older) page is available (a cursor was returned).',
        },
        markedRead: {
          type: 'boolean',
          description: 'Whether the conversation was marked read by this call (markRead=true).',
        },
      },
      required: ['success', 'convoId', 'messages', 'hasMore', 'markedRead'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'GetConversationMessages');
  }

  protected async execute(params: {
    convoId: string;
    limit?: number;
    cursor?: string;
    markRead?: boolean;
  }): Promise<{
    success: boolean;
    convoId: string;
    messages: IDmMessage[];
    cursor?: string;
    hasMore: boolean;
    markedRead: boolean;
  }> {
    try {
      this.logger.info('Fetching conversation messages', {
        convoId: params.convoId,
        limit: params.limit,
        hasCursor: !!params.cursor,
        markRead: params.markRead === true,
      });

      const limit = params.limit ?? 50;

      const response = await this.executeChatOperation(
        async () => {
          const chatAgent = this.getChatAgent();
          return await chatAgent.chat.bsky.convo.getMessages({
            convoId: params.convoId,
            limit,
            cursor: params.cursor,
          });
        },
        'getMessages',
        { convoId: params.convoId, limit }
      );

      // getMessages does NOT change read state; marking read is a separate,
      // explicit updateRead call (without messageId = the whole conversation).
      let markedRead = false;
      if (params.markRead === true) {
        await this.executeChatOperation(
          async () => {
            const chatAgent = this.getChatAgent();
            return await chatAgent.chat.bsky.convo.updateRead({ convoId: params.convoId });
          },
          'updateRead',
          { convoId: params.convoId }
        );
        markedRead = true;
      }

      return {
        success: true,
        convoId: params.convoId,
        messages: response.data.messages.map(mapMessage),
        cursor: response.data.cursor,
        hasMore: !!response.data.cursor,
        markedRead,
      };
    } catch (error) {
      this.logger.error('Failed to fetch conversation messages', error);
      this.formatError(error);
    }
  }
}

/**
 * Zod schema for send_direct_message parameters
 */
const SendDirectMessageSchema = z
  .object({
    convoId: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Id of an existing conversation to send into (from list_conversations). Provide exactly one of convoId or member.'
      ),
    member: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Handle (e.g. bob.bsky.social) or DID of the account to message. The conversation is resolved (or created) via chat.bsky.convo.getConvoForMembers, so no prior conversation is needed. Provide exactly one of convoId or member.'
      ),
    text: z
      .string()
      .min(1, 'Message text is required')
      .describe(
        'Plain-text message body (max 1000 graphemes / 10000 UTF-8 bytes). Mentions, links and hashtags are sent as plain text — no facets are attached.'
      ),
  })
  .refine(p => (p.convoId !== undefined) !== (p.member !== undefined), {
    message: 'Provide exactly one of convoId or member',
  });

/**
 * Tool for sending a direct message, either into a known conversation or to a
 * member (handle/DID) whose conversation is resolved on the fly.
 *
 * AUTHENTICATION REQUIREMENT:
 * - PRIVATE: requires an authenticated session whose app password has
 *   direct-message access enabled.
 */
export class SendDirectMessageTool extends BaseDmTool {
  public readonly schema = {
    method: 'send_direct_message',
    description:
      'Send a plain-text Bluesky direct message (chat.bsky.convo.sendMessage, proxied to the bsky.chat service). Target either an existing conversation by convoId, or a recipient by handle/DID via member — the conversation is then resolved (or created) automatically with chat.bsky.convo.getConvoForMembers. Message text is limited to 1000 graphemes / 10000 UTF-8 bytes and is sent without facets (mentions/links appear as plain text). Requires authentication with an app password created with "Allow access to your direct messages" enabled; the recipient\'s settings must also allow DMs from you. Subject to per-tool rate limiting.',
    params: SendDirectMessageSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the message was sent.' },
        message: { type: 'string', description: 'Human-readable status message.' },
        convoId: {
          type: 'string',
          description:
            'Id of the conversation the message was sent into; reuse it for follow-up messages to skip conversation resolution.',
        },
        recipientDid: {
          type: 'string',
          description:
            'DID the member parameter resolved to. Present only when member was used to target the message.',
        },
        sentMessage: {
          ...MESSAGE_OUTPUT_SCHEMA,
          description: 'The message as recorded by the chat service.',
        },
      },
      required: ['success', 'message', 'convoId', 'sentMessage'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'SendDirectMessage');
  }

  protected async execute(params: { convoId?: string; member?: string; text: string }): Promise<{
    success: boolean;
    message: string;
    convoId: string;
    recipientDid?: string;
    sentMessage: IDmMessage;
  }> {
    try {
      this.logger.info('Sending direct message', {
        hasConvoId: !!params.convoId,
        hasMember: !!params.member,
        textLength: params.text.length,
      });

      this.assertDmTextWithinLimits(params.text);

      // Resolve the target conversation: either given directly, or looked up
      // (and created if needed) from the recipient's DID.
      let convoId = params.convoId;
      let recipientDid: string | undefined;
      if (convoId === undefined) {
        // The refine() on the schema guarantees member is set here.
        const member = params.member as string;
        this.validateActor(member);
        // getConvoForMembers requires DIDs, not handles.
        recipientDid = await this.resolveDid(member);
        const did = recipientDid;

        const convoResponse = await this.executeChatOperation(
          async () => {
            const chatAgent = this.getChatAgent();
            return await chatAgent.chat.bsky.convo.getConvoForMembers({ members: [did] });
          },
          'getConvoForMembers',
          { member, recipientDid }
        );
        convoId = convoResponse.data.convo.id;
      }
      const targetConvoId = convoId;

      const response = await this.executeChatOperation(
        async () => {
          const chatAgent = this.getChatAgent();
          return await chatAgent.chat.bsky.convo.sendMessage({
            convoId: targetConvoId,
            message: { text: params.text },
          });
        },
        'sendMessage',
        { convoId: targetConvoId }
      );

      this.logger.info('Direct message sent', {
        convoId: targetConvoId,
        messageId: response.data.id,
      });

      return {
        success: true,
        message: 'Direct message sent successfully',
        convoId: targetConvoId,
        ...(recipientDid !== undefined ? { recipientDid } : {}),
        sentMessage: mapMessage(response.data),
      };
    } catch (error) {
      this.logger.error('Failed to send direct message', error);
      this.formatError(error);
    }
  }
}
