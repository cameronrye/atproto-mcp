/**
 * Analyze Account Tool - One faceted account-analysis tool.
 *
 * Merges the former analyze_engagement, analyze_network, and
 * suggest_content_strategy tools into a single tool selected by `dimension`.
 * Each dimension's analysis logic is ported verbatim from the original tool.
 *
 * For topic/search-based influencer discovery use find_influential_users instead.
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';

/**
 * Zod schema for analyze account parameters
 */
const AnalyzeAccountSchema = z.object({
  actor: z
    .string()
    .optional()
    .describe('Handle or DID to analyze. Defaults to the authenticated user when omitted.'),
  dimension: z
    .enum(['engagement', 'network', 'strategy'])
    .describe(
      "Which analysis to run: 'engagement' = recent-post performance; 'network' = " +
        "follower/following graph health; 'strategy' = posting recommendations."
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('How many recent posts to sample for engagement analysis (1–100, default 50).'),
  maxSampleSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('How many connections to sample for network analysis (default per old behavior).'),
  includeReplies: z
    .boolean()
    .optional()
    .describe('Engagement: include replies in the sampled author feed (default true).'),
  includeFollowers: z
    .boolean()
    .optional()
    .describe('Network: sample the followers graph (default true).'),
  includeFollows: z
    .boolean()
    .optional()
    .describe('Network: sample the follows graph (default true).'),
  analyzePosts: z
    .number()
    .int()
    .min(10)
    .max(100)
    .optional()
    .describe('Strategy: how many recent posts to analyze (10–100, default 50).'),
  includeTimingAnalysis: z
    .boolean()
    .optional()
    .describe('Strategy: include best-posting-time analysis (default true).'),
  includeTopicAnalysis: z
    .boolean()
    .optional()
    .describe('Strategy: include topic/keyword analysis (default true).'),
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
 * One account-analysis tool selected by `dimension`.
 *
 * - engagement: recent-post performance (former analyze_engagement)
 * - network: follower/following graph health (former analyze_network)
 * - strategy: posting recommendations (former suggest_content_strategy)
 *
 * AUTHENTICATION REQUIREMENT:
 * - Requires authentication (app password); PRIVATE mode.
 * - Read-only: performs no writes.
 */
export class AnalyzeAccountTool extends BaseTool {
  public readonly schema = {
    method: 'analyze_account',
    description:
      'Analyze a single account along one dimension. Requires authentication (app password). ' +
      'Read-only: performs no writes. One account-analysis tool: pick a dimension. For ' +
      'topic/search-based influencer discovery use find_influential_users instead. ' +
      'Subject to per-tool rate limiting.',
    params: AnalyzeAccountSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        dimension: {
          type: 'string',
          enum: ['engagement', 'network', 'strategy'],
          description: 'Which analysis was run.',
        },
        insights: {
          description: 'Human-readable analysis insights (shape varies by dimension).',
        },
      },
      required: ['success', 'dimension'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'AnalyzeAccount', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: {
    actor?: string;
    dimension: 'engagement' | 'network' | 'strategy';
    limit?: number;
    maxSampleSize?: number;
    includeReplies?: boolean;
    includeFollowers?: boolean;
    includeFollows?: boolean;
    analyzePosts?: number;
    includeTimingAnalysis?: boolean;
    includeTopicAnalysis?: boolean;
  }): Promise<Record<string, unknown>> {
    switch (params.dimension) {
      case 'engagement': {
        const result = await this.analyzeEngagement(params);
        return { dimension: 'engagement', ...result };
      }
      case 'network': {
        const result = await this.analyzeNetwork(params);
        return { dimension: 'network', ...result };
      }
      case 'strategy': {
        const result = await this.suggestStrategy(params);
        return { dimension: 'strategy', ...result };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Engagement dimension (ported verbatim from AnalyzeEngagementTool.execute)
  // ---------------------------------------------------------------------------

  private async analyzeEngagement(params: {
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
            filter: params.includeReplies === false ? 'posts_no_replies' : 'posts_with_replies',
          }),
        'getAuthorFeed',
        { actor, limit: params.limit }
      );

      // getAuthorFeed includes the actor's reposts, where `post` is the ORIGINAL
      // post by a different author carrying that author's counts. The repost
      // indicator lives on the feed item's `reason`
      // (app.bsky.feed.defs#reasonRepost), so drop those before aggregating.
      const ownFeedItems = response.data.feed.filter(
        (feedItem: any) => feedItem.reason?.$type !== 'app.bsky.feed.defs#reasonRepost'
      );

      // Transform and analyze posts
      const posts: IPostEngagement[] = ownFeedItems.map((feedItem: any) => {
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

  // ---------------------------------------------------------------------------
  // Network dimension (ported verbatim from AnalyzeNetworkTool.execute)
  // ---------------------------------------------------------------------------

  private async analyzeNetwork(params: {
    actor?: string;
    includeFollowers?: boolean;
    includeFollows?: boolean;
    maxSampleSize?: number;
  }): Promise<{
    success: boolean;
    actor: string;
    network: {
      followersCount: number;
      followsCount: number;
      postsCount: number;
      followerToFollowingRatio: number;
    };
    analysis: {
      networkType: 'broadcaster' | 'connector' | 'balanced' | 'new_user';
      engagementQuality: 'high' | 'medium' | 'low';
      mutualConnectionsCount?: number;
      topFollowers?: Array<{
        did: string;
        handle: string;
        displayName?: string;
        followersCount: number;
      }>;
      topFollows?: Array<{
        did: string;
        handle: string;
        displayName?: string;
        followersCount: number;
      }>;
    };
    insights: string[];
  }> {
    try {
      const agent = this.atpClient.getAgent();
      const actor =
        params.actor || (await agent.getProfile({ actor: agent.session?.did || '' })).data.did;

      // Default the graph-sampling toggles (the old tool defaulted both to true).
      const includeFollowers = params.includeFollowers !== false;
      const includeFollows = params.includeFollows !== false;

      this.logger.info('Analyzing network', {
        actor,
        includeFollowers,
        includeFollows,
      });

      // Get user profile for basic stats
      const profileResponse = await this.executeAtpOperation(
        async () => agent.getProfile({ actor }),
        'getProfile',
        { actor }
      );

      const profile = profileResponse.data;
      const followersCount = profile.followersCount || 0;
      const followsCount = profile.followsCount || 0;
      const postsCount = profile.postsCount || 0;

      const network = {
        followersCount,
        followsCount,
        postsCount,
        followerToFollowingRatio: followsCount > 0 ? followersCount / followsCount : followersCount,
      };

      // Sample followers and follows for analysis
      let topFollowers: any[] = [];
      let topFollows: any[] = [];
      let mutualConnectionsCount = 0;
      // Full DID set of the sampled followers (up to maxSampleSize), kept so
      // mutual-connection counting intersects the *entire* sample rather than
      // just the top-10 ranked slice.
      let followerDidSet = new Set<string>();

      if (includeFollowers && followersCount > 0) {
        const followersResponse = await this.executeAtpOperation(
          async () => agent.getFollowers({ actor, limit: params.maxSampleSize }),
          'getFollowers',
          { actor, limit: params.maxSampleSize }
        );

        // Capture the full sampled follower DID set for mutual-connection
        // counting before we rank/truncate to the top 10.
        followerDidSet = new Set(
          (followersResponse.data.followers as any[]).map(f => f.did).filter(Boolean)
        );

        // getFollowers returns ProfileView entries WITHOUT followersCount, so we
        // hydrate the sample via getProfiles to get real counts before ranking.
        const hydrated = await this.hydrateProfiles(
          agent,
          followersResponse.data.followers as any[]
        );
        topFollowers = hydrated
          .sort((a: any, b: any) => (b.followersCount || 0) - (a.followersCount || 0))
          .slice(0, 10)
          .map((f: any) => ({
            did: f.did,
            handle: f.handle,
            displayName: f.displayName,
            followersCount: f.followersCount ?? 0,
          }));
      }

      if (includeFollows && followsCount > 0) {
        const followsResponse = await this.executeAtpOperation(
          async () => agent.getFollows({ actor, limit: params.maxSampleSize }),
          'getFollows',
          { actor, limit: params.maxSampleSize }
        );

        const hydrated = await this.hydrateProfiles(agent, followsResponse.data.follows as any[]);
        topFollows = hydrated
          .sort((a: any, b: any) => (b.followersCount || 0) - (a.followersCount || 0))
          .slice(0, 10)
          .map((f: any) => ({
            did: f.did,
            handle: f.handle,
            displayName: f.displayName,
            followersCount: f.followersCount ?? 0,
          }));

        // Calculate mutual connections over the FULL sampled sets (not the
        // top-10 ranked slices, which would cap the count at 10 and bias it to
        // high-follower accounts). This is the overlap within the sampled
        // followers/follows (each up to maxSampleSize), not the lifetime total.
        if (includeFollowers && followerDidSet.size > 0) {
          mutualConnectionsCount = (followsResponse.data.follows as any[]).filter(f =>
            followerDidSet.has(f.did)
          ).length;
        }
      }

      // Analyze network type
      const analysis = this.analyzeNetworkType(
        network,
        topFollowers,
        topFollows,
        mutualConnectionsCount
      );

      // Generate insights
      const insights = this.generateNetworkInsights(network, analysis);

      this.logger.info('Network analysis completed', {
        actor,
        networkType: analysis.networkType,
        engagementQuality: analysis.engagementQuality,
      });

      return {
        success: true,
        actor,
        network,
        analysis,
        insights,
      };
    } catch (error) {
      this.logger.error('Failed to analyze network', error);
      this.formatError(error);
    }
  }

  /**
   * Hydrate a sample of ProfileView entries (which lack followersCount) into
   * ProfileViewDetailed via getProfiles, so ranking/scoring uses real counts.
   *
   * getProfiles accepts up to 25 actors per call, so we hydrate the WHOLE sample
   * in ceil(n/25) calls — previously only the first 25 were hydrated, so the most
   * influential follower/follow beyond index 25 was invisible to the ranking even
   * though maxSampleSize advertises up to 100. Falls back to the raw entries if
   * getProfiles is unavailable, so callers still get a best-effort result.
   */
  private async hydrateProfiles(agent: any, sample: any[]): Promise<any[]> {
    if (sample.length === 0 || typeof agent.getProfiles !== 'function') {
      return sample;
    }
    const byDid = new Map<string, any>();
    for (let i = 0; i < sample.length; i += 25) {
      const dids = sample
        .slice(i, i + 25)
        .map(p => p.did)
        .filter(Boolean);
      if (dids.length === 0) {
        continue;
      }
      try {
        const resp = await this.executeAtpOperation(
          async () => agent.getProfiles({ actors: dids }),
          'getProfiles',
          { count: dids.length }
        );
        for (const profile of (resp.data.profiles as any[]) ?? []) {
          byDid.set(profile.did, profile);
        }
      } catch (error) {
        this.logger.warn(
          'Profile hydration failed for a chunk; ranking partially unhydrated',
          error as Error
        );
      }
    }
    return sample.map(p => byDid.get(p.did) ?? p);
  }

  /**
   * Analyze network type based on follower/following patterns
   */
  private analyzeNetworkType(
    network: any,
    topFollowers: any[],
    topFollows: any[],
    mutualConnectionsCount: number
  ): {
    networkType: 'broadcaster' | 'connector' | 'balanced' | 'new_user';
    engagementQuality: 'high' | 'medium' | 'low';
    mutualConnectionsCount?: number;
    topFollowers?: any[];
    topFollows?: any[];
  } {
    const { followersCount, followsCount, followerToFollowingRatio } = network;

    // Determine network type
    let networkType: 'broadcaster' | 'connector' | 'balanced' | 'new_user';

    if (followersCount < 10 && followsCount < 10) {
      networkType = 'new_user';
    } else if (followerToFollowingRatio > 3) {
      networkType = 'broadcaster'; // More followers than following
    } else if (followerToFollowingRatio < 0.5) {
      networkType = 'connector'; // More following than followers
    } else {
      networkType = 'balanced';
    }

    // Determine engagement quality based on follower quality
    let engagementQuality: 'high' | 'medium' | 'low' = 'medium';

    if (topFollowers.length > 0) {
      const avgFollowerCount =
        topFollowers.reduce((sum, f) => sum + f.followersCount, 0) / topFollowers.length;

      if (avgFollowerCount > 1000) {
        engagementQuality = 'high';
      } else if (avgFollowerCount < 100) {
        engagementQuality = 'low';
      }
    }

    return {
      networkType,
      engagementQuality,
      ...(mutualConnectionsCount > 0 && { mutualConnectionsCount }),
      ...(topFollowers.length > 0 && { topFollowers }),
      ...(topFollows.length > 0 && { topFollows }),
    };
  }

  /**
   * Generate insights based on network analysis
   */
  private generateNetworkInsights(network: any, analysis: any): string[] {
    const insights: string[] = [];
    const { followersCount, followsCount, postsCount } = network;
    const { networkType, engagementQuality, mutualConnectionsCount } = analysis;

    // Network type insights
    if (networkType === 'broadcaster') {
      insights.push(
        `You have a broadcaster network (${followersCount} followers vs ${followsCount} following) - your content reaches many people`
      );
      insights.push('Consider engaging more with your followers to build stronger connections');
    } else if (networkType === 'connector') {
      insights.push(
        `You have a connector network (following ${followsCount} vs ${followersCount} followers) - you're actively building connections`
      );
      insights.push('Focus on creating valuable content to convert connections into followers');
    } else if (networkType === 'balanced') {
      insights.push(
        `You have a balanced network (${followersCount} followers, ${followsCount} following) - healthy two-way engagement`
      );
    } else {
      insights.push(
        "You're new to the network - focus on following interesting accounts and posting regularly"
      );
    }

    // Engagement quality insights
    if (engagementQuality === 'high') {
      insights.push(
        'Your followers include influential accounts - your content has high reach potential'
      );
    } else if (engagementQuality === 'low') {
      insights.push(
        'Focus on engaging with more active and influential accounts to grow your reach'
      );
    }

    // Mutual connections insights
    if (mutualConnectionsCount && mutualConnectionsCount > 0) {
      insights.push(
        `You have ${mutualConnectionsCount} mutual connections - strong reciprocal relationships`
      );
    }

    // Content activity insights
    if (postsCount > 0) {
      const postsPerFollower = followersCount > 0 ? postsCount / followersCount : postsCount;
      if (postsPerFollower > 10) {
        insights.push('You post frequently - consider focusing on quality over quantity');
      } else if (postsPerFollower < 0.1 && followersCount > 100) {
        insights.push('You could post more frequently to maintain engagement with your followers');
      }
    } else {
      insights.push('Start posting content to engage with your network');
    }

    // Growth recommendations
    if (followersCount < 100) {
      insights.push('Engage with trending topics and reply to popular posts to grow your audience');
    }

    return insights;
  }

  // ---------------------------------------------------------------------------
  // Strategy dimension (ported verbatim from SuggestContentStrategyTool.execute)
  // ---------------------------------------------------------------------------

  private async suggestStrategy(params: {
    actor?: string;
    analyzePosts?: number;
    includeTimingAnalysis?: boolean;
    includeTopicAnalysis?: boolean;
  }): Promise<{
    success: boolean;
    actor: string;
    analysis: {
      totalPostsAnalyzed: number;
      avgEngagementRate: number;
      bestPerformingPosts: Array<{
        uri: string;
        text: string;
        engagement: number;
        createdAt: string;
      }>;
      worstPerformingPosts: Array<{
        uri: string;
        text: string;
        engagement: number;
        createdAt: string;
      }>;
    };
    recommendations: {
      bestPostingTimes?: string[];
      contentTypes?: Array<{
        type: string;
        avgEngagement: number;
        recommendation: string;
      }>;
      topics?: Array<{
        topic: string;
        frequency: number;
        avgEngagement: number;
      }>;
      optimizationTips: string[];
    };
  }> {
    try {
      const agent = this.atpClient.getAgent();
      const actor =
        params.actor || (await agent.getProfile({ actor: agent.session?.did || '' })).data.did;

      // The old suggest_content_strategy tool defaulted analyzePosts to 50,
      // includeTimingAnalysis/includeTopicAnalysis to true. Preserve those.
      const analyzePosts = params.analyzePosts ?? 50;
      const includeTimingAnalysis = params.includeTimingAnalysis !== false;
      const includeTopicAnalysis = params.includeTopicAnalysis !== false;

      this.logger.info('Analyzing content strategy', {
        actor,
        analyzePosts,
      });

      // Get user's recent posts
      const postsResponse = await this.executeAtpOperation(
        async () => agent.getAuthorFeed({ actor, limit: analyzePosts }),
        'getAuthorFeed',
        { actor, limit: analyzePosts }
      );

      // Same repost exclusion as the engagement dimension: a repost's `post`
      // belongs to a different author, so it must not feed the strategy stats.
      const ownFeedItems = postsResponse.data.feed.filter(
        (item: any) => item.reason?.$type !== 'app.bsky.feed.defs#reasonRepost'
      );

      const posts = ownFeedItems.map((item: any) => ({
        uri: item.post.uri,
        cid: item.post.cid,
        text: item.post.record.text || '',
        createdAt: item.post.indexedAt,
        likeCount: item.post.likeCount || 0,
        replyCount: item.post.replyCount || 0,
        repostCount: item.post.repostCount || 0,
        embed: item.post.record.embed,
      }));

      if (posts.length === 0) {
        throw new Error('No posts found to analyze');
      }

      // Calculate engagement for each post
      const postsWithEngagement = posts.map((post: any) => {
        const engagement = post.likeCount + post.replyCount * 2 + post.repostCount * 3;
        const createdAt = new Date(post.createdAt);
        const hoursSincePost = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        const engagementRate = hoursSincePost > 0 ? engagement / hoursSincePost : engagement;

        return {
          ...post,
          engagement,
          engagementRate,
          hour: createdAt.getHours(),
          dayOfWeek: createdAt.getDay(),
        };
      });

      // Calculate average engagement rate
      const avgEngagementRate =
        postsWithEngagement.reduce((sum: number, p: any) => sum + p.engagementRate, 0) /
        postsWithEngagement.length;

      // Find best and worst performing posts
      const sortedByEngagement = [...postsWithEngagement].sort(
        (a, b) => b.engagement - a.engagement
      );
      const bestPerformingPosts = sortedByEngagement.slice(0, 5).map((p: any) => ({
        uri: p.uri,
        text: p.text.substring(0, 100) + (p.text.length > 100 ? '...' : ''),
        engagement: p.engagement,
        createdAt: p.createdAt,
      }));
      const worstPerformingPosts = sortedByEngagement
        .slice(-5)
        .reverse()
        .map((p: any) => ({
          uri: p.uri,
          text: p.text.substring(0, 100) + (p.text.length > 100 ? '...' : ''),
          engagement: p.engagement,
          createdAt: p.createdAt,
        }));

      const analysis = {
        totalPostsAnalyzed: posts.length,
        avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
        bestPerformingPosts,
        worstPerformingPosts,
      };

      // Generate recommendations
      const recommendations = this.generateRecommendations(postsWithEngagement, avgEngagementRate, {
        includeTimingAnalysis,
        includeTopicAnalysis,
      });

      this.logger.info('Content strategy analysis completed', {
        actor,
        totalPostsAnalyzed: posts.length,
        avgEngagementRate,
      });

      return {
        success: true,
        actor,
        analysis,
        recommendations,
      };
    } catch (error) {
      this.logger.error('Failed to suggest content strategy', error);
      this.formatError(error);
    }
  }

  /**
   * Generate content strategy recommendations
   */
  private generateRecommendations(
    posts: any[],
    avgEngagementRate: number,
    params: any
  ): {
    bestPostingTimes?: string[];
    contentTypes?: Array<{
      type: string;
      avgEngagement: number;
      recommendation: string;
    }>;
    topics?: Array<{
      topic: string;
      frequency: number;
      avgEngagement: number;
    }>;
    optimizationTips: string[];
  } {
    const recommendations: any = {
      optimizationTips: [],
    };

    // Timing analysis
    if (params.includeTimingAnalysis) {
      const hourlyEngagement = new Map<number, { total: number; count: number }>();

      for (const post of posts) {
        const hour = post.hour;
        const current = hourlyEngagement.get(hour) || { total: 0, count: 0 };
        hourlyEngagement.set(hour, {
          total: current.total + post.engagementRate,
          count: current.count + 1,
        });
      }

      const hourlyAvg = Array.from(hourlyEngagement.entries())
        .map(([hour, data]) => ({
          hour,
          avgEngagement: data.total / data.count,
        }))
        .sort((a, b) => b.avgEngagement - a.avgEngagement);

      if (hourlyAvg.length > 0) {
        const bestHours = hourlyAvg.slice(0, 3).map(h => {
          const period = h.hour < 12 ? 'AM' : 'PM';
          const displayHour = h.hour % 12 || 12;
          return `${displayHour}:00 ${period}`;
        });

        recommendations.bestPostingTimes = bestHours;
        recommendations.optimizationTips.push(
          `Your best posting times are ${bestHours.join(', ')} - schedule important posts during these hours`
        );
      }
    }

    // Content type analysis
    const contentTypes = {
      withMedia: { total: 0, count: 0 },
      withLinks: { total: 0, count: 0 },
      textOnly: { total: 0, count: 0 },
      threads: { total: 0, count: 0 },
    };

    for (const post of posts) {
      const hasEmbed = post.embed !== undefined;
      const hasReply = post.text.includes('@');

      if (hasEmbed) {
        contentTypes.withMedia.total += post.engagementRate;
        contentTypes.withMedia.count += 1;
      } else if (hasReply) {
        contentTypes.threads.total += post.engagementRate;
        contentTypes.threads.count += 1;
      } else {
        contentTypes.textOnly.total += post.engagementRate;
        contentTypes.textOnly.count += 1;
      }
    }

    recommendations.contentTypes = Object.entries(contentTypes)
      .filter(([_, data]) => data.count > 0)
      .map(([type, data]) => ({
        type,
        avgEngagement: Math.round((data.total / data.count) * 100) / 100,
        recommendation:
          data.total / data.count > avgEngagementRate
            ? `${type} posts perform above average - create more of these`
            : `${type} posts perform below average - try different approaches`,
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement);

    // Topic analysis (simple keyword extraction)
    if (params.includeTopicAnalysis) {
      const topicMap = new Map<string, { count: number; totalEngagement: number }>();

      for (const post of posts) {
        // Extract hashtags and common words
        const words = post.text.toLowerCase().match(/\b\w{4,}\b/g) || [];
        const hashtags = post.text.match(/#\w+/g) || [];
        const topics = [...new Set([...hashtags, ...words.slice(0, 5)])];

        for (const topic of topics) {
          const current = topicMap.get(topic) || { count: 0, totalEngagement: 0 };
          topicMap.set(topic, {
            count: current.count + 1,
            totalEngagement: current.totalEngagement + post.engagementRate,
          });
        }
      }

      recommendations.topics = Array.from(topicMap.entries())
        .filter(([_, data]) => data.count >= 2) // Only topics mentioned at least twice
        .map(([topic, data]) => ({
          topic,
          frequency: data.count,
          avgEngagement: Math.round((data.totalEngagement / data.count) * 100) / 100,
        }))
        .sort((a, b) => b.avgEngagement - a.avgEngagement)
        .slice(0, 10);
    }

    // General optimization tips
    const avgPostLength = posts.reduce((sum, p) => sum + p.text.length, 0) / posts.length;

    if (avgPostLength < 50) {
      recommendations.optimizationTips.push(
        'Your posts are quite short - consider adding more context to increase engagement'
      );
    } else if (avgPostLength > 250) {
      recommendations.optimizationTips.push(
        'Your posts are quite long - consider breaking them into threads for better readability'
      );
    }

    const postsWithMedia = posts.filter(p => p.embed).length;
    const mediaPercentage = (postsWithMedia / posts.length) * 100;

    if (mediaPercentage < 20) {
      recommendations.optimizationTips.push(
        `Only ${Math.round(mediaPercentage)}% of your posts include media - posts with images/videos typically get more engagement`
      );
    }

    if (recommendations.optimizationTips.length === 0) {
      recommendations.optimizationTips.push(
        'Your content strategy is well-balanced - keep up the good work!'
      );
    }

    return recommendations;
  }
}
