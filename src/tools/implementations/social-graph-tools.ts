/**
 * Social Graph Tools - Retrieve followers, follows, and notifications from AT Protocol
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import type {
  DID,
  IAtpProfile,
  IGetFollowersParams,
  IGetFollowsParams,
  IGetNotificationsParams,
} from '../../types/index.js';

/**
 * Zod schema for get followers parameters
 */
const GetFollowersSchema = z.object({
  actor: z.string().min(1, 'Actor (DID or handle) is required'),
  limit: z.number().int().min(1).max(100).optional().default(50),
  cursor: z
    .string()
    .optional()
    .describe(
      'Opaque pagination cursor from the previous response cursor field; omit for the first page.'
    ),
});

/**
 * Zod schema for get follows parameters
 */
const GetFollowsSchema = z.object({
  actor: z.string().min(1, 'Actor (DID or handle) is required'),
  limit: z.number().int().min(1).max(100).optional().default(50),
  cursor: z
    .string()
    .optional()
    .describe(
      'Opaque pagination cursor from the previous response cursor field; omit for the first page.'
    ),
});

/**
 * Zod schema for get notifications parameters
 */
const GetNotificationsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(50),
  cursor: z
    .string()
    .optional()
    .describe(
      'Opaque pagination cursor from the previous response cursor field; omit for the first page.'
    ),
  seenAt: z.string().optional(),
});

/**
 * Tool for retrieving user followers from AT Protocol
 */
export class GetFollowersTool extends BaseTool {
  public readonly schema = {
    method: 'get_followers',
    description:
      'Retrieve followers of a user from AT Protocol. Returns a list of users who follow the specified actor.',
    params: GetFollowersSchema,
  };

  constructor(atpClient: AtpClient) {
    // Public AppView data; works unauthenticated, richer (viewer state) with auth.
    super(atpClient, 'GetFollowers', ToolAuthMode.ENHANCED);
  }

  protected async execute(params: IGetFollowersParams): Promise<{
    success: boolean;
    followers: Array<IAtpProfile & { indexedAt?: string }>;
    cursor?: string;
    hasMore: boolean;
    actor: string;
  }> {
    try {
      this.logger.info('Retrieving followers', {
        actor: params.actor,
        limit: params.limit,
        hasCursor: !!params.cursor,
      });

      // Validate the actor identifier
      this.validateActor(params.actor);

      // Get followers using AT Protocol
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getFollowers({
            actor: params.actor,
            limit: params.limit || 50,
            cursor: params.cursor,
          });
        },
        'getFollowers',
        {
          actor: params.actor,
          limit: params.limit,
        }
      );

      // Transform followers to our interface. Note: getFollowers returns
      // ProfileView entries, which do NOT carry followersCount/followsCount/
      // postsCount (only ProfileViewDetailed does), so we omit those rather than
      // emit always-undefined fields that imply the data is available.
      const followers = response.data.followers.map((follower: any) => ({
        did: follower.did as DID,
        handle: follower.handle,
        displayName: follower.displayName,
        description: follower.description,
        avatar: follower.avatar,
        banner: follower.banner,
        indexedAt: follower.indexedAt,
      }));

      const hasMore = !!response.data.cursor;
      const cursor = response.data.cursor;

      this.logger.info('Followers retrieved successfully', {
        actor: params.actor,
        followersCount: followers.length,
        hasMore,
      });

      return {
        success: true,
        followers,
        cursor,
        hasMore,
        actor: params.actor,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve followers', error);
      this.formatError(error);
    }
  }
}

/**
 * Tool for retrieving users that a user follows from AT Protocol
 */
export class GetFollowsTool extends BaseTool {
  public readonly schema = {
    method: 'get_follows',
    description:
      'Retrieve users that an actor follows from AT Protocol. Returns a list of users followed by the specified actor.',
    params: GetFollowsSchema,
  };

  constructor(atpClient: AtpClient) {
    // Public AppView data; works unauthenticated, richer (viewer state) with auth.
    super(atpClient, 'GetFollows', ToolAuthMode.ENHANCED);
  }

  protected async execute(params: IGetFollowsParams): Promise<{
    success: boolean;
    follows: Array<IAtpProfile & { indexedAt?: string }>;
    cursor?: string;
    hasMore: boolean;
    actor: string;
  }> {
    try {
      this.logger.info('Retrieving follows', {
        actor: params.actor,
        limit: params.limit,
        hasCursor: !!params.cursor,
      });

      // Validate the actor identifier
      this.validateActor(params.actor);

      // Get follows using AT Protocol
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getFollows({
            actor: params.actor,
            limit: params.limit || 50,
            cursor: params.cursor,
          });
        },
        'getFollows',
        {
          actor: params.actor,
          limit: params.limit,
        }
      );

      // Transform follows to our interface. getFollows returns ProfileView
      // entries without follower/follow/post counts (see GetFollowersTool), so
      // those fields are omitted rather than emitted as always-undefined.
      const follows = response.data.follows.map((follow: any) => ({
        did: follow.did as DID,
        handle: follow.handle,
        displayName: follow.displayName,
        description: follow.description,
        avatar: follow.avatar,
        banner: follow.banner,
        indexedAt: follow.indexedAt,
      }));

      const hasMore = !!response.data.cursor;
      const cursor = response.data.cursor;

      this.logger.info('Follows retrieved successfully', {
        actor: params.actor,
        followsCount: follows.length,
        hasMore,
      });

      return {
        success: true,
        follows,
        cursor,
        hasMore,
        actor: params.actor,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve follows', error);
      this.formatError(error);
    }
  }
}

/**
 * Tool for retrieving notifications from AT Protocol
 */
export class GetNotificationsTool extends BaseTool {
  public readonly schema = {
    method: 'get_notifications',
    description:
      'Retrieve notifications from AT Protocol. Returns likes, reposts, follows, mentions, and replies.',
    params: GetNotificationsSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'GetNotifications');
  }

  protected async execute(params: IGetNotificationsParams): Promise<{
    success: boolean;
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
  }> {
    try {
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
        unreadCount: notifications.filter(n => !n.isRead).length,
      });

      return {
        success: true,
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

/**
 * Get the count of unread notifications — a cheap poll for "is there anything new"
 * that does not require fetching the full notification list. Requires authentication.
 */
export class GetUnreadCountTool extends BaseTool {
  public readonly schema = {
    method: 'get_unread_count',
    description: 'Get the number of unread notifications. Requires authentication.',
    params: z.object({}),
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'GetUnreadCount', ToolAuthMode.PRIVATE);
  }

  protected async execute(): Promise<{ success: boolean; count: number }> {
    try {
      const response = await this.executeAtpOperation(async () => {
        const agent = this.atpClient.getAgent();
        return await agent.countUnreadNotifications();
      }, 'countUnreadNotifications');
      return { success: true, count: response.data.count };
    } catch (error) {
      this.logger.error('Failed to get unread notification count', error);
      this.formatError(error);
    }
  }
}
