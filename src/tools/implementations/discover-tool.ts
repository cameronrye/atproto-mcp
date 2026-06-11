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
 * `mode` and `limit` are shared. The remaining fields are mode-specific advanced
 * knobs (documented as such) and are fully validated — each old tool's default is
 * applied inside the ported method when the knob is omitted.
 */
const DiscoverSchema = z.object({
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
    .describe(
      'How many items to return. mode=trending: items returned PER category ' +
        '(hashtags/topics/posts), default 10, values above 25 are capped at 25; a fixed sample ' +
        'of 100 timeline posts is analyzed regardless. mode=recommended: number of recommended ' +
        'posts returned (1–100, default 20).'
    ),
  // --- mode=trending knobs ---
  timeWindow: z
    .enum(['1h', '6h', '12h', '24h', '7d'])
    .optional()
    .describe('Lookback window. Only used when mode=trending (default 24h).'),
  includeHashtags: z
    .boolean()
    .optional()
    .describe('Include trending hashtags. Only used when mode=trending (default true).'),
  includeTopics: z
    .boolean()
    .optional()
    .describe('Include trending topics/keywords. Only used when mode=trending (default true).'),
  includePosts: z
    .boolean()
    .optional()
    .describe('Include notable trending posts. Only used when mode=trending (default true).'),
  // --- mode=recommended knobs ---
  actor: z
    .string()
    .optional()
    .describe(
      'Optional account (handle or DID) to tailor recommendations to: its recent author feed ' +
        'seeds the interest profile (topics and authors) used for scoring. Only used when ' +
        'mode=recommended; defaults to inferring interests from the authenticated user’s own ' +
        'timeline engagement.'
    ),
  topics: z
    .array(z.string())
    .optional()
    .describe(
      'Restrict recommendations to posts matching these topic keywords. Only used when mode=recommended.'
    ),
  minLikes: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      'Minimum like count for a recommended post. Only used when mode=recommended (default 5).'
    ),
  maxAge: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      'Maximum post age in hours for recommendations. Only used when mode=recommended (default 24).'
    ),
  excludeReposts: z
    .boolean()
    .optional()
    .describe('Exclude reposts from recommendations. Only used when mode=recommended.'),
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
        success: {
          type: 'boolean',
          description: 'Whether the discovery run completed successfully.',
        },
        mode: {
          type: 'string',
          enum: ['trending', 'recommended'],
          description: 'Which discovery mode was run; determines which other fields are present.',
        },
        // --- mode=trending fields ---
        timeWindow: {
          type: 'string',
          enum: ['1h', '6h', '12h', '24h', '7d'],
          description: 'Lookback window that was analyzed. Present when mode=trending.',
        },
        trendingHashtags: {
          type: 'array',
          description:
            'Trending hashtags ranked by count and recent growth (empty when includeHashtags is false). Present when mode=trending.',
          items: {
            type: 'object',
            properties: {
              tag: { type: 'string', description: 'The hashtag, including the leading #.' },
              count: {
                type: 'number',
                description: 'Number of analyzed posts using this hashtag.',
              },
              recentPosts: {
                type: 'number',
                description: 'How many of those posts are from the last 6 hours.',
              },
              growth: {
                type: 'number',
                description: 'Share of uses that are recent (recentPosts / count, 0–1).',
              },
            },
            required: ['tag', 'count', 'recentPosts', 'growth'],
          },
        },
        trendingTopics: {
          type: 'array',
          description:
            'Trending topic keywords ranked by engagement (empty when includeTopics is false). Present when mode=trending.',
          items: {
            type: 'object',
            properties: {
              topic: { type: 'string', description: 'The extracted topic keyword.' },
              keywords: {
                type: 'array',
                items: { type: 'string' },
                description: 'Up to 3 post-text snippets where the topic appeared.',
              },
              postCount: {
                type: 'number',
                description: 'Number of analyzed posts mentioning the topic.',
              },
              engagementScore: {
                type: 'number',
                description: 'Total likes+reposts+replies across posts mentioning the topic.',
              },
            },
            required: ['topic', 'keywords', 'postCount', 'engagementScore'],
          },
        },
        trendingPosts: {
          type: 'array',
          description:
            'Notable posts ranked by engagement with a recency boost (empty when includePosts is false). Present when mode=trending.',
          items: {
            type: 'object',
            properties: {
              uri: { type: 'string', description: 'AT-URI of the post.' },
              cid: { type: 'string', description: 'CID of the post record.' },
              author: {
                type: 'object',
                description: 'Author of the post.',
                properties: {
                  did: { type: 'string', description: 'DID of the author.' },
                  handle: { type: 'string', description: 'Handle of the author.' },
                  displayName: {
                    type: 'string',
                    description: 'Display name of the author, if set.',
                  },
                },
                required: ['did', 'handle'],
              },
              text: {
                type: 'string',
                description: 'Post text, truncated to 200 characters with a trailing ellipsis.',
              },
              createdAt: {
                type: 'string',
                description: 'ISO 8601 creation time of the post.',
              },
              likeCount: { type: 'number', description: 'Number of likes.' },
              repostCount: { type: 'number', description: 'Number of reposts.' },
              replyCount: { type: 'number', description: 'Number of replies.' },
              trendingScore: {
                type: 'number',
                description: 'Engagement multiplied by a recency boost (higher trends more).',
              },
            },
            required: [
              'uri',
              'cid',
              'author',
              'text',
              'createdAt',
              'likeCount',
              'repostCount',
              'replyCount',
              'trendingScore',
            ],
          },
        },
        summary: {
          type: 'object',
          description: 'Summary of the analyzed timeline sample. Present when mode=trending.',
          properties: {
            totalPostsAnalyzed: {
              type: 'number',
              description: 'Number of timeline posts inside the time window that were analyzed.',
            },
            uniqueAuthors: {
              type: 'number',
              description: 'Number of distinct authors among the analyzed posts.',
            },
            timeRange: {
              type: 'object',
              description: 'The analyzed time range.',
              properties: {
                start: { type: 'string', description: 'ISO 8601 start of the window.' },
                end: { type: 'string', description: 'ISO 8601 end of the window (now).' },
              },
              required: ['start', 'end'],
            },
          },
          required: ['totalPostsAnalyzed', 'uniqueAuthors', 'timeRange'],
        },
        // --- mode=recommended fields ---
        recommendations: {
          type: 'array',
          description:
            'Recommended posts sorted by descending recommendationScore. Present when mode=recommended.',
          items: {
            type: 'object',
            properties: {
              uri: { type: 'string', description: 'AT-URI of the post.' },
              cid: { type: 'string', description: 'CID of the post record.' },
              author: {
                type: 'object',
                description: 'Author of the post.',
                properties: {
                  did: { type: 'string', description: 'DID of the author.' },
                  handle: { type: 'string', description: 'Handle of the author.' },
                  displayName: {
                    type: 'string',
                    description: 'Display name of the author, if set.',
                  },
                  avatar: {
                    type: 'string',
                    description: "URL of the author's avatar image, if set.",
                  },
                },
                required: ['did', 'handle'],
              },
              text: { type: 'string', description: 'Full post text.' },
              likeCount: { type: 'number', description: 'Number of likes.' },
              replyCount: { type: 'number', description: 'Number of replies.' },
              repostCount: { type: 'number', description: 'Number of reposts.' },
              indexedAt: {
                type: 'string',
                description: 'ISO 8601 time the post was indexed.',
              },
              recommendationScore: {
                type: 'number',
                description:
                  'Composite score from engagement, author/topic preference matches, recency, and discussion activity (higher is better).',
              },
              recommendationReasons: {
                type: 'array',
                items: { type: 'string' },
                description: 'Human-readable reasons this post was recommended.',
              },
              topics: {
                type: 'array',
                items: { type: 'string' },
                description: 'Hashtag topics found in the post; omitted when none.',
              },
            },
            required: [
              'uri',
              'cid',
              'author',
              'text',
              'likeCount',
              'replyCount',
              'repostCount',
              'indexedAt',
              'recommendationScore',
              'recommendationReasons',
            ],
          },
        },
        insights: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Human-readable observations about the recommendations (or advice when none matched). Present when mode=recommended.',
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
    // `limit` governs items RETURNED per category (capped at 25); the timeline
    // sample analyzed is a fixed 100 posts regardless.
    const perCategory = Math.min(params.limit ?? 10, 25);
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
            limit: 100,
          }),
        'getTimeline',
        { limit: 100 }
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
        .slice(0, perCategory);

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
        .slice(0, perCategory);

      // Process trending posts
      const trendingPosts = postsWithScores
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, perCategory);

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

      // Build the preference profile (likedTopics/likedAuthors) used for scoring.
      const likedTopics = new Set<string>();
      const likedAuthors = new Set<string>();

      // When a different actor is given, tailor to THAT account: seed
      // preferences from its recent author feed instead of the session
      // user's timeline engagement.
      const session = agent.session;
      const seedActor =
        params.actor && params.actor !== session?.did && params.actor !== session?.handle
          ? params.actor
          : undefined;

      try {
        if (seedActor) {
          const authorFeedResponse = await this.executeAtpOperation(
            async () => agent.getAuthorFeed({ actor: seedActor, limit: 50 }),
            'getAuthorFeed',
            { actor: seedActor }
          );
          for (const item of authorFeedResponse.data.feed as any[]) {
            likedAuthors.add(item.post.author.did);
            this.extractTopics([item.post]).forEach(t => likedTopics.add(t));
          }
        } else {
          // Note: AT Protocol doesn't have a direct "get my likes" endpoint
          // We'll infer from timeline engagement instead
          for (const post of timelinePosts) {
            if (post.viewer?.like) {
              likedAuthors.add(post.author.did);
              const topics = this.extractTopics([post]);
              topics.forEach(t => likedTopics.add(t));
            }
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
