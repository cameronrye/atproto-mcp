import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';

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

      // Hydrate author profiles in batches via getProfiles (up to 25 actors per
      // call) instead of one sequential getProfile round-trip per author.
      const targetDids = Array.from(authorDids).slice(0, params.maxResults! * 2);
      const profiles: any[] = [];
      for (let i = 0; i < targetDids.length; i += 25) {
        const chunk = targetDids.slice(i, i + 25);
        try {
          const resp = await this.executeAtpOperation(
            async () => agent.getProfiles({ actors: chunk }),
            'getProfiles',
            { count: chunk.length }
          );
          profiles.push(...((resp.data.profiles as any[]) ?? []));
        } catch {
          this.logger.warn('Failed to fetch a profile chunk', { count: chunk.length });
        }
      }

      const users: any[] = [];
      for (const profile of profiles) {
        const followersCount = profile.followersCount || 0;

        // Filter by minimum followers
        if (followersCount >= params.minFollowers!) {
          const influenceScore = this.calculateInfluenceScore(
            followersCount,
            profile.followsCount || 0,
            profile.postsCount || 0
          );

          // Relevance = how many of the matched posts are from this author.
          const relevanceScore = searchResponse.data.posts.filter(
            p => p.author.did === profile.did
          ).length;

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
