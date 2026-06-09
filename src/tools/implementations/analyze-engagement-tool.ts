/**
 * Analyze Engagement Tool - Analyzes engagement patterns across user's posts
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';

/**
 * Zod schema for analyze engagement parameters
 */
const AnalyzeEngagementSchema = z.object({
  actor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  includeReplies: z.boolean().optional().default(true),
});

interface IPostEngagement {
  uri: string;
  cid: string;
  text: string;
  createdAt: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  totalEngagement: number;
  engagementRate: number;
  isReply: boolean;
  hasMedia: boolean;
  hasLinks: boolean;
  textLength: number;
  hashtags: string[];
}

/**
 * Tool for analyzing engagement patterns across user's posts
 *
 * This tool retrieves recent posts and analyzes engagement metrics to help
 * users understand what content performs well. It provides insights on:
 * - Top performing posts
 * - Engagement trends
 * - Content patterns (media, links, hashtags)
 * - Optimal post characteristics
 *
 * AUTHENTICATION REQUIREMENT:
 * - Requires authentication (PRIVATE mode)
 * - Must have valid credentials to access author feed
 */
export class AnalyzeEngagementTool extends BaseTool {
  public readonly schema = {
    method: 'analyze_engagement',
    description:
      'Analyze engagement patterns across recent posts to identify what content performs well. Provides insights on likes, reposts, replies, and content characteristics. Requires authentication.',
    params: AnalyzeEngagementSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'AnalyzeEngagement', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: {
    actor?: string;
    limit?: number;
    includeReplies?: boolean;
  }): Promise<{
    success: boolean;
    summary: {
      totalPosts: number;
      totalLikes: number;
      totalReposts: number;
      totalReplies: number;
      averageLikes: number;
      averageReposts: number;
      averageReplies: number;
      averageEngagementRate: number;
    };
    topPosts: IPostEngagement[];
    insights: {
      bestPerformingType: string;
      optimalTextLength: { min: number; max: number };
      mediaImpact: { withMedia: number; withoutMedia: number };
      hashtagImpact: { withHashtags: number; withoutHashtags: number };
      topHashtags: Array<{ tag: string; avgEngagement: number; count: number }>;
    };
    recommendations: string[];
  }> {
    try {
      // Determine which actor to analyze (default to authenticated user)
      const agent = this.atpClient.getAgent();
      const actor = params.actor || agent.session?.did || '';

      if (!actor) {
        throw new Error('No actor specified and no authenticated session found');
      }

      this.logger.info('Analyzing engagement', {
        actor,
        limit: params.limit,
        includeReplies: params.includeReplies,
      });

      // Get author's recent posts
      const response = await this.executeAtpOperation(
        async () =>
          await agent.getAuthorFeed({
            actor,
            limit: params.limit || 50,
            filter: params.includeReplies ? 'posts_with_replies' : 'posts_no_replies',
          }),
        'getAuthorFeed',
        { actor, limit: params.limit }
      );

      // Transform and analyze posts
      const posts: IPostEngagement[] = response.data.feed.map((feedItem: any) => {
        const post = feedItem.post;
        const text = post.record.text || '';
        const hashtags = this.extractHashtags(text);
        const hasMedia = this.embedHasMedia(post.embed);
        const hasLinks = this.hasLinks(text);
        const isReply = !!post.record.reply;

        const likeCount = post.likeCount || 0;
        const repostCount = post.repostCount || 0;
        const replyCount = post.replyCount || 0;
        const totalEngagement = likeCount + repostCount + replyCount;

        // Calculate engagement rate (engagement per hour since posting)
        const createdAt = new Date(post.record.createdAt);
        const hoursSincePost = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        const engagementRate =
          hoursSincePost > 0 ? totalEngagement / hoursSincePost : totalEngagement;

        return {
          uri: post.uri,
          cid: post.cid,
          text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          createdAt: post.record.createdAt,
          likeCount,
          repostCount,
          replyCount,
          totalEngagement,
          engagementRate,
          isReply,
          hasMedia,
          hasLinks,
          textLength: text.length,
          hashtags,
        };
      });

      // Calculate summary statistics
      const totalPosts = posts.length;
      const totalLikes = posts.reduce((sum, p) => sum + p.likeCount, 0);
      const totalReposts = posts.reduce((sum, p) => sum + p.repostCount, 0);
      const totalReplies = posts.reduce((sum, p) => sum + p.replyCount, 0);

      const summary = {
        totalPosts,
        totalLikes,
        totalReposts,
        totalReplies,
        averageLikes: totalPosts > 0 ? totalLikes / totalPosts : 0,
        averageReposts: totalPosts > 0 ? totalReposts / totalPosts : 0,
        averageReplies: totalPosts > 0 ? totalReplies / totalPosts : 0,
        averageEngagementRate:
          totalPosts > 0 ? posts.reduce((sum, p) => sum + p.engagementRate, 0) / totalPosts : 0,
      };

      // Get top performing posts
      const topPosts = [...posts]
        .sort((a, b) => b.totalEngagement - a.totalEngagement)
        .slice(0, 10);

      // Analyze content patterns
      const postsWithMedia = posts.filter(p => p.hasMedia);
      const postsWithoutMedia = posts.filter(p => !p.hasMedia);
      const postsWithHashtags = posts.filter(p => p.hashtags.length > 0);
      const postsWithoutHashtags = posts.filter(p => p.hashtags.length === 0);

      const avgEngagementWithMedia =
        postsWithMedia.length > 0
          ? postsWithMedia.reduce((sum, p) => sum + p.totalEngagement, 0) / postsWithMedia.length
          : 0;
      const avgEngagementWithoutMedia =
        postsWithoutMedia.length > 0
          ? postsWithoutMedia.reduce((sum, p) => sum + p.totalEngagement, 0) /
            postsWithoutMedia.length
          : 0;

      const avgEngagementWithHashtags =
        postsWithHashtags.length > 0
          ? postsWithHashtags.reduce((sum, p) => sum + p.totalEngagement, 0) /
            postsWithHashtags.length
          : 0;
      const avgEngagementWithoutHashtags =
        postsWithoutHashtags.length > 0
          ? postsWithoutHashtags.reduce((sum, p) => sum + p.totalEngagement, 0) /
            postsWithoutHashtags.length
          : 0;

      // Analyze hashtag performance
      const hashtagStats = new Map<string, { total: number; count: number }>();
      posts.forEach(post => {
        post.hashtags.forEach(tag => {
          const stats = hashtagStats.get(tag) || { total: 0, count: 0 };
          stats.total += post.totalEngagement;
          stats.count += 1;
          hashtagStats.set(tag, stats);
        });
      });

      const topHashtags = Array.from(hashtagStats.entries())
        .map(([tag, stats]) => ({
          tag,
          avgEngagement: stats.total / stats.count,
          count: stats.count,
        }))
        .sort((a, b) => b.avgEngagement - a.avgEngagement)
        .slice(0, 5);

      // Determine optimal text length. Guard the empty case: Math.min()/Math.max()
      // over an empty array return Infinity/-Infinity, which would leak into the
      // response as nonsensical optimalTextLength on a feed with no posts.
      const sortedByEngagement = [...posts].sort((a, b) => b.totalEngagement - a.totalEngagement);
      const topPerformers = sortedByEngagement.slice(0, Math.ceil(posts.length * 0.2)); // Top 20%
      const textLengths = topPerformers.map(p => p.textLength);
      const optimalTextLength =
        textLengths.length > 0
          ? { min: Math.min(...textLengths), max: Math.max(...textLengths) }
          : { min: 0, max: 0 };

      // Determine best performing type
      const replies = posts.filter(p => p.isReply);
      const originalPosts = posts.filter(p => !p.isReply);
      const avgEngagementReplies =
        replies.length > 0
          ? replies.reduce((sum, p) => sum + p.totalEngagement, 0) / replies.length
          : 0;
      const avgEngagementOriginal =
        originalPosts.length > 0
          ? originalPosts.reduce((sum, p) => sum + p.totalEngagement, 0) / originalPosts.length
          : 0;

      const bestPerformingType =
        avgEngagementReplies > avgEngagementOriginal ? 'replies' : 'original posts';

      // Generate insights
      const insights = {
        bestPerformingType,
        optimalTextLength,
        mediaImpact: {
          withMedia: avgEngagementWithMedia,
          withoutMedia: avgEngagementWithoutMedia,
        },
        hashtagImpact: {
          withHashtags: avgEngagementWithHashtags,
          withoutHashtags: avgEngagementWithoutHashtags,
        },
        topHashtags,
      };

      // Generate recommendations
      const recommendations: string[] = [];

      if (avgEngagementWithMedia > avgEngagementWithoutMedia * 1.2) {
        recommendations.push(
          'Posts with media get significantly more engagement. Consider adding images or videos.'
        );
      }

      if (avgEngagementWithHashtags > avgEngagementWithoutHashtags * 1.2) {
        recommendations.push(
          'Posts with hashtags perform better. Use relevant hashtags to increase discoverability.'
        );
      }

      if (topHashtags.length > 0) {
        recommendations.push(
          `Your top performing hashtags are: ${topHashtags.map(h => h.tag).join(', ')}`
        );
      }

      if (optimalTextLength.min > 0 && optimalTextLength.max > 0) {
        recommendations.push(
          `Your best performing posts are between ${optimalTextLength.min}-${optimalTextLength.max} characters.`
        );
      }

      if (bestPerformingType === 'replies') {
        recommendations.push(
          'Your replies get more engagement than original posts. Consider engaging more in conversations.'
        );
      }

      this.logger.info('Engagement analysis completed', {
        totalPosts,
        totalEngagement: totalLikes + totalReposts + totalReplies,
        topPostEngagement: topPosts[0]?.totalEngagement || 0,
      });

      return {
        success: true,
        summary,
        topPosts,
        insights,
        recommendations,
      };
    } catch (error) {
      this.logger.error('Failed to analyze engagement', error);
      this.formatError(error);
    }
  }

  /**
   * Detect whether a post's embed VIEW carries media (images or video). The
   * embed on a feed item is a #view (e.g. app.bsky.embed.video#view), so we must
   * key off `$type` — the old check probed record-level property names that do
   * not exist on the view, so it missed video and recordWithMedia entirely.
   */
  private embedHasMedia(embed: any): boolean {
    const type = embed?.$type;
    if (type === 'app.bsky.embed.images#view' || type === 'app.bsky.embed.video#view') {
      return true;
    }
    if (type === 'app.bsky.embed.recordWithMedia#view') {
      const mediaType = embed?.media?.$type;
      return (
        mediaType === 'app.bsky.embed.images#view' || mediaType === 'app.bsky.embed.video#view'
      );
    }
    return false;
  }

  /**
   * Extract hashtags from text
   */
  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#[\w]+/g;
    const matches = text.match(hashtagRegex);
    return matches || [];
  }

  /**
   * Check if text contains links
   */
  private hasLinks(text: string): boolean {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return urlRegex.test(text);
  }
}
