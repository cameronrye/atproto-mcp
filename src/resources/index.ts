/**
 * MCP Resources for AT Protocol data exposure
 */

import type { AtpClient } from '../utils/atp-client.js';
import { Logger } from '../utils/logger.js';
import { BaseResource, type IResourceContent } from './base.js';

// Export base classes and interfaces
export { BaseResource, type IMcpResource, type IResourceContent } from './base.js';

/**
 * Timeline resource - exposes user's timeline as JSON
 */
export class TimelineResource extends BaseResource {
  public readonly uri = 'atproto://timeline';
  public readonly name = 'User Timeline';
  public readonly description =
    "Current user's timeline feed with recent posts. Requires authentication.";
  public readonly mimeType = 'application/json';

  constructor(atpClient: AtpClient) {
    super(atpClient, 'TimelineResource');
  }

  async read(): Promise<IResourceContent> {
    try {
      this.logger.info('Reading timeline resource');

      if (!this.atpClient.isAuthenticated()) {
        throw new Error('Authentication required to access timeline');
      }

      const agent = this.atpClient.getAgent();
      const response = await agent.getTimeline({
        limit: 50,
      });

      const timelineData = {
        uri: this.uri,
        timestamp: new Date().toISOString(),
        posts: response.data.feed.map((item: any) => ({
          uri: item.post.uri,
          cid: item.post.cid,
          author: {
            did: item.post.author.did,
            handle: item.post.author.handle,
            displayName: item.post.author.displayName,
            avatar: item.post.author.avatar,
          },
          text: item.post.record.text,
          createdAt: item.post.record.createdAt,
          replyCount: item.post.replyCount || 0,
          repostCount: item.post.repostCount || 0,
          likeCount: item.post.likeCount || 0,
          isLiked: !!item.post.viewer?.like,
          isReposted: !!item.post.viewer?.repost,
          embed: item.post.embed,
          reply: item.post.record.reply,
        })),
        cursor: response.data.cursor,
      };

      return {
        uri: this.uri,
        mimeType: this.mimeType,
        text: JSON.stringify(timelineData, null, 2),
      };
    } catch (error) {
      this.logger.error('Failed to read timeline resource', error);
      throw error;
    }
  }
}

/**
 * Profile resource - exposes user's profile information as JSON
 */
export class ProfileResource extends BaseResource {
  public readonly uri = 'atproto://profile';
  public readonly name = 'User Profile';
  public readonly description =
    "Current user's profile information and statistics. Requires authentication.";
  public readonly mimeType = 'application/json';

  constructor(atpClient: AtpClient) {
    super(atpClient, 'ProfileResource');
  }

  async read(): Promise<IResourceContent> {
    try {
      this.logger.info('Reading profile resource');

      if (!this.atpClient.isAuthenticated()) {
        throw new Error('Authentication required to access profile');
      }

      const agent = this.atpClient.getAgent();
      const session = agent.session;

      if (!session?.did) {
        throw new Error('No active session found');
      }

      const response = await agent.getProfile({
        actor: session.did,
      });

      const profileData = {
        uri: this.uri,
        timestamp: new Date().toISOString(),
        profile: {
          did: response.data.did,
          handle: response.data.handle,
          displayName: response.data.displayName,
          description: response.data.description,
          avatar: response.data.avatar,
          banner: response.data.banner,
          followersCount: response.data.followersCount || 0,
          followsCount: response.data.followsCount || 0,
          postsCount: response.data.postsCount || 0,
          indexedAt: response.data.indexedAt,
          createdAt: response.data.createdAt,
          labels: response.data.labels || [],
        },
        session: {
          did: session.did,
          handle: session.handle,
          active: session.active,
        },
      };

      return {
        uri: this.uri,
        mimeType: this.mimeType,
        text: JSON.stringify(profileData, null, 2),
      };
    } catch (error) {
      this.logger.error('Failed to read profile resource', error);
      throw error;
    }
  }
}

/**
 * Notifications resource - exposes user's notifications as JSON
 */
export class NotificationsResource extends BaseResource {
  public readonly uri = 'atproto://notifications';
  public readonly name = 'User Notifications';
  public readonly description =
    "Current user's recent notifications and mentions. Requires authentication.";
  public readonly mimeType = 'application/json';

  constructor(atpClient: AtpClient) {
    super(atpClient, 'NotificationsResource');
  }

  async read(): Promise<IResourceContent> {
    try {
      this.logger.info('Reading notifications resource');

      if (!this.atpClient.isAuthenticated()) {
        throw new Error('Authentication required to access notifications');
      }

      const agent = this.atpClient.getAgent();
      const response = await agent.listNotifications({
        limit: 50,
      });

      const notificationsData = {
        uri: this.uri,
        timestamp: new Date().toISOString(),
        notifications: response.data.notifications.map((notification: any) => ({
          uri: notification.uri,
          cid: notification.cid,
          author: {
            did: notification.author.did,
            handle: notification.author.handle,
            displayName: notification.author.displayName,
            avatar: notification.author.avatar,
          },
          reason: notification.reason,
          reasonSubject: notification.reasonSubject,
          record: notification.record,
          isRead: notification.isRead,
          indexedAt: notification.indexedAt,
          labels: notification.labels || [],
        })),
        cursor: response.data.cursor,
        seenAt: response.data.seenAt,
      };

      return {
        uri: this.uri,
        mimeType: this.mimeType,
        text: JSON.stringify(notificationsData, null, 2),
      };
    } catch (error) {
      this.logger.error('Failed to read notifications resource', error);
      throw error;
    }
  }
}

// Import conversation context resource
import { ConversationContextResource } from './conversation-context-resource.js';

// Export conversation context resource
export { ConversationContextResource };

/**
 * Create all MCP resources for AT Protocol data
 */
export function createResources(atpClient: AtpClient): BaseResource[] {
  const logger = new Logger('ResourcesFactory');

  // Construct each resource defensively so one failing constructor does not
  // disable the entire resource set.
  const factories: Array<() => BaseResource> = [
    () => new TimelineResource(atpClient),
    () => new ProfileResource(atpClient),
    () => new NotificationsResource(atpClient),
    () => new ConversationContextResource(atpClient),
  ];

  const resources: BaseResource[] = [];
  for (const make of factories) {
    try {
      resources.push(make());
    } catch (error) {
      logger.error('Failed to construct an MCP resource; skipping it', error);
    }
  }

  logger.info(`Created ${resources.length} AT Protocol MCP resources`);
  return resources;
}
