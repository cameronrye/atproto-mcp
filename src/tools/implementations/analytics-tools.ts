import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';

/**
 * Zod schema for analyze network parameters
 */
const AnalyzeNetworkSchema = z.object({
  actor: z.string().optional(),
  includeFollowers: z.boolean().optional().default(true),
  includeFollows: z.boolean().optional().default(true),
  maxSampleSize: z.number().min(10).max(100).optional().default(50),
});

/**
 * Analyze Network Tool - Analyze user's social network
 *
 * This tool analyzes a user's network including:
 * - Follower/following counts and ratios
 * - Engagement patterns with followers
 * - Network overlap and mutual connections
 * - Follower quality metrics
 * - Growth patterns
 *
 * AUTHENTICATION REQUIREMENT:
 * - Private mode (requires authentication)
 * - Analyzes authenticated user's network by default
 */
export class AnalyzeNetworkTool extends BaseTool {
  public readonly schema = {
    method: 'analyze_network',
    description:
      "Analyze a user's social network including follower/following ratios, engagement patterns, mutual connections, and network quality metrics. Defaults to authenticated user if no actor specified.",
    params: AnalyzeNetworkSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'AnalyzeNetwork', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: {
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

      this.logger.info('Analyzing network', {
        actor,
        includeFollowers: params.includeFollowers,
        includeFollows: params.includeFollows,
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

      if (params.includeFollowers && followersCount > 0) {
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

      if (params.includeFollows && followsCount > 0) {
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
        if (params.includeFollowers && followerDidSet.size > 0) {
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
   * getProfiles accepts up to 25 actors per call; we hydrate the first 25 of the
   * sample (one call) to keep cost bounded. Falls back to the raw entries if
   * getProfiles is unavailable, so callers still get a best-effort result.
   */
  private async hydrateProfiles(agent: any, sample: any[]): Promise<any[]> {
    const chunk = sample.slice(0, 25);
    const dids = chunk.map(p => p.did).filter(Boolean);
    if (dids.length === 0 || typeof agent.getProfiles !== 'function') {
      return chunk;
    }
    try {
      const resp = await this.executeAtpOperation(
        async () => agent.getProfiles({ actors: dids }),
        'getProfiles',
        { count: dids.length }
      );
      const byDid = new Map<string, any>();
      for (const profile of (resp.data.profiles as any[]) ?? []) {
        byDid.set(profile.did, profile);
      }
      return chunk.map(p => byDid.get(p.did) ?? p);
    } catch (error) {
      this.logger.warn('Profile hydration failed; ranking on unhydrated sample', error as Error);
      return chunk;
    }
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
}

/**
 * Zod schema for suggest content strategy parameters
 */
const SuggestContentStrategySchema = z.object({
  actor: z.string().optional(),
  analyzePosts: z.number().min(10).max(100).optional().default(50),
  includeTimingAnalysis: z.boolean().optional().default(true),
  includeTopicAnalysis: z.boolean().optional().default(true),
});

/**
 * Suggest Content Strategy Tool - Suggest content strategy based on engagement
 *
 * This tool analyzes past performance and suggests content strategy including:
 * - Best posting times
 * - Most engaging content types
 * - Topic recommendations
 * - Engagement optimization tips
 *
 * AUTHENTICATION REQUIREMENT:
 * - Private mode (requires authentication)
 * - Analyzes authenticated user by default
 */
export class SuggestContentStrategyTool extends BaseTool {
  public readonly schema = {
    method: 'suggest_content_strategy',
    description:
      'Analyze past post performance and suggest content strategy including best posting times, engaging content types, topic recommendations, and optimization tips. Defaults to authenticated user if no actor specified.',
    params: SuggestContentStrategySchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'SuggestContentStrategy', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: {
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

      this.logger.info('Analyzing content strategy', {
        actor,
        analyzePosts: params.analyzePosts,
      });

      // Get user's recent posts
      const postsResponse = await this.executeAtpOperation(
        async () => agent.getAuthorFeed({ actor, limit: params.analyzePosts }),
        'getAuthorFeed',
        { actor, limit: params.analyzePosts }
      );

      const posts = postsResponse.data.feed.map(item => ({
        uri: item.post.uri,
        cid: item.post.cid,
        text: (item.post.record as any).text || '',
        createdAt: item.post.indexedAt,
        likeCount: item.post.likeCount || 0,
        replyCount: item.post.replyCount || 0,
        repostCount: item.post.repostCount || 0,
        embed: (item.post.record as any).embed,
      }));

      if (posts.length === 0) {
        throw new Error('No posts found to analyze');
      }

      // Calculate engagement for each post
      const postsWithEngagement = posts.map(post => {
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
        postsWithEngagement.reduce((sum, p) => sum + p.engagementRate, 0) /
        postsWithEngagement.length;

      // Find best and worst performing posts
      const sortedByEngagement = [...postsWithEngagement].sort(
        (a, b) => b.engagement - a.engagement
      );
      const bestPerformingPosts = sortedByEngagement.slice(0, 5).map(p => ({
        uri: p.uri,
        text: p.text.substring(0, 100) + (p.text.length > 100 ? '...' : ''),
        engagement: p.engagement,
        createdAt: p.createdAt,
      }));
      const worstPerformingPosts = sortedByEngagement
        .slice(-5)
        .reverse()
        .map(p => ({
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
      const recommendations = this.generateRecommendations(
        postsWithEngagement,
        avgEngagementRate,
        params
      );

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

/**
 * Zod schema for find influential users parameters
 */
const FindInfluentialUsersSchema = z.object({
  topic: z.string().optional(),
  searchQuery: z.string().optional(),
  minFollowers: z.number().min(0).optional().default(100),
  maxResults: z.number().min(1).max(50).optional().default(20),
  sortBy: z.enum(['followers', 'engagement', 'relevance']).optional().default('followers'),
});

/**
 * Find Influential Users Tool - Find influential users in a topic or network
 *
 * This tool finds influential users based on:
 * - Follower count
 * - Engagement levels
 * - Topic relevance
 * - Network position
 *
 * AUTHENTICATION REQUIREMENT:
 * - Enhanced mode (works better with authentication)
 * - Public search available without auth
 */
export class FindInfluentialUsersTool extends BaseTool {
  public readonly schema = {
    method: 'find_influential_users',
    description:
      'Find influential users in a topic or network. Search by topic/query and filter by follower count. Returns users sorted by followers, engagement, or relevance.',
    params: FindInfluentialUsersSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'FindInfluentialUsers', ToolAuthMode.ENHANCED);
  }

  protected async execute(params: {
    topic?: string;
    searchQuery?: string;
    minFollowers?: number;
    maxResults?: number;
    sortBy?: 'followers' | 'engagement' | 'relevance';
  }): Promise<{
    success: boolean;
    query: string;
    users: Array<{
      did: string;
      handle: string;
      displayName?: string;
      description?: string;
      followersCount: number;
      followsCount: number;
      postsCount: number;
      influenceScore: number;
      relevanceScore?: number;
    }>;
    insights: string[];
  }> {
    try {
      const query = params.searchQuery || params.topic || '';

      if (!query) {
        throw new Error('Either topic or searchQuery must be provided');
      }

      this.logger.info('Finding influential users', {
        query,
        minFollowers: params.minFollowers,
        sortBy: params.sortBy,
      });

      // Search for posts related to the topic
      const agent = this.atpClient.getAgent();
      const searchResponse = await this.executeAtpOperation(
        async () =>
          agent.app.bsky.feed.searchPosts({
            q: query,
            limit: 100,
          }),
        'searchPosts',
        { q: query, limit: 100 }
      );

      // Extract unique authors from search results
      const authorDids = new Set<string>();
      for (const post of searchResponse.data.posts) {
        authorDids.add(post.author.did);
      }

      if (authorDids.size === 0) {
        return {
          success: true,
          query,
          users: [],
          insights: ['No users found for this topic. Try a different search query.'],
        };
      }

      // Get profiles for all authors
      const users: any[] = [];

      for (const did of Array.from(authorDids).slice(0, params.maxResults! * 2)) {
        try {
          const profileResponse = await this.executeAtpOperation(
            async () => agent.getProfile({ actor: did }),
            'getProfile',
            { actor: did }
          );

          const profile = profileResponse.data;
          const followersCount = profile.followersCount || 0;

          // Filter by minimum followers
          if (followersCount >= params.minFollowers!) {
            // Calculate influence score
            const influenceScore = this.calculateInfluenceScore(
              followersCount,
              profile.followsCount || 0,
              profile.postsCount || 0
            );

            // Calculate relevance score based on how many posts match the query
            const relevantPosts = searchResponse.data.posts.filter(
              p => p.author.did === did
            ).length;
            const relevanceScore = relevantPosts;

            users.push({
              did: profile.did,
              handle: profile.handle,
              displayName: profile.displayName,
              description: profile.description,
              followersCount,
              followsCount: profile.followsCount || 0,
              postsCount: profile.postsCount || 0,
              influenceScore,
              relevanceScore,
            });
          }
        } catch {
          // Skip users that can't be fetched
          this.logger.warn('Failed to fetch profile', { did });
        }
      }

      // Sort users based on sortBy parameter
      users.sort((a, b) => {
        if (params.sortBy === 'followers') {
          return b.followersCount - a.followersCount;
        } else if (params.sortBy === 'engagement') {
          return b.influenceScore - a.influenceScore;
        } else {
          // relevance
          return b.relevanceScore - a.relevanceScore;
        }
      });

      const topUsers = users.slice(0, params.maxResults);

      // Generate insights
      const insights = this.generateInfluencerInsights(topUsers, query);

      this.logger.info('Influential users found', {
        query,
        totalUsers: topUsers.length,
      });

      return {
        success: true,
        query,
        users: topUsers,
        insights,
      };
    } catch (error) {
      this.logger.error('Failed to find influential users', error);
      this.formatError(error);
    }
  }

  /**
   * Calculate influence score based on multiple factors
   */
  private calculateInfluenceScore(
    followersCount: number,
    followsCount: number,
    postsCount: number
  ): number {
    // Influence score considers:
    // - Follower count (primary factor)
    // - Follower/following ratio (quality factor)
    // - Post count (activity factor)

    const followerScore = followersCount;
    const ratioScore = followsCount > 0 ? Math.min(followersCount / followsCount, 10) : 10;
    const activityScore = Math.min(postsCount / 100, 10);

    return Math.round(followerScore * (1 + ratioScore / 10) * (1 + activityScore / 20));
  }

  /**
   * Generate insights about influential users
   */
  private generateInfluencerInsights(users: any[], query: string): string[] {
    const insights: string[] = [];

    if (users.length === 0) {
      insights.push(
        'No influential users found for this topic. Try adjusting your search criteria.'
      );
      return insights;
    }

    const avgFollowers = users.reduce((sum, u) => sum + u.followersCount, 0) / users.length;
    const topUser = users[0];

    insights.push(`Found ${users.length} influential users discussing "${query}"`);

    insights.push(
      `Top influencer: @${topUser.handle} with ${topUser.followersCount.toLocaleString()} followers`
    );

    insights.push(`Average follower count: ${Math.round(avgFollowers).toLocaleString()}`);

    const highlyInfluential = users.filter(u => u.followersCount > 10000).length;
    if (highlyInfluential > 0) {
      insights.push(`${highlyInfluential} highly influential users (>10K followers) found`);
    }

    insights.push('Consider engaging with these users to expand your reach in this topic area');

    return insights;
  }
}
