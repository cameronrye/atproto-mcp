/**
 * Timeline and Feed Tools - Retrieve timelines and feeds from AT Protocol
 */

import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import type { IAtpPost, IGetTimelineParams } from '../../types/index.js';

/**
 * Zod schema for get timeline parameters
 */
const GetTimelineSchema = z.object({
  algorithm: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().optional(),
});

/**
 * Tool for retrieving user timelines from AT Protocol
 */
export class GetTimelineTool extends BaseTool {
  public readonly schema = {
    method: 'get_timeline',
    description:
      "Retrieve the user's timeline/feed from AT Protocol. Returns posts from followed users and recommended content. Requires authentication.",
    params: GetTimelineSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'GetTimeline');
  }

  protected async execute(params: IGetTimelineParams): Promise<{
    success: boolean;
    posts: IAtpPost[];
    cursor?: string;
    hasMore: boolean;
    algorithm?: string;
  }> {
    try {
      this.logger.info('Retrieving timeline', {
        algorithm: params.algorithm,
        limit: params.limit,
        hasCursor: !!params.cursor,
      });

      // Build timeline parameters
      const timelineParams: any = {
        limit: params.limit || 50,
      };

      if (params.cursor) timelineParams.cursor = params.cursor;
      if (params.algorithm) timelineParams.algorithm = params.algorithm;

      // Get timeline using AT Protocol
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getTimeline(timelineParams);
        },
        'getTimeline',
        {
          algorithm: params.algorithm,
          limit: params.limit,
        }
      );

      // Transform posts to our interface
      const posts: IAtpPost[] = response.data.feed.map((feedItem: any) =>
        this.transformPost(feedItem.post)
      );

      const hasMore = !!response.data.cursor;
      const cursor = response.data.cursor;

      this.logger.info('Timeline retrieved successfully', {
        postsCount: posts.length,
        hasMore,
        algorithm: params.algorithm,
      });

      return {
        success: true,
        posts,
        cursor,
        hasMore,
        algorithm: params.algorithm,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve timeline', error);
      this.formatError(error);
    }
  }

  /**
   * Transform AT Protocol post data to our interface
   */
  private transformPost(postData: any): IAtpPost {
    return {
      uri: postData.uri,
      cid: postData.cid,
      author: {
        did: postData.author.did,
        handle: postData.author.handle,
        displayName: postData.author.displayName,
        description: postData.author.description,
        avatar: postData.author.avatar,
        followersCount: postData.author.followersCount,
        followsCount: postData.author.followsCount,
        postsCount: postData.author.postsCount,
      },
      record: {
        text: postData.record.text || '',
        createdAt: postData.record.createdAt,
        reply: postData.record.reply
          ? {
              root: {
                uri: postData.record.reply.root.uri,
                cid: postData.record.reply.root.cid,
              },
              parent: {
                uri: postData.record.reply.parent.uri,
                cid: postData.record.reply.parent.cid,
              },
            }
          : undefined,
        embed: postData.record.embed,
        langs: postData.record.langs,
        labels: postData.record.labels,
        tags: postData.record.tags,
      },
      replyCount: postData.replyCount,
      repostCount: postData.repostCount,
      likeCount: postData.likeCount,
      indexedAt: postData.indexedAt,
      viewer: postData.viewer
        ? {
            repost: postData.viewer.repost,
            like: postData.viewer.like,
          }
        : undefined,
    };
  }

  /**
   * Get author feed (posts by a specific user)
   */
  public async getAuthorFeed(
    actor: string,
    options?: {
      limit?: number;
      cursor?: string;
      filter?: 'posts_with_replies' | 'posts_no_replies' | 'posts_with_media';
    }
  ): Promise<{
    success: boolean;
    posts: IAtpPost[];
    cursor?: string;
    hasMore: boolean;
    author: string;
  }> {
    try {
      this.validateActor(actor);

      this.logger.info('Retrieving author feed', {
        actor,
        limit: options?.limit,
        filter: options?.filter,
        hasCursor: !!options?.cursor,
      });

      const feedParams: any = {
        actor,
        limit: options?.limit || 50,
      };

      if (options?.cursor) feedParams.cursor = options.cursor;
      if (options?.filter) feedParams.filter = options.filter;

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getAuthorFeed(feedParams);
        },
        'getAuthorFeed',
        { actor, filter: options?.filter }
      );

      const posts: IAtpPost[] = response.data.feed.map((feedItem: any) =>
        this.transformPost(feedItem.post)
      );

      return {
        success: true,
        posts,
        cursor: response.data.cursor,
        hasMore: !!response.data.cursor,
        author: actor,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve author feed', error);
      throw error;
    }
  }

  /**
   * Get likes feed (posts liked by a user)
   */
  public async getLikes(
    actor: string,
    options?: {
      limit?: number;
      cursor?: string;
    }
  ): Promise<{
    success: boolean;
    posts: IAtpPost[];
    cursor?: string;
    hasMore: boolean;
    actor: string;
  }> {
    try {
      this.validateActor(actor);

      this.logger.info('Retrieving likes feed', {
        actor,
        limit: options?.limit,
        hasCursor: !!options?.cursor,
      });

      const likesParams: any = {
        actor,
        limit: options?.limit || 50,
      };

      if (options?.cursor) likesParams.cursor = options.cursor;

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getActorLikes(likesParams);
        },
        'getActorLikes',
        { actor }
      );

      const posts: IAtpPost[] = response.data.feed.map((feedItem: any) =>
        this.transformPost(feedItem.post)
      );

      return {
        success: true,
        posts,
        cursor: response.data.cursor,
        hasMore: !!response.data.cursor,
        actor,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve likes feed', error);
      throw error;
    }
  }
}
