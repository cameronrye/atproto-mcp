/**
 * Composite Tools - Combine multiple operations into single calls
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import type { IAtpPost, IAtpProfile } from '../../types/index.js';

/**
 * Zod schema for get user summary parameters
 */
const GetUserSummarySchema = z.object({
  actor: z.string().min(1, 'Actor (DID or handle) is required'),
  includeRecentPosts: z.boolean().optional().default(true),
  postLimit: z.number().int().min(1).max(50).optional().default(10),
  includeEngagementStats: z.boolean().optional().default(true),
});

/**
 * Get User Summary Tool - Get comprehensive user information in one call
 *
 * This composite tool combines multiple API calls to provide a complete
 * user summary including:
 * - User profile information
 * - Recent posts
 * - Engagement statistics
 * - Follower/following counts
 *
 * AUTHENTICATION REQUIREMENT:
 * - Enhanced mode (works better with authentication)
 * - Public data available without auth
 * - Additional viewer context with auth
 */
export class GetUserSummaryTool extends BaseTool {
  public readonly schema = {
    method: 'get_user_summary',
    description:
      'Get comprehensive user information in a single call. Includes profile, recent posts, and engagement statistics. Works without authentication but provides more data when authenticated.',
    params: GetUserSummarySchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'GetUserSummary', ToolAuthMode.ENHANCED);
  }

  protected async execute(params: {
    actor: string;
    includeRecentPosts?: boolean;
    postLimit?: number;
    includeEngagementStats?: boolean;
  }): Promise<{
    success: boolean;
    profile: IAtpProfile & {
      indexedAt?: string;
      viewer?: {
        muted?: boolean;
        blockedBy?: boolean;
        blocking?: string;
        following?: string;
        followedBy?: string;
      };
    };
    recentPosts?: IAtpPost[];
    engagementStats?: {
      totalPosts: number;
      totalLikes: number;
      totalReposts: number;
      totalReplies: number;
      averageLikesPerPost: number;
      averageRepostsPerPost: number;
      averageRepliesPerPost: number;
      mostLikedPost?: IAtpPost;
      mostRepostedPost?: IAtpPost;
    };
    summary: {
      handle: string;
      displayName?: string;
      followersCount: number;
      followsCount: number;
      postsCount: number;
      isAuthenticated: boolean;
    };
  }> {
    try {
      this.logger.info('Getting user summary', {
        actor: params.actor,
        includeRecentPosts: params.includeRecentPosts,
        includeEngagementStats: params.includeEngagementStats,
      });

      // Validate the actor identifier
      this.validateActor(params.actor);

      // Get user profile
      const profileResponse = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getProfile({ actor: params.actor });
        },
        'getProfile',
        { actor: params.actor }
      );

      const profile = profileResponse.data;

      // Get recent posts if requested
      let recentPosts: IAtpPost[] | undefined;
      let engagementStats: any | undefined;

      if (params.includeRecentPosts || params.includeEngagementStats) {
        const feedResponse = await this.executeAtpOperation(
          async () => {
            const agent = this.atpClient.getAgent();
            return await agent.getAuthorFeed({
              actor: params.actor,
              limit: params.postLimit || 10,
              filter: 'posts_no_replies',
            });
          },
          'getAuthorFeed',
          { actor: params.actor, limit: params.postLimit }
        );

        const posts = feedResponse.data.feed.map((item: any) => this.transformPost(item.post));

        if (params.includeRecentPosts) {
          recentPosts = posts;
        }

        if (params.includeEngagementStats && posts.length > 0) {
          const totalLikes = posts.reduce((sum, p) => sum + (p.likeCount || 0), 0);
          const totalReposts = posts.reduce((sum, p) => sum + (p.repostCount || 0), 0);
          const totalReplies = posts.reduce((sum, p) => sum + (p.replyCount || 0), 0);

          const mostLikedPost = [...posts].sort(
            (a, b) => (b.likeCount || 0) - (a.likeCount || 0)
          )[0];
          const mostRepostedPost = [...posts].sort(
            (a, b) => (b.repostCount || 0) - (a.repostCount || 0)
          )[0];

          engagementStats = {
            totalPosts: posts.length,
            totalLikes,
            totalReposts,
            totalReplies,
            averageLikesPerPost: totalLikes / posts.length,
            averageRepostsPerPost: totalReposts / posts.length,
            averageRepliesPerPost: totalReplies / posts.length,
            mostLikedPost,
            mostRepostedPost,
          };
        }
      }

      const summary = {
        handle: profile.handle,
        displayName: profile.displayName,
        followersCount: profile.followersCount || 0,
        followsCount: profile.followsCount || 0,
        postsCount: profile.postsCount || 0,
        isAuthenticated: this.atpClient.isAuthenticated(),
      };

      this.logger.info('User summary retrieved successfully', {
        actor: params.actor,
        postsCount: recentPosts?.length || 0,
        hasEngagementStats: !!engagementStats,
      });

      return {
        success: true,
        profile,
        ...(recentPosts && { recentPosts }),
        ...(engagementStats && { engagementStats }),
        summary,
      };
    } catch (error) {
      this.logger.error('Failed to get user summary', error);
      this.formatError(error);
    }
  }

  /**
   * Transform post data to internal interface
   */
  private transformPost(post: any): IAtpPost {
    return {
      uri: post.uri,
      cid: post.cid,
      author: {
        did: post.author.did,
        handle: post.author.handle,
        displayName: post.author.displayName,
        avatar: post.author.avatar,
        description: post.author.description,
        followersCount: post.author.followersCount,
        followsCount: post.author.followsCount,
        postsCount: post.author.postsCount,
      },
      record: post.record,
      replyCount: post.replyCount,
      repostCount: post.repostCount,
      likeCount: post.likeCount,
      indexedAt: post.indexedAt,
      ...(post.viewer && { viewer: post.viewer }),
    };
  }
}

/**
 * Zod schema for get post context parameters
 */
const GetPostContextSchema = z.object({
  uri: z.string().min(1, 'Post URI is required'),
  includeThread: z.boolean().optional().default(true),
  includeAuthorProfile: z.boolean().optional().default(true),
  includeEngagement: z.boolean().optional().default(true),
});

/**
 * Get Post Context Tool - Get comprehensive post information in one call
 *
 * This composite tool combines multiple API calls to provide complete
 * post context including:
 * - The post itself
 * - Thread context (parent and replies)
 * - Author profile
 * - Engagement metrics
 *
 * AUTHENTICATION REQUIREMENT:
 * - Enhanced mode (works better with authentication)
 * - Public data available without auth
 * - Additional viewer context with auth
 */
export class GetPostContextTool extends BaseTool {
  public readonly schema = {
    method: 'get_post_context',
    description:
      'Get comprehensive post information in a single call. Includes the post, thread context, author profile, and engagement metrics. Works without authentication but provides more data when authenticated.',
    params: GetPostContextSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'GetPostContext', ToolAuthMode.ENHANCED);
  }

  protected async execute(params: {
    uri: string;
    includeThread?: boolean;
    includeAuthorProfile?: boolean;
    includeEngagement?: boolean;
  }): Promise<{
    success: boolean;
    post: IAtpPost;
    thread?: {
      parent?: IAtpPost;
      root?: IAtpPost;
      replies: IAtpPost[];
      depth: number;
    };
    authorProfile?: IAtpProfile;
    engagement?: {
      likeCount: number;
      repostCount: number;
      replyCount: number;
      totalEngagement: number;
      engagementRate: number;
      ageHours: number;
    };
  }> {
    try {
      this.logger.info('Getting post context', {
        uri: params.uri,
        includeThread: params.includeThread,
        includeAuthorProfile: params.includeAuthorProfile,
        includeEngagement: params.includeEngagement,
      });

      // Validate the URI
      this.validateAtUri(params.uri);

      // Get the post and thread
      const threadResponse = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getPostThread({ uri: params.uri });
        },
        'getPostThread',
        { uri: params.uri }
      );

      const threadData = threadResponse.data.thread as any;

      // Check if thread is valid (not NotFoundPost or BlockedPost)
      if (!threadData.post) {
        throw new Error('Post not found or blocked');
      }

      const post = this.transformPost(threadData.post);

      // Extract thread information
      let thread: any | undefined;
      if (params.includeThread) {
        const parent = threadData.parent?.post
          ? this.transformPost(threadData.parent.post)
          : undefined;
        const root = threadData.parent?.parent?.post
          ? this.transformPost(threadData.parent.parent.post)
          : parent;

        const replies = (threadData.replies || [])
          .filter((r: any) => r.post)
          .map((r: any) => this.transformPost(r.post));

        thread = {
          parent,
          root,
          replies,
          depth: threadData.depth || 0,
        };
      }

      // Get author profile if requested
      let authorProfile: any | undefined;
      if (params.includeAuthorProfile) {
        const profileResponse = await this.executeAtpOperation(
          async () => {
            const agent = this.atpClient.getAgent();
            return await agent.getProfile({ actor: post.author.did });
          },
          'getProfile',
          { actor: post.author.did }
        );

        authorProfile = profileResponse.data;
      }

      // Calculate engagement metrics if requested
      let engagement: any | undefined;
      if (params.includeEngagement) {
        const likeCount = post.likeCount || 0;
        const repostCount = post.repostCount || 0;
        const replyCount = post.replyCount || 0;
        const totalEngagement = likeCount + repostCount + replyCount;

        const createdAt = new Date(post.record.createdAt);
        const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        const engagementRate = ageHours > 0 ? totalEngagement / ageHours : totalEngagement;

        engagement = {
          likeCount,
          repostCount,
          replyCount,
          totalEngagement,
          engagementRate,
          ageHours,
        };
      }

      this.logger.info('Post context retrieved successfully', {
        uri: params.uri,
        hasThread: !!thread,
        hasAuthorProfile: !!authorProfile,
        hasEngagement: !!engagement,
      });

      return {
        success: true,
        post,
        ...(thread && { thread }),
        ...(authorProfile && { authorProfile }),
        ...(engagement && { engagement }),
      };
    } catch (error) {
      this.logger.error('Failed to get post context', error);
      this.formatError(error);
    }
  }

  /**
   * Transform post data to internal interface
   */
  private transformPost(post: any): IAtpPost {
    return {
      uri: post.uri,
      cid: post.cid,
      author: {
        did: post.author.did,
        handle: post.author.handle,
        displayName: post.author.displayName,
        avatar: post.author.avatar,
        description: post.author.description,
        followersCount: post.author.followersCount,
        followsCount: post.author.followsCount,
        postsCount: post.author.postsCount,
      },
      record: post.record,
      replyCount: post.replyCount,
      repostCount: post.repostCount,
      likeCount: post.likeCount,
      indexedAt: post.indexedAt,
      ...(post.viewer && { viewer: post.viewer }),
    };
  }
}
