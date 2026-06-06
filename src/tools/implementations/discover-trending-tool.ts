/**
 * Discover Trending Tool - Discovers trending topics and posts in the user's network
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';

/**
 * Zod schema for discover trending parameters
 */
const DiscoverTrendingSchema = z.object({
  limit: z.number().int().min(10).max(100).optional().default(50),
  timeWindow: z.enum(['1h', '6h', '12h', '24h', '7d']).optional().default('24h'),
  includeHashtags: z.boolean().optional().default(true),
  includeTopics: z.boolean().optional().default(true),
  includePosts: z.boolean().optional().default(true),
});

interface ITrendingHashtag {
  tag: string;
  count: number;
  recentPosts: number;
  growth: number;
}

interface ITrendingTopic {
  topic: string;
  keywords: string[];
  postCount: number;
  engagementScore: number;
}

interface ITrendingPost {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
  };
  text: string;
  createdAt: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  trendingScore: number;
}

/**
 * Tool for discovering trending topics and posts in the user's network
 *
 * This tool analyzes the user's timeline and network to identify:
 * - Trending hashtags
 * - Emerging topics
 * - Viral posts
 * - Popular discussions
 *
 * AUTHENTICATION REQUIREMENT:
 * - Requires authentication (PRIVATE mode)
 * - Must have valid credentials to access timeline
 */
export class DiscoverTrendingTool extends BaseTool {
  public readonly schema = {
    method: 'discover_trending',
    description:
      'Surface frequently-used hashtags and notable posts from a sample of your own ' +
      'home timeline (up to the most recent ~100 posts). This is NOT a network-wide ' +
      "trending feed; 'growth' is a recency ratio within the sample, not real growth " +
      'over time. Requires authentication.',
    params: DiscoverTrendingSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'DiscoverTrending', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: {
    limit?: number;
    timeWindow?: '1h' | '6h' | '12h' | '24h' | '7d';
    includeHashtags?: boolean;
    includeTopics?: boolean;
    includePosts?: boolean;
  }): Promise<{
    success: boolean;
    timeWindow: string;
    trendingHashtags: ITrendingHashtag[];
    trendingTopics: ITrendingTopic[];
    trendingPosts: ITrendingPost[];
    summary: {
      totalPostsAnalyzed: number;
      uniqueAuthors: number;
      timeRange: { start: string; end: string };
    };
  }> {
    try {
      this.logger.info('Discovering trending content', {
        limit: params.limit,
        timeWindow: params.timeWindow,
      });

      // Calculate time cutoff based on window
      const now = new Date();
      const cutoffTime = this.getTimeCutoff(now, params.timeWindow || '24h');

      // Get timeline posts
      const agent = this.atpClient.getAgent();
      const timelineResponse = await this.executeAtpOperation(
        async () =>
          await agent.getTimeline({
            limit: params.limit || 50,
          }),
        'getTimeline',
        { limit: params.limit }
      );

      // Filter posts by time window
      const posts = timelineResponse.data.feed
        .map((item: any) => item.post)
        .filter((post: any) => {
          const postTime = new Date(post.record.createdAt);
          return postTime >= cutoffTime;
        });

      this.logger.debug('Filtered posts by time window', {
        totalPosts: timelineResponse.data.feed.length,
        filteredPosts: posts.length,
        cutoffTime: cutoffTime.toISOString(),
      });

      // Analyze hashtags
      const hashtagCounts = new Map<string, number>();
      const hashtagRecentPosts = new Map<string, number>();

      // Analyze topics and keywords
      const topicKeywords = new Map<string, Set<string>>();
      const topicEngagement = new Map<string, number>();

      // Track unique authors
      const uniqueAuthors = new Set<string>();

      // Analyze posts
      const postsWithScores: ITrendingPost[] = [];

      for (const post of posts) {
        uniqueAuthors.add(post.author.did);

        const text = post.record.text || '';
        const createdAt = new Date(post.record.createdAt);
        const ageHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

        // Extract hashtags
        if (params.includeHashtags) {
          const hashtags = this.extractHashtags(text);
          hashtags.forEach(tag => {
            hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1);
            if (ageHours <= 6) {
              hashtagRecentPosts.set(tag, (hashtagRecentPosts.get(tag) || 0) + 1);
            }
          });
        }

        // Extract topics (simple keyword extraction)
        if (params.includeTopics) {
          const keywords = this.extractKeywords(text);
          keywords.forEach(keyword => {
            if (!topicKeywords.has(keyword)) {
              topicKeywords.set(keyword, new Set());
            }
            topicKeywords.get(keyword)!.add(text.substring(0, 50));

            const engagement =
              (post.likeCount || 0) + (post.repostCount || 0) + (post.replyCount || 0);
            topicEngagement.set(keyword, (topicEngagement.get(keyword) || 0) + engagement);
          });
        }

        // Calculate trending score for posts
        if (params.includePosts) {
          const engagement =
            (post.likeCount || 0) + (post.repostCount || 0) + (post.replyCount || 0);
          // Boost recent posts
          const recencyBoost = Math.max(0, 1 - ageHours / 24);
          const trendingScore = engagement * (1 + recencyBoost);

          postsWithScores.push({
            uri: post.uri,
            cid: post.cid,
            author: {
              did: post.author.did,
              handle: post.author.handle,
              displayName: post.author.displayName,
            },
            text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
            createdAt: post.record.createdAt,
            likeCount: post.likeCount || 0,
            repostCount: post.repostCount || 0,
            replyCount: post.replyCount || 0,
            trendingScore,
          });
        }
      }

      // Process trending hashtags
      const trendingHashtags: ITrendingHashtag[] = Array.from(hashtagCounts.entries())
        .map(([tag, count]) => {
          const recentPosts = hashtagRecentPosts.get(tag) || 0;
          const growth = count > 0 ? recentPosts / count : 0;
          return { tag, count, recentPosts, growth };
        })
        .sort((a, b) => {
          // Sort by combination of count and growth
          const scoreA = a.count * (1 + a.growth);
          const scoreB = b.count * (1 + b.growth);
          return scoreB - scoreA;
        })
        .slice(0, 10);

      // Process trending topics
      const trendingTopics: ITrendingTopic[] = Array.from(topicKeywords.entries())
        .filter(([_, posts]) => posts.size >= 2) // At least 2 posts
        .map(([topic, posts]) => ({
          topic,
          keywords: Array.from(posts).slice(0, 3),
          postCount: posts.size,
          engagementScore: topicEngagement.get(topic) || 0,
        }))
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, 10);

      // Process trending posts
      const trendingPosts = postsWithScores
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, 10);

      const summary = {
        totalPostsAnalyzed: posts.length,
        uniqueAuthors: uniqueAuthors.size,
        timeRange: {
          start: cutoffTime.toISOString(),
          end: now.toISOString(),
        },
      };

      this.logger.info('Trending discovery completed', {
        hashtagsFound: trendingHashtags.length,
        topicsFound: trendingTopics.length,
        trendingPostsFound: trendingPosts.length,
        postsAnalyzed: posts.length,
      });

      return {
        success: true,
        timeWindow: params.timeWindow || '24h',
        trendingHashtags: params.includeHashtags ? trendingHashtags : [],
        trendingTopics: params.includeTopics ? trendingTopics : [],
        trendingPosts: params.includePosts ? trendingPosts : [],
        summary,
      };
    } catch (error) {
      this.logger.error('Failed to discover trending content', error);
      this.formatError(error);
    }
  }

  /**
   * Get time cutoff based on time window
   */
  private getTimeCutoff(now: Date, timeWindow: string): Date {
    const cutoff = new Date(now);
    switch (timeWindow) {
      case '1h':
        cutoff.setHours(cutoff.getHours() - 1);
        break;
      case '6h':
        cutoff.setHours(cutoff.getHours() - 6);
        break;
      case '12h':
        cutoff.setHours(cutoff.getHours() - 12);
        break;
      case '24h':
        cutoff.setHours(cutoff.getHours() - 24);
        break;
      case '7d':
        cutoff.setDate(cutoff.getDate() - 7);
        break;
    }
    return cutoff;
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
   * Extract keywords from text (simple implementation)
   */
  private extractKeywords(text: string): string[] {
    // Remove hashtags, mentions, and URLs
    const cleanText = text
      .replace(/#[\w]+/g, '')
      .replace(/@[\w.]+/g, '')
      .replace(/https?:\/\/[^\s]+/g, '')
      .toLowerCase();

    // Split into words and filter
    const words = cleanText.split(/\s+/);
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'as',
      'is',
      'was',
      'are',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'should',
      'could',
      'may',
      'might',
      'must',
      'can',
      'this',
      'that',
      'these',
      'those',
      'i',
      'you',
      'he',
      'she',
      'it',
      'we',
      'they',
    ]);

    return words
      .filter(word => word.length > 3 && !stopWords.has(word))
      .filter(word => /^[a-z]+$/.test(word))
      .slice(0, 5);
  }
}
