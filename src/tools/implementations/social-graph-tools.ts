/**
 * Social Graph Tools - Retrieve connections and notifications from AT Protocol
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import type { DID, IAtpProfile, IGetNotificationsParams } from '../../types/index.js';

/**
 * Shared profile-transform helper — maps a raw AppView ProfileView entry to the
 * documented IAtpProfile + indexedAt shape. ProfileView does NOT carry follower /
 * follow / post counts (only ProfileViewDetailed does), so those fields are
 * omitted rather than emitted as always-undefined values.
 */
function mapProfile(entry: any): IAtpProfile & { indexedAt?: string } {
  return {
    did: entry.did as DID,
    handle: entry.handle,
    displayName: entry.displayName,
    description: entry.description,
    avatar: entry.avatar,
    banner: entry.banner,
    indexedAt: entry.indexedAt,
  };
}

/**
 * Zod schema for get_user_connections parameters
 */
const GetUserConnectionsSchema = z.object({
  actor: z
    .string()
    .min(1)
    .describe('Handle (e.g. alice.bsky.social) or DID of the account whose connections to list.'),
  direction: z
    .enum(['followers', 'follows'])
    .describe(
      "Which side of the follow graph to return: 'followers' = accounts that follow the actor; 'follows' = accounts the actor follows."
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Max accounts per page (1–100, default 50).'),
  cursor: z
    .string()
    .optional()
    .describe(
      'Opaque pagination cursor from the previous response cursor field; omit for the first page.'
    ),
});

/**
 * Merged tool replacing the former get_followers and get_follows tools.
 * Use the direction param to choose which side of the follow graph to query.
 * Works without authentication; richer viewer state is returned when authenticated.
 */
export class GetUserConnectionsTool extends BaseTool {
  public readonly schema = {
    method: 'get_user_connections',
    description:
      "Retrieve an account's followers or follows from AT Protocol. Works without authentication; richer with auth. Use direction to choose followers vs follows — replaces the former separate tools. Subject to per-tool rate limiting.",
    params: GetUserConnectionsSchema,
    outputSchema: {
      type: 'object',
      description: 'Paginated list of connected accounts.',
      properties: {
        success: { type: 'boolean', description: 'Whether the request succeeded.' },
        actor: { type: 'string', description: 'The actor whose connections were fetched.' },
        direction: {
          type: 'string',
          enum: ['followers', 'follows'],
          description: 'The direction of the follow graph that was queried.',
        },
        connections: {
          type: 'array',
          description: 'The matched accounts for this page.',
          items: {
            type: 'object',
            properties: {
              did: { type: 'string', description: 'Decentralized identifier.' },
              handle: { type: 'string', description: 'AT Protocol handle.' },
              displayName: { type: 'string', description: 'Display name, if set.' },
              description: { type: 'string', description: 'Bio / profile description.' },
              avatar: { type: 'string', description: 'URL of the avatar image.' },
              banner: { type: 'string', description: 'URL of the banner image.' },
              indexedAt: {
                type: 'string',
                description: 'ISO 8601 timestamp when the record was indexed.',
              },
            },
            required: ['did', 'handle'],
          },
        },
        cursor: {
          type: 'string',
          description: 'Opaque cursor for the next page; absent when there are no more results.',
        },
      },
      required: ['success', 'actor', 'direction', 'connections'],
    },
  };

  constructor(atpClient: AtpClient) {
    // Public AppView data; works unauthenticated, richer (viewer state) with auth.
    super(atpClient, 'GetUserConnections', ToolAuthMode.ENHANCED);
  }

  protected async execute(params: {
    actor: string;
    direction: 'followers' | 'follows';
    limit?: number;
    cursor?: string;
  }): Promise<{
    success: boolean;
    actor: string;
    direction: 'followers' | 'follows';
    connections: Array<IAtpProfile & { indexedAt?: string }>;
    cursor?: string;
  }> {
    try {
      this.logger.info('Retrieving user connections', {
        actor: params.actor,
        direction: params.direction,
        limit: params.limit,
        hasCursor: !!params.cursor,
      });

      this.validateActor(params.actor);

      const limit = params.limit || 50;

      let rawItems: any[];
      let cursor: string | undefined;

      if (params.direction === 'followers') {
        const response = await this.executeAtpOperation(
          async () => {
            const agent = this.atpClient.getAgent();
            return await agent.getFollowers({
              actor: params.actor,
              limit,
              cursor: params.cursor,
            });
          },
          'getFollowers',
          { actor: params.actor, limit }
        );
        rawItems = response.data.followers;
        cursor = response.data.cursor;
      } else {
        const response = await this.executeAtpOperation(
          async () => {
            const agent = this.atpClient.getAgent();
            return await agent.getFollows({
              actor: params.actor,
              limit,
              cursor: params.cursor,
            });
          },
          'getFollows',
          { actor: params.actor, limit }
        );
        rawItems = response.data.follows;
        cursor = response.data.cursor;
      }

      const connections = rawItems.map(mapProfile);

      this.logger.info('User connections retrieved successfully', {
        actor: params.actor,
        direction: params.direction,
        count: connections.length,
        hasMore: !!cursor,
      });

      return {
        success: true,
        actor: params.actor,
        direction: params.direction,
        connections,
        cursor,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve user connections', error);
      this.formatError(error);
    }
  }
}

/**
 * Zod schema for get notifications parameters
 */
const GetNotificationsSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Max notifications per page (1–100, default 50).'),
  cursor: z
    .string()
    .optional()
    .describe(
      'Opaque pagination cursor from the previous response cursor field; omit for the first page.'
    ),
  seenAt: z
    .string()
    .optional()
    .describe(
      'ISO 8601 timestamp; only return notifications that occurred after this time. Optional filter.'
    ),
  countOnly: z
    .boolean()
    .optional()
    .describe(
      'When true, return only the unread count and skip fetching the notification list (cheap badge-number path).'
    ),
});

/**
 * Tool for retrieving notifications from AT Protocol
 */
export class GetNotificationsTool extends BaseTool {
  public readonly schema = {
    method: 'get_notifications',
    description:
      'Retrieve notifications from AT Protocol (likes, reposts, follows, mentions, replies). Requires authentication. Use countOnly: true to fetch just the unread badge number without retrieving the full list. Subject to per-tool rate limiting.',
    params: GetNotificationsSchema,
    outputSchema: {
      type: 'object',
      description:
        'Notification result. When countOnly is true only unreadCount is present; otherwise the full list is returned.',
      properties: {
        success: { type: 'boolean', description: 'Whether the request succeeded.' },
        unreadCount: {
          type: 'number',
          description: 'Number of unread notifications (always present).',
        },
        notifications: {
          type: 'array',
          description: 'Notification entries. Present only when countOnly is false/absent.',
          items: {
            type: 'object',
            properties: {
              uri: { type: 'string', description: 'AT URI of the notification record.' },
              cid: { type: 'string', description: 'CID of the notification record.' },
              author: {
                type: 'object',
                description: 'Author of the action that triggered the notification.',
                properties: {
                  did: { type: 'string' },
                  handle: { type: 'string' },
                  displayName: { type: 'string' },
                  avatar: { type: 'string' },
                  followersCount: { type: 'number' },
                  followsCount: { type: 'number' },
                  postsCount: { type: 'number' },
                },
                required: ['did', 'handle'],
              },
              reason: {
                type: 'string',
                enum: ['like', 'repost', 'follow', 'mention', 'reply', 'quote'],
                description: 'Why this notification was generated.',
              },
              record: { type: 'object', description: 'Raw lexicon record payload.' },
              isRead: { type: 'boolean', description: 'Whether the notification has been read.' },
              indexedAt: {
                type: 'string',
                description: 'ISO 8601 timestamp when indexed.',
              },
              labels: { type: 'array', description: 'Moderation labels, if any.' },
            },
            required: ['uri', 'cid', 'author', 'reason', 'isRead', 'indexedAt'],
          },
        },
        cursor: {
          type: 'string',
          description:
            'Opaque cursor for the next page. Present only when countOnly is false/absent.',
        },
        hasMore: {
          type: 'boolean',
          description:
            'True when a next page is available. Present only when countOnly is false/absent.',
        },
        seenAt: {
          type: 'string',
          description:
            'The timestamp up to which notifications have been seen. Present only when countOnly is false/absent.',
        },
      },
      required: ['success', 'unreadCount'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'GetNotifications');
  }

  protected async execute(params: IGetNotificationsParams & { countOnly?: boolean }): Promise<
    | { success: boolean; unreadCount: number }
    | {
        success: boolean;
        unreadCount: number;
        notifications: Array<{
          uri: string;
          cid: string;
          author: IAtpProfile;
          reason: 'like' | 'repost' | 'follow' | 'mention' | 'reply' | 'quote';
          record: any;
          isRead: boolean;
          indexedAt: string;
          labels?: any[];
        }>;
        cursor?: string;
        hasMore: boolean;
        seenAt?: string;
      }
  > {
    try {
      if (params.countOnly) {
        // Cheap path: only fetch the unread count without loading the full list.
        this.logger.info('Retrieving unread notification count (countOnly)');

        const response = await this.executeAtpOperation(async () => {
          const agent = this.atpClient.getAgent();
          return await agent.countUnreadNotifications();
        }, 'countUnreadNotifications');

        return { success: true, unreadCount: response.data.count };
      }

      this.logger.info('Retrieving notifications', {
        limit: params.limit,
        hasCursor: !!params.cursor,
        hasSeenAt: !!params.seenAt,
      });

      // Get notifications using AT Protocol
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.listNotifications({
            limit: params.limit || 50,
            cursor: params.cursor,
            seenAt: params.seenAt,
          });
        },
        'listNotifications',
        {
          limit: params.limit,
        }
      );

      // Fetch unread count to include in full response.
      let unreadCount = 0;
      try {
        const countResponse = await this.executeAtpOperation(async () => {
          const agent = this.atpClient.getAgent();
          return await agent.countUnreadNotifications();
        }, 'countUnreadNotifications');
        unreadCount = countResponse.data.count;
      } catch {
        // Non-fatal: count failure should not prevent notification list from returning.
        unreadCount = response.data.notifications.filter((n: any) => !n.isRead).length;
      }

      // Transform notifications to our interface
      const notifications = response.data.notifications.map((notification: any) => ({
        uri: notification.uri,
        cid: notification.cid,
        author: {
          did: notification.author.did as DID,
          handle: notification.author.handle,
          displayName: notification.author.displayName,
          description: notification.author.description,
          avatar: notification.author.avatar,
          followersCount: notification.author.followersCount,
          followsCount: notification.author.followsCount,
          postsCount: notification.author.postsCount,
        },
        reason: notification.reason,
        record: notification.record,
        isRead: notification.isRead,
        indexedAt: notification.indexedAt,
        labels: notification.labels,
      }));

      const hasMore = !!response.data.cursor;
      const cursor = response.data.cursor;

      this.logger.info('Notifications retrieved successfully', {
        notificationsCount: notifications.length,
        hasMore,
        unreadCount,
      });

      return {
        success: true,
        unreadCount,
        notifications,
        cursor,
        hasMore,
        seenAt: response.data.seenAt,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve notifications', error);
      this.formatError(error);
    }
  }
}

const MarkNotificationsSeenSchema = z.object({
  seenAt: z
    .string()
    .optional()
    .describe(
      'ISO 8601 timestamp; notifications up to this time are marked seen. Defaults to now.'
    ),
});

/**
 * Mark notifications as seen up to a timestamp so an agent does not re-process
 * the same notifications on every run. Requires authentication.
 */
export class MarkNotificationsSeenTool extends BaseTool {
  public readonly schema = {
    method: 'mark_notifications_seen',
    description:
      'Mark notifications as seen up to a timestamp (defaults to now) so they are not reprocessed. Requires authentication.',
    params: MarkNotificationsSeenSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'MarkNotificationsSeen', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: {
    seenAt?: string;
  }): Promise<{ success: boolean; message: string; seenAt: string }> {
    try {
      const timestamp = params.seenAt || new Date().toISOString();
      this.logger.info('Marking notifications as seen', { seenAt: timestamp });

      await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.updateSeenNotifications(timestamp);
        },
        'updateSeenNotifications',
        { seenAt: timestamp }
      );

      return { success: true, message: 'Notifications marked as seen', seenAt: timestamp };
    } catch (error) {
      this.logger.error('Failed to mark notifications as seen', error);
      this.formatError(error);
    }
  }
}
