/**
 * Composite Tools - Combine multiple operations into single calls
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import type { IAtpPost, IAtpProfile } from '../../types/index.js';

/**
 * Map a post view to the internal IAtpPost shape (record passed through as-is).
 * Shared by the composite tools so they don't each carry an identical copy.
 */
function toAtpPost(post: any): IAtpPost {
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

/**
 * Zod schema for get user summary parameters
 */
const GetUserSummarySchema = z.object({
  actor: z
    .string()
    .min(1, 'Actor (DID or handle) is required')
    .describe('Handle (e.g. alice.bsky.social) or DID of the target account.'),
  includeRecentPosts: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to include recent posts in the response. Default true.'),
  postLimit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe(
      'Number of recent posts to fetch (1–50, default 10). Only used when includeRecentPosts or includeEngagementStats is true.'
    ),
  includeEngagementStats: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'Whether to compute engagement statistics (avg likes, reposts, replies) over the recent posts. Default true.'
    ),
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
      'Get comprehensive user information in a single call, combining profile, recent posts, and engagement statistics. Works without authentication; richer with auth. Use get_user_profile for just the profile or get_author_feed for posts alone; use this tool when you need both in one round-trip. Subject to per-tool rate limiting.',
    params: GetUserSummarySchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the summary was retrieved successfully.',
        },
        profile: {
          type: 'object',
          description:
            "The user's full profile, including optional viewer context when authenticated.",
          properties: {
            did: { type: 'string', description: "The user's DID." },
            handle: { type: 'string', description: "The user's handle." },
            displayName: { type: 'string', description: "The user's display name." },
            avatar: { type: 'string', description: 'URL to the avatar image.' },
            description: { type: 'string', description: 'Profile bio.' },
            followersCount: { type: 'number', description: 'Number of followers.' },
            followsCount: { type: 'number', description: 'Number of accounts followed.' },
            postsCount: { type: 'number', description: 'Total number of posts.' },
            indexedAt: {
              type: 'string',
              description: 'ISO timestamp when the profile was first indexed.',
            },
            viewer: {
              type: 'object',
              description:
                'Viewer relationship context (muted, blocking, following, etc.) — only present when authenticated.',
              properties: {
                muted: {
                  type: 'boolean',
                  description: 'Whether the authenticated user has muted this account.',
                },
                blockedBy: {
                  type: 'boolean',
                  description: 'Whether this account has blocked the authenticated user.',
                },
                blocking: {
                  type: 'string',
                  description:
                    'AT-URI of the block record if the authenticated user is blocking this account.',
                },
                following: {
                  type: 'string',
                  description:
                    'AT-URI of the follow record if the authenticated user follows this account.',
                },
                followedBy: {
                  type: 'string',
                  description:
                    'AT-URI of the follow record if this account follows the authenticated user.',
                },
              },
            },
          },
          required: ['did', 'handle'],
        },
        recentPosts: {
          type: 'array',
          description: 'Recent posts (present when includeRecentPosts is true).',
          items: { type: 'object', description: 'Normalized post view.' },
        },
        engagementStats: {
          type: 'object',
          description:
            'Engagement statistics computed over the fetched posts (present when includeEngagementStats is true).',
          properties: {
            totalPosts: { type: 'number', description: 'Number of posts analysed.' },
            totalLikes: { type: 'number', description: 'Sum of likes across analysed posts.' },
            totalReposts: { type: 'number', description: 'Sum of reposts across analysed posts.' },
            totalReplies: { type: 'number', description: 'Sum of replies across analysed posts.' },
            averageLikesPerPost: { type: 'number', description: 'Mean likes per post.' },
            averageRepostsPerPost: { type: 'number', description: 'Mean reposts per post.' },
            averageRepliesPerPost: { type: 'number', description: 'Mean replies per post.' },
            mostLikedPost: { type: 'object', description: 'The post with the highest like count.' },
            mostRepostedPost: {
              type: 'object',
              description: 'The post with the highest repost count.',
            },
          },
          required: [
            'totalPosts',
            'totalLikes',
            'totalReposts',
            'totalReplies',
            'averageLikesPerPost',
            'averageRepostsPerPost',
            'averageRepliesPerPost',
          ],
        },
        summary: {
          type: 'object',
          description: 'Condensed key metrics for quick consumption.',
          properties: {
            handle: { type: 'string', description: "The user's handle." },
            displayName: { type: 'string', description: "The user's display name." },
            followersCount: { type: 'number', description: 'Follower count.' },
            followsCount: { type: 'number', description: 'Following count.' },
            postsCount: { type: 'number', description: 'Total post count.' },
            isAuthenticated: {
              type: 'boolean',
              description: 'Whether the current session is authenticated.',
            },
          },
          required: ['handle', 'followersCount', 'followsCount', 'postsCount', 'isAuthenticated'],
        },
      },
      required: ['success', 'profile', 'summary'],
    },
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

        const posts = feedResponse.data.feed.map((item: any) => toAtpPost(item.post));

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
}

/**
 * Zod schema for get post context parameters
 */
const GetPostContextSchema = z.object({
  uri: z.string().min(1, 'Post URI is required').describe('AT-URI of the post to read (at://...).'),
  includeThread: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include thread context (parent chain, root, and replies). Default true.'),
  includeAuthorProfile: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include the post author's full profile. Default true."),
  includeEngagement: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'Include computed engagement metrics (likes, reposts, replies, rate, age). Default true.'
    ),
  depth: z
    .number()
    .int()
    .min(0)
    .max(10)
    .optional()
    .describe('How many levels of replies to fetch (0–10, default 6).'),
  parentHeight: z
    .number()
    .int()
    .min(0)
    .max(80)
    .optional()
    .describe('How many parent posts up the chain to fetch (0–80, default 80).'),
  includeMedia: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Extract media embeds (images, videos, external links, quote posts) from the post. Default false.'
    ),
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
      'Get comprehensive post information in a single call. Single post reader: use include* ' +
      'flags for thread, author, engagement, and media. Replaces the former get_thread and ' +
      'extract_media_from_post tools. Works without authentication; richer with auth. Subject ' +
      'to per-tool rate limiting.',
    params: GetPostContextSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the post context was retrieved.' },
        post: {
          type: 'object',
          description: 'The requested post (normalized post view).',
        },
        thread: {
          type: 'object',
          description:
            'Thread context (present when includeThread is true): the immediate parent, the ' +
            'true thread root, the direct replies, and the parent-chain depth.',
          properties: {
            parent: { type: 'object', description: 'The immediate parent post, if any.' },
            root: { type: 'object', description: 'The topmost ancestor (true thread root).' },
            replies: {
              type: 'array',
              description: 'Direct replies to the post.',
              items: { type: 'object' },
            },
            depth: {
              type: 'number',
              description: 'Number of ancestors between the post and the thread root.',
            },
          },
        },
        authorProfile: {
          type: 'object',
          description:
            "The post author's full profile (present when includeAuthorProfile is true).",
        },
        engagement: {
          type: 'object',
          description: 'Computed engagement metrics (present when includeEngagement is true).',
          properties: {
            likeCount: { type: 'number', description: 'Number of likes.' },
            repostCount: { type: 'number', description: 'Number of reposts.' },
            replyCount: { type: 'number', description: 'Number of replies.' },
            totalEngagement: {
              type: 'number',
              description: 'Sum of likes, reposts, and replies.',
            },
            engagementRate: {
              type: 'number',
              description: 'Total engagement per hour since the post was created.',
            },
            ageHours: { type: 'number', description: 'Age of the post in hours.' },
          },
        },
        media: {
          type: 'object',
          description: 'Media embeds extracted from the post (present when includeMedia is true).',
          properties: {
            images: {
              type: 'array',
              description: 'Image embeds with alt text and aspect ratio.',
              items: { type: 'object' },
            },
            videos: {
              type: 'array',
              description: 'Video embeds with alt text and aspect ratio.',
              items: { type: 'object' },
            },
            externalLinks: {
              type: 'array',
              description: 'External link cards (uri, title, description, thumb).',
              items: { type: 'object' },
            },
            quotePosts: {
              type: 'array',
              description: 'Quoted posts referenced by record embeds (uri, cid).',
              items: { type: 'object' },
            },
          },
          required: ['images', 'videos', 'externalLinks', 'quotePosts'],
        },
      },
      required: ['success', 'post'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'GetPostContext', ToolAuthMode.ENHANCED);
  }

  protected async execute(params: {
    uri: string;
    includeThread?: boolean;
    includeAuthorProfile?: boolean;
    includeEngagement?: boolean;
    depth?: number;
    parentHeight?: number;
    includeMedia?: boolean;
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
    media?: {
      images: any[];
      videos: any[];
      externalLinks: any[];
      quotePosts: any[];
    };
  }> {
    try {
      this.logger.info('Getting post context', {
        uri: params.uri,
        includeThread: params.includeThread,
        includeAuthorProfile: params.includeAuthorProfile,
        includeEngagement: params.includeEngagement,
        includeMedia: params.includeMedia,
        depth: params.depth,
        parentHeight: params.parentHeight,
      });

      // Validate the URI
      this.validateAtUri(params.uri);

      // Get the post and thread. depth/parentHeight control how much of the
      // conversation getPostThread returns; fall back to the former get_thread
      // defaults (6 / 80) when the caller omits them.
      const threadResponse = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getPostThread({
            uri: params.uri,
            depth: params.depth ?? 6,
            parentHeight: params.parentHeight ?? 80,
          });
        },
        'getPostThread',
        { uri: params.uri }
      );

      const threadData = threadResponse.data.thread as any;

      // Check if thread is valid (not NotFoundPost or BlockedPost)
      if (!threadData.post) {
        throw new Error('Post not found or blocked');
      }

      const post = toAtpPost(threadData.post);

      // Extract thread information
      let thread: any | undefined;
      if (params.includeThread) {
        const parent = threadData.parent?.post ? toAtpPost(threadData.parent.post) : undefined;

        // Walk the full parent chain: the true root is the topmost ancestor (not
        // the grandparent), and depth is the number of ancestors (the thread view
        // carries no `depth` field, so the old `threadData.depth || 0` was always 0).
        let depth = 0;
        let rootNode: any = threadData;
        let ancestor: any = threadData.parent;
        while (ancestor?.post) {
          depth++;
          rootNode = ancestor;
          ancestor = ancestor.parent;
        }
        const root = rootNode.post ? toAtpPost(rootNode.post) : parent;

        const replies = (threadData.replies || [])
          .filter((r: any) => r.post)
          .map((r: any) => toAtpPost(r.post));

        thread = {
          parent,
          root,
          replies,
          depth,
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

      // Extract media embeds if requested (ported from the former
      // extract_media_from_post tool). Operates on the raw thread post view so
      // the embed `#view` shapes are available.
      let media:
        | { images: any[]; videos: any[]; externalLinks: any[]; quotePosts: any[] }
        | undefined;
      if (params.includeMedia) {
        media = extractMediaFromPost(threadData.post);
      }

      this.logger.info('Post context retrieved successfully', {
        uri: params.uri,
        hasThread: !!thread,
        hasAuthorProfile: !!authorProfile,
        hasEngagement: !!engagement,
        hasMedia: !!media,
      });

      return {
        success: true,
        post,
        ...(thread && { thread }),
        ...(authorProfile && { authorProfile }),
        ...(engagement && { engagement }),
        ...(media && { media }),
      };
    } catch (error) {
      this.logger.error('Failed to get post context', error);
      this.formatError(error);
    }
  }
}

/**
 * Extract media embeds from a single post view's `embed` field. Ported from the
 * former ExtractMediaFromPostTool so get_post_context is the single post reader.
 *
 * Handles the AppView `#view` embed shapes: images, video, external link cards,
 * record (quote post), and recordWithMedia (quote post + attached media).
 */
function extractMediaFromPost(post: any): {
  images: any[];
  videos: any[];
  externalLinks: any[];
  quotePosts: any[];
} {
  const images: any[] = [];
  const videos: any[] = [];
  const externalLinks: any[] = [];
  const quotePosts: any[] = [];

  const embed = post?.embed;
  if (!embed) {
    return { images, videos, externalLinks, quotePosts };
  }

  const embedType = embed.$type;

  // Images embed
  if (embedType === 'app.bsky.embed.images#view') {
    for (const image of embed.images || []) {
      images.push({
        uri: image.fullsize,
        alt: image.alt,
        aspectRatio: image.aspectRatio,
        thumb: image.thumb,
      });
    }
  }

  // Video embed
  if (embedType === 'app.bsky.embed.video#view') {
    videos.push({
      uri: embed.playlist,
      alt: embed.alt,
      aspectRatio: embed.aspectRatio,
      thumbnail: embed.thumbnail,
    });
  }

  // External link embed
  if (embedType === 'app.bsky.embed.external#view') {
    externalLinks.push({
      uri: embed.external.uri,
      title: embed.external.title,
      description: embed.external.description,
      thumb: embed.external.thumb,
    });
  }

  // Quote post embed
  if (embedType === 'app.bsky.embed.record#view') {
    if (embed.record?.uri && embed.record?.cid) {
      quotePosts.push({
        uri: embed.record.uri,
        cid: embed.record.cid,
      });
    }
  }

  // Record with media (quote post with attached images/video/external)
  if (embedType === 'app.bsky.embed.recordWithMedia#view') {
    // Extract the quote post
    if (embed.record?.record?.uri && embed.record?.record?.cid) {
      quotePosts.push({
        uri: embed.record.record.uri,
        cid: embed.record.record.cid,
      });
    }

    // Extract the attached media
    if (embed.media) {
      const mediaType = embed.media.$type;

      if (mediaType === 'app.bsky.embed.images#view') {
        for (const image of embed.media.images || []) {
          images.push({
            uri: image.fullsize,
            alt: image.alt,
            aspectRatio: image.aspectRatio,
            thumb: image.thumb,
          });
        }
      }

      if (mediaType === 'app.bsky.embed.video#view') {
        videos.push({
          uri: embed.media.playlist,
          alt: embed.media.alt,
          aspectRatio: embed.media.aspectRatio,
          thumbnail: embed.media.thumbnail,
        });
      }

      if (mediaType === 'app.bsky.embed.external#view') {
        externalLinks.push({
          uri: embed.media.external.uri,
          title: embed.media.external.title,
          description: embed.media.external.description,
          thumb: embed.media.external.thumb,
        });
      }
    }
  }

  return { images, videos, externalLinks, quotePosts };
}
