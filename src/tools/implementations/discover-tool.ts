/**
 * Discover Tool - One faceted, timeline-driven discovery tool.
 *
 * Merges the former discover_trending and recommend_content tools into a single
 * tool selected by `mode`. Each mode's logic is ported verbatim from the
 * original tool:
 *   - trending: surfaces frequently-used hashtags/topics and notable posts from a
 *     sample of the caller's home timeline (former discover_trending).
 *   - recommended: scores posts you're likely to engage with from your timeline
 *     (former recommend_content).
 *
 * For finding accounts similar to a given user use find_similar_users; for
 * topic-based communities use discover_communities.
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';

/**
 * Zod schema for discover parameters.
 *
 * Only the four documented fields are advertised. The schema uses `.passthrough()`
 * so each ported mode's internal knobs (e.g. includeHashtags, excludeReposts,
 * topics) still reach the ported methods unchanged while validation of the public
 * surface stays clean; each old tool's defaults are applied inside the ported
 * method.
 */
const DiscoverSchema = z
  .object({
    mode: z
      .enum(['trending', 'recommended'])
      .describe(
        "What to surface from your timeline: 'trending' = trending topics/hashtags; " +
          "'recommended' = posts you're likely to engage with."
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('How many items to return (1–100, default per mode).'),
    timeWindow: z
      .enum(['1h', '6h', '12h', '24h', '7d'])
      .optional()
      .describe('Lookback window. Only used when mode=trending (default 24h).'),
    actor: z
      .string()
      .optional()
      .describe(
        'Optional account to tailor recommendations to. Only used when mode=recommended; ' +
          'defaults to the authenticated user.'
      ),
  })
  .passthrough();

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
 * One timeline-driven discovery tool selected by `mode`.
 *
 * - trending: trending hashtags/topics and notable posts (former discover_trending)
 * - recommended: posts you're likely to engage with (former recommend_content)
 *
 * AUTHENTICATION REQUIREMENT:
 * - Requires authentication (app password); PRIVATE mode (both originals required it).
 * - Read-only: performs no writes.
 */
export class DiscoverTool extends BaseTool {
  public readonly schema = {
    method: 'discover',
    description:
      'Surface content from your own home timeline. Requires authentication (app password). ' +
      'Read-only: performs no writes. Two timeline-driven discovery modes. For finding ' +
      'accounts similar to a given user use find_similar_users; for topic-based communities ' +
      'use discover_communities. Subject to per-tool rate limiting.',
    params: DiscoverSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        mode: {
          type: 'string',
          enum: ['trending', 'recommended'],
          description: 'Which discovery mode was run.',
        },
        insights: {
          description: 'Discovery insights (shape varies by mode).',
        },
      },
      required: ['success', 'mode'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'Discover', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: {
    mode: 'trending' | 'recommended';
    limit?: number;
    timeWindow?: '1h' | '6h' | '12h' | '24h' | '7d';
    actor?: string;
    [key: string]: unknown;
  }): Promise<Record<string, unknown>> {
    switch (params.mode) {
      case 'trending': {
        const result = await this.discoverTrending(params);
        return { mode: 'trending', ...result };
      }
      case 'recommended': {
        const result = await this.recommendContent(params);
        return { mode: 'recommended', ...result };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Trending mode (ported verbatim from DiscoverTrendingTool.execute)
  // ---------------------------------------------------------------------------

  private async discoverTrending(params: {
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
    // Apply the former discover_trending defaults inside the ported method.
    const includeHashtags = params.includeHashtags ?? true;
    const includeTopics = params.includeTopics ?? true;
    const includePosts = params.includePosts ?? true;
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
        if (includeHashtags) {
          const hashtags = this.extractHashtags(text);
          hashtags.forEach(tag => {
            hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1);
            if (ageHours <= 6) {
              hashtagRecentPosts.set(tag, (hashtagRecentPosts.get(tag) || 0) + 1);
            }
          });
        }

        // Extract topics (simple keyword extraction)
        if (includeTopics) {
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
        if (includePosts) {
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
        trendingHashtags: includeHashtags ? trendingHashtags : [],
        trendingTopics: includeTopics ? trendingTopics : [],
        trendingPosts: includePosts ? trendingPosts : [],
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

  // ---------------------------------------------------------------------------
  // Recommended mode (ported verbatim from RecommendContentTool.execute)
  // ---------------------------------------------------------------------------

  private async recommendContent(params: {
    actor?: string;
    limit?: number;
    maxResults?: number;
    minLikes?: number;
    maxAge?: number;
    topics?: string[];
    excludeReposts?: boolean;
  }): Promise<{
    success: boolean;
    recommendations: Array<{
      uri: string;
      cid: string;
      author: {
        did: string;
        handle: string;
        displayName?: string;
        avatar?: string;
      };
      text: string;
      likeCount: number;
      replyCount: number;
      repostCount: number;
      indexedAt: string;
      recommendationScore: number;
      recommendationReasons: string[];
      topics?: string[];
    }>;
    insights: string[];
  }> {
    // Apply the former recommend_content defaults inside the ported method. The
    // shared `limit` maps onto the old `maxResults`.
    const maxResults = params.limit ?? params.maxResults ?? 20;
    const minLikes = params.minLikes ?? 5;
    const maxAge = params.maxAge ?? 24;
    const excludeReposts = params.excludeReposts ?? false;
    const topics = params.topics;
    try {
      this.logger.info('Generating content recommendations', {
        maxResults,
        topics,
      });

      const agent = this.atpClient.getAgent();

      // Get user's timeline to understand their network
      const timelineResponse = await this.executeAtpOperation(
        async () => agent.getTimeline({ limit: 100 }),
        'getTimeline',
        { limit: 100 }
      );

      // The repost indicator lives on the feed item's `reason`
      // (app.bsky.feed.defs#reasonRepost), not on the post record — preserve it so
      // excludeReposts can actually filter reposts.
      const timelinePosts = timelineResponse.data.feed.map((item: any) => ({
        ...item.post,
        __isRepost: item.reason?.$type === 'app.bsky.feed.defs#reasonRepost',
      }));

      // Get user's recent likes to understand preferences
      const likedTopics = new Set<string>();
      const likedAuthors = new Set<string>();

      try {
        await this.executeAtpOperation(
          async () => agent.getProfile({ actor: params.actor || agent.session?.did || '' }),
          'getProfile',
          {}
        );

        // Note: AT Protocol doesn't have a direct "get my likes" endpoint
        // We'll infer from timeline engagement instead
        for (const post of timelinePosts) {
          if (post.viewer?.like) {
            likedAuthors.add(post.author.did);
            const topics = this.extractTopics([post]);
            topics.forEach(t => likedTopics.add(t));
          }
        }
      } catch (error) {
        this.logger.warn('Could not analyze user preferences', error);
      }

      // Filter and score posts
      const now = new Date();
      const maxAgeMs = maxAge * 60 * 60 * 1000;
      const recommendations = [];

      for (const post of timelinePosts) {
        const postData = post;

        // Skip if already liked
        if (postData.viewer?.like) continue;

        // Skip reposts if requested (flag derived from the feed item's reason).
        if (excludeReposts && postData.__isRepost) continue;

        // Check age
        const postAge = now.getTime() - new Date(postData.indexedAt).getTime();
        if (postAge > maxAgeMs) continue;

        // Check minimum likes
        const likeCount = postData.likeCount || 0;
        if (likeCount < minLikes) continue;

        // Extract topics from post
        const postTopics = Array.from(this.extractTopics([post]));

        // Check topic filter. Match each requested topic against BOTH the post's
        // hashtags and its text body — most Bluesky posts have no hashtags, so a
        // hashtag-only filter dropped the majority of genuinely on-topic posts.
        if (topics && topics.length > 0) {
          const postText = (postData.record?.text || '').toLowerCase();
          const hasMatchingTopic = topics.some(filter => {
            const f = filter.toLowerCase();
            return postTopics.some(topic => topic.includes(f)) || postText.includes(f);
          });
          if (!hasMatchingTopic) continue;
        }

        // Calculate recommendation score
        let score = 0;
        const reasons: string[] = [];

        // Engagement score
        const engagementScore =
          likeCount * 1 + (postData.replyCount || 0) * 2 + (postData.repostCount || 0) * 1.5;
        score += Math.min(engagementScore, 100);
        if (likeCount >= minLikes * 2) {
          reasons.push(`High engagement (${likeCount} likes)`);
        }

        // Author preference
        if (likedAuthors.has(postData.author.did)) {
          score += 30;
          reasons.push('From an author you frequently engage with');
        }

        // Topic relevance
        const topicMatches = postTopics.filter(t => likedTopics.has(t)).length;
        if (topicMatches > 0) {
          score += topicMatches * 20;
          reasons.push(`Matches ${topicMatches} of your interests`);
        }

        // Recency bonus
        const ageHours = postAge / (60 * 60 * 1000);
        if (ageHours < 6) {
          score += 10;
          reasons.push('Recent post');
        }

        // Thread bonus (replies often have good discussions)
        if (postData.replyCount && postData.replyCount > 3) {
          score += 15;
          reasons.push('Active discussion');
        }

        if (reasons.length === 0) {
          reasons.push('Popular in your network');
        }

        recommendations.push({
          uri: postData.uri,
          cid: postData.cid,
          author: {
            did: postData.author.did,
            handle: postData.author.handle,
            displayName: postData.author.displayName,
            avatar: postData.author.avatar,
          },
          text: postData.record?.text || '',
          likeCount: postData.likeCount || 0,
          replyCount: postData.replyCount || 0,
          repostCount: postData.repostCount || 0,
          indexedAt: postData.indexedAt,
          recommendationScore: Math.round(score),
          recommendationReasons: reasons,
          topics: postTopics.length > 0 ? postTopics : undefined,
        });
      }

      // Sort by recommendation score
      recommendations.sort((a, b) => b.recommendationScore - a.recommendationScore);
      const topRecommendations = recommendations.slice(0, maxResults);

      // Generate insights
      const insights: string[] = [];
      if (topRecommendations.length > 0) {
        insights.push(`Found ${topRecommendations.length} recommended posts from your network`);

        const avgScore =
          topRecommendations.reduce((sum, r) => sum + r.recommendationScore, 0) /
          topRecommendations.length;
        insights.push(`Average recommendation score: ${avgScore.toFixed(1)}`);

        const topAuthors = new Set(topRecommendations.slice(0, 5).map(r => r.author.handle));
        insights.push(`Top authors: ${Array.from(topAuthors).join(', ')}`);

        const allTopics = new Set<string>();
        topRecommendations.forEach(r => r.topics?.forEach(t => allTopics.add(t)));
        if (allTopics.size > 0) {
          insights.push(`Common topics: ${Array.from(allTopics).slice(0, 5).join(', ')}`);
        }
      } else {
        insights.push('No recommendations found matching your criteria');
        insights.push(
          'Try adjusting filters (lower minLikes, increase maxAge, or remove topic filters)'
        );
      }

      this.logger.info('Content recommendations generated', {
        count: topRecommendations.length,
      });

      return {
        success: true,
        recommendations: topRecommendations,
        insights,
      };
    } catch (error) {
      this.logger.error('Failed to generate recommendations', error);
      this.formatError(error);
    }
  }

  private extractTopics(posts: any[]): Set<string> {
    const topics = new Set<string>();
    for (const post of posts) {
      const text = post.record?.text || '';
      // Extract hashtags
      const hashtags = text.match(/#\w+/g) || [];
      hashtags.forEach((tag: string) => topics.add(tag.toLowerCase()));
    }
    return topics;
  }
}
