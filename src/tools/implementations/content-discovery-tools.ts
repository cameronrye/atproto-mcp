/**
 * Content Discovery Tools - Advanced content and user discovery for AT Protocol
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';

/**
 * Zod schema for find similar users parameters
 */
const FindSimilarUsersSchema = z.object({
  actor: z.string().min(1, 'Actor (DID or handle) is required'),
  maxResults: z.number().int().min(1).max(50).optional().default(20),
  minFollowerCount: z.number().int().min(0).optional().default(0),
  includeMetrics: z.boolean().optional().default(true),
});

/**
 * Zod schema for recommend content parameters
 */
const RecommendContentSchema = z.object({
  maxResults: z.number().int().min(1).max(100).optional().default(20),
  minLikes: z.number().int().min(0).optional().default(5),
  maxAge: z.number().int().min(1).max(168).optional().default(24), // hours
  topics: z.array(z.string()).optional(),
  excludeReposts: z.boolean().optional().default(false),
});

/**
 * Zod schema for discover communities parameters
 */
const DiscoverCommunitiesSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  maxResults: z.number().int().min(1).max(50).optional().default(20),
  minCommunitySize: z.number().int().min(2).optional().default(5),
  includeMetrics: z.boolean().optional().default(true),
});

/**
 * Tool for finding users similar to a given user
 */
export class FindSimilarUsersTool extends BaseTool {
  public readonly schema = {
    method: 'find_similar_users',
    description:
      'Find users similar to a given user based on shared follow-graph connections (accounts ' +
      'followed by the same people, and mutual followers). Ranking also factors in follower/' +
      'following-ratio similarity. NOTE: content-topic similarity is NOT analyzed.',
    params: FindSimilarUsersSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'FindSimilarUsers', ToolAuthMode.ENHANCED);
  }

  protected async execute(params: z.infer<typeof FindSimilarUsersSchema>): Promise<{
    success: boolean;
    similarUsers: Array<{
      did: string;
      handle: string;
      displayName?: string;
      description?: string;
      avatar?: string;
      followersCount: number;
      followsCount: number;
      postsCount: number;
      similarityScore: number;
      similarityReasons: string[];
      metrics?: {
        mutualFollowers: number;
        followerRatioSimilarity: number;
      };
    }>;
    baseUser: {
      did: string;
      handle: string;
      displayName?: string;
    };
    insights: string[];
  }> {
    try {
      this.logger.info('Finding similar users', {
        actor: params.actor,
        maxResults: params.maxResults,
      });

      const agent = this.atpClient.getAgent();

      // Get the base user's profile
      const profileResponse = await this.executeAtpOperation(
        async () => agent.getProfile({ actor: params.actor }),
        'getProfile',
        { actor: params.actor }
      );

      const baseProfile = profileResponse.data;
      const baseUser = {
        did: baseProfile.did,
        handle: baseProfile.handle,
        displayName: baseProfile.displayName,
      };

      this.logger.info('Base user profile retrieved', {
        handle: baseUser.handle,
        followersCount: (baseProfile as any).followersCount,
      });

      // Get base user's followers (sample)
      const followersResponse = await this.executeAtpOperation(
        async () => agent.getFollowers({ actor: params.actor, limit: 50 }),
        'getFollowers',
        { actor: params.actor, limit: 50 }
      );

      const baseFollowers = new Set(
        (followersResponse.data.followers as any[]).map((f: any) => f.did)
      );

      // Get base user's follows (sample)
      const followsResponse = await this.executeAtpOperation(
        async () => agent.getFollows({ actor: params.actor, limit: 50 }),
        'getFollows',
        { actor: params.actor, limit: 50 }
      );

      const baseFollows = followsResponse.data.follows as any[];

      // NOTE: this tool ranks by follow-graph overlap only — it does NOT analyze
      // content topics. The previous getAuthorFeed fetch + topic extraction was a
      // wasted network round-trip whose result was never used, so it is omitted.

      this.logger.info('Base user data collected', {
        followersCount: baseFollowers.size,
        followsCount: baseFollows.length,
      });

      // Analyze follows to find similar users
      const candidateUsers = new Map<string, any>();

      // Strategy 1: Check who the base user's follows also follow (2nd degree connections)
      for (const follow of baseFollows.slice(0, 10)) {
        try {
          const theirFollowsResponse = await this.executeAtpOperation(
            async () => agent.getFollows({ actor: follow.did, limit: 20 }),
            'getFollows',
            { actor: follow.did, limit: 20 }
          );

          for (const candidate of theirFollowsResponse.data.follows as any[]) {
            if (candidate.did === baseProfile.did) continue; // Skip self
            // NOTE: minFollowerCount is applied AFTER hydration (below) — these
            // ProfileView candidates have no followersCount, so filtering here
            // would drop everyone whenever minFollowerCount > 0.

            if (!candidateUsers.has(candidate.did)) {
              candidateUsers.set(candidate.did, {
                profile: candidate,
                mutualFollowConnections: 0,
                sharedFollowers: 0,
              });
            }
            candidateUsers.get(candidate.did).mutualFollowConnections++;
          }
        } catch {
          this.logger.warn('Failed to get follows for user', { did: follow.did });
        }
      }

      // Strategy 2: Check followers of the base user's follows
      for (const follow of baseFollows.slice(0, 5)) {
        try {
          const theirFollowersResponse = await this.executeAtpOperation(
            async () => agent.getFollowers({ actor: follow.did, limit: 20 }),
            'getFollowers',
            { actor: follow.did, limit: 20 }
          );

          for (const candidate of theirFollowersResponse.data.followers as any[]) {
            if (candidate.did === baseProfile.did) continue;
            // minFollowerCount is applied after hydration (see below).

            if (!candidateUsers.has(candidate.did)) {
              candidateUsers.set(candidate.did, {
                profile: candidate,
                mutualFollowConnections: 0,
                sharedFollowers: 0,
              });
            }
            candidateUsers.get(candidate.did).sharedFollowers++;
          }
        } catch {
          this.logger.warn('Failed to get followers for user', { did: follow.did });
        }
      }

      this.logger.info('Candidate users collected', {
        candidatesCount: candidateUsers.size,
      });

      // Candidates come from getFollows/getFollowers as ProfileView entries that
      // lack followersCount/followsCount/postsCount. Hydrate them via getProfiles
      // so the minFollowerCount filter and ratio similarity use real numbers
      // instead of treating every absent count as 0.
      await this.hydrateCandidateProfiles(agent, candidateUsers);

      // Calculate similarity scores
      const similarUsers = [];

      for (const [did, data] of candidateUsers.entries()) {
        const profile = data.profile;

        // Apply the follower-count threshold now that counts are real.
        if ((profile.followersCount || 0) < params.minFollowerCount) {
          continue;
        }

        // Calculate mutual followers
        let mutualFollowers = 0;
        if (baseFollowers.has(did)) {
          mutualFollowers = 1;
        }

        // Calculate similarity score
        const connectionScore = data.mutualFollowConnections * 2 + data.sharedFollowers;
        const followerRatioSimilarity = this.calculateFollowerRatioSimilarity(
          baseProfile as any,
          profile
        );

        const similarityScore =
          connectionScore * 10 + followerRatioSimilarity * 5 + mutualFollowers * 15;

        // Determine similarity reasons
        const reasons: string[] = [];
        if (data.mutualFollowConnections > 0) {
          reasons.push(`Followed by ${data.mutualFollowConnections} accounts you follow`);
        }
        if (data.sharedFollowers > 0) {
          reasons.push(`Follows ${data.sharedFollowers} accounts you follow`);
        }
        if (mutualFollowers > 0) {
          reasons.push('Mutual follower');
        }
        if (followerRatioSimilarity > 0.7) {
          reasons.push('Similar follower/following ratio');
        }

        const user: any = {
          did: profile.did,
          handle: profile.handle,
          displayName: profile.displayName,
          description: profile.description,
          avatar: profile.avatar,
          followersCount: profile.followersCount || 0,
          followsCount: profile.followsCount || 0,
          postsCount: profile.postsCount || 0,
          similarityScore,
          similarityReasons: reasons,
        };

        if (params.includeMetrics) {
          // contentSimilarity intentionally omitted — post-content topics are not
          // analyzed, so reporting a value (previously hardcoded 0) would mislead.
          user.metrics = {
            mutualFollowers,
            followerRatioSimilarity,
          };
        }

        similarUsers.push(user);
      }

      // Sort by similarity score and limit results
      similarUsers.sort((a, b) => b.similarityScore - a.similarityScore);
      const topSimilarUsers = similarUsers.slice(0, params.maxResults);

      // Generate insights
      const insights: string[] = [];
      if (topSimilarUsers.length > 0) {
        const avgSimilarity =
          topSimilarUsers.reduce((sum, u) => sum + u.similarityScore, 0) / topSimilarUsers.length;
        insights.push(
          `Found ${topSimilarUsers.length} similar users with average similarity score of ${avgSimilarity.toFixed(1)}`
        );

        const withMutualFollowers = topSimilarUsers.filter(
          u => u.metrics?.mutualFollowers > 0
        ).length;
        if (withMutualFollowers > 0) {
          insights.push(`${withMutualFollowers} users have mutual follower connections`);
        }

        const avgFollowers =
          topSimilarUsers.reduce((sum, u) => sum + u.followersCount, 0) / topSimilarUsers.length;
        insights.push(`Average follower count: ${Math.round(avgFollowers)}`);
      } else {
        insights.push('No similar users found with current criteria');
        insights.push('Try lowering minFollowerCount or analyzing a user with more connections');
      }

      this.logger.info('Similar users found', {
        count: topSimilarUsers.length,
      });

      return {
        success: true,
        similarUsers: topSimilarUsers,
        baseUser,
        insights,
      };
    } catch (error) {
      this.logger.error('Failed to find similar users', error);
      this.formatError(error);
    }
  }

  private calculateFollowerRatioSimilarity(profile1: any, profile2: any): number {
    const ratio1 = (profile1.followersCount || 0) / Math.max(profile1.followsCount || 1, 1);
    const ratio2 = (profile2.followersCount || 0) / Math.max(profile2.followsCount || 1, 1);

    const diff = Math.abs(ratio1 - ratio2);
    const maxRatio = Math.max(ratio1, ratio2);

    if (maxRatio === 0) return 1;
    return Math.max(0, 1 - diff / maxRatio);
  }

  /**
   * Hydrate candidate ProfileView entries (which lack follower/post counts) into
   * ProfileViewDetailed via getProfiles, updating each candidate's `profile` in
   * place so downstream filtering/scoring uses real counts. getProfiles accepts
   * up to 25 actors per call; falls back to the raw entry when getProfiles is
   * unavailable or a profile is not returned.
   */
  private async hydrateCandidateProfiles(
    agent: any,
    candidateUsers: Map<string, { profile: any; [key: string]: any }>
  ): Promise<void> {
    if (typeof agent.getProfiles !== 'function') {
      return;
    }
    const dids = Array.from(candidateUsers.keys());
    for (let i = 0; i < dids.length; i += 25) {
      const chunk = dids.slice(i, i + 25);
      try {
        const resp = await this.executeAtpOperation(
          async () => agent.getProfiles({ actors: chunk }),
          'getProfiles',
          { count: chunk.length }
        );
        for (const detailed of (resp.data.profiles as any[]) ?? []) {
          const entry = candidateUsers.get(detailed.did);
          if (entry) {
            entry.profile = detailed;
          }
        }
      } catch (error) {
        this.logger.warn('Candidate profile hydration failed for a chunk', error as Error);
      }
    }
  }
}

/**
 * Tool for recommending content based on user interests
 */
export class RecommendContentTool extends BaseTool {
  public readonly schema = {
    method: 'recommend_content',
    description:
      'Recommend posts based on user interests and engagement history. ' +
      'Analyzes your timeline, engagement patterns, and network to suggest relevant content.',
    params: RecommendContentSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'RecommendContent', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: z.infer<typeof RecommendContentSchema>): Promise<{
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
    try {
      this.logger.info('Generating content recommendations', {
        maxResults: params.maxResults,
        topics: params.topics,
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
          async () => agent.getProfile({ actor: agent.session?.did || '' }),
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
      const maxAgeMs = params.maxAge * 60 * 60 * 1000;
      const recommendations = [];

      for (const post of timelinePosts) {
        const postData = post;

        // Skip if already liked
        if (postData.viewer?.like) continue;

        // Skip reposts if requested (flag derived from the feed item's reason).
        if (params.excludeReposts && postData.__isRepost) continue;

        // Check age
        const postAge = now.getTime() - new Date(postData.indexedAt).getTime();
        if (postAge > maxAgeMs) continue;

        // Check minimum likes
        const likeCount = postData.likeCount || 0;
        if (likeCount < params.minLikes) continue;

        // Extract topics from post
        const postTopics = Array.from(this.extractTopics([post]));

        // Check topic filter
        if (params.topics && params.topics.length > 0) {
          const hasMatchingTopic = postTopics.some(topic =>
            params.topics!.some(filter => topic.includes(filter.toLowerCase()))
          );
          if (!hasMatchingTopic) continue;
        }

        // Calculate recommendation score
        let score = 0;
        const reasons: string[] = [];

        // Engagement score
        const engagementScore =
          likeCount * 1 + (postData.replyCount || 0) * 2 + (postData.repostCount || 0) * 1.5;
        score += Math.min(engagementScore, 100);
        if (likeCount >= params.minLikes * 2) {
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
      const topRecommendations = recommendations.slice(0, params.maxResults);

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

/**
 * Tool for discovering communities around topics
 */
export class DiscoverCommunitiesTool extends BaseTool {
  public readonly schema = {
    method: 'discover_communities',
    description:
      'Discover communities and groups of users around specific topics or interests. ' +
      'Identifies clusters of users who frequently interact around a topic.',
    params: DiscoverCommunitiesSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'DiscoverCommunities', ToolAuthMode.ENHANCED);
  }

  protected async execute(params: z.infer<typeof DiscoverCommunitiesSchema>): Promise<{
    success: boolean;
    communities: Array<{
      name: string;
      topic: string;
      size: number;
      coreMembers: Array<{
        did: string;
        handle: string;
        displayName?: string;
        avatar?: string;
        followersCount: number;
        postsCount: number;
        relevanceScore: number;
      }>;
      activityLevel: 'high' | 'medium' | 'low';
      description: string;
      metrics?: {
        avgFollowerCount: number;
        totalPosts: number;
        interconnectedness: number;
      };
    }>;
    insights: string[];
  }> {
    try {
      this.logger.info('Discovering communities', {
        topic: params.topic,
        maxResults: params.maxResults,
      });

      const agent = this.atpClient.getAgent();

      // Search for posts about the topic
      const searchResponse = await this.executeAtpOperation(
        async () => agent.app.bsky.feed.searchPosts({ q: params.topic, limit: 100 }),
        'searchPosts',
        { q: params.topic, limit: 100 }
      );

      const posts = searchResponse.data.posts;

      this.logger.info('Posts found for topic', {
        topic: params.topic,
        postsCount: posts.length,
      });

      // Extract authors and their engagement
      const authorEngagement = new Map<
        string,
        {
          profile: any;
          postCount: number;
          totalEngagement: number;
          interactions: Set<string>;
        }
      >();

      for (const post of posts) {
        const author = (post as any).author;
        const authorDid = author.did;

        if (!authorEngagement.has(authorDid)) {
          authorEngagement.set(authorDid, {
            profile: author,
            postCount: 0,
            totalEngagement: 0,
            interactions: new Set(),
          });
        }

        const data = authorEngagement.get(authorDid)!;
        data.postCount++;
        data.totalEngagement +=
          ((post as any).likeCount || 0) + ((post as any).replyCount || 0) * 2;

        // Track interactions (replies indicate community connections)
        if ((post as any).record?.reply) {
          const parentAuthor = (post as any).record.reply.parent.uri.split('/')[2];
          if (parentAuthor !== authorDid) {
            data.interactions.add(parentAuthor);
          }
        }
      }

      // Hydrate author profiles. Post authors are ProfileViewBasic and carry no
      // followersCount, so without this every coreMember.followersCount and the
      // avgFollowerCount metric would be a fabricated 0. getProfiles returns
      // ProfileViewDetailed; we update each entry's profile in place (chunks of 25).
      if (typeof agent.getProfiles === 'function') {
        const dids = Array.from(authorEngagement.keys());
        for (let i = 0; i < dids.length; i += 25) {
          const chunk = dids.slice(i, i + 25);
          try {
            const resp = await this.executeAtpOperation(
              async () => agent.getProfiles({ actors: chunk }),
              'getProfiles',
              { count: chunk.length }
            );
            for (const detailed of (resp.data.profiles as any[]) ?? []) {
              const entry = authorEngagement.get(detailed.did);
              if (entry) {
                entry.profile = detailed;
              }
            }
          } catch (error) {
            this.logger.warn(
              'Community member profile hydration failed for a chunk',
              error as Error
            );
          }
        }
      }

      // Filter authors by minimum activity
      const activeAuthors = Array.from(authorEngagement.entries())
        .filter(([_, data]) => data.postCount >= 1)
        .map(([did, data]) => ({
          did,
          ...data,
        }));

      this.logger.info('Active authors identified', {
        count: activeAuthors.length,
      });

      // Cluster authors into communities based on interactions
      const communities: Array<{
        members: Set<string>;
        totalPosts: number;
        totalEngagement: number;
        interconnections: number;
      }> = [];

      // Simple clustering: group authors who interact with each other
      const processed = new Set<string>();

      for (const author of activeAuthors) {
        if (processed.has(author.did)) continue;

        const community = {
          members: new Set<string>([author.did]),
          totalPosts: author.postCount,
          totalEngagement: author.totalEngagement,
          interconnections: 0,
        };

        // Add authors they interact with
        for (const interactionDid of author.interactions) {
          if (authorEngagement.has(interactionDid)) {
            community.members.add(interactionDid);
            const interactionData = authorEngagement.get(interactionDid)!;
            community.totalPosts += interactionData.postCount;
            community.totalEngagement += interactionData.totalEngagement;
            community.interconnections++;
          }
        }

        // Only include if meets minimum size
        if (community.members.size >= params.minCommunitySize) {
          communities.push(community);
          community.members.forEach(m => processed.add(m));
        }
      }

      // Sort communities by size and engagement
      communities.sort((a, b) => {
        const scoreA = a.members.size * 10 + a.totalEngagement;
        const scoreB = b.members.size * 10 + b.totalEngagement;
        return scoreB - scoreA;
      });

      // Build community details
      const communityDetails = [];

      for (const community of communities.slice(0, params.maxResults)) {
        const members = Array.from(community.members)
          .map(did => {
            const data = authorEngagement.get(did)!;
            return {
              did,
              handle: data.profile.handle,
              displayName: data.profile.displayName,
              avatar: data.profile.avatar,
              followersCount: data.profile.followersCount || 0,
              postsCount: data.postCount,
              relevanceScore: data.totalEngagement + data.postCount * 5,
            };
          })
          .sort((a, b) => b.relevanceScore - a.relevanceScore);

        const coreMembers = members.slice(0, 10);

        // Determine activity level
        const avgPostsPerMember = community.totalPosts / community.members.size;
        let activityLevel: 'high' | 'medium' | 'low' = 'medium';
        if (avgPostsPerMember >= 3) activityLevel = 'high';
        else if (avgPostsPerMember < 1.5) activityLevel = 'low';

        const avgFollowerCount =
          members.reduce((sum, m) => sum + m.followersCount, 0) / members.length;

        const detail: any = {
          name: `${params.topic} Community ${communityDetails.length + 1}`,
          topic: params.topic,
          size: community.members.size,
          coreMembers,
          activityLevel,
          description:
            `A community of ${community.members.size} users actively discussing ${params.topic}. ` +
            `Top contributors: ${coreMembers
              .slice(0, 3)
              .map(m => m.handle)
              .join(', ')}.`,
        };

        if (params.includeMetrics) {
          detail.metrics = {
            avgFollowerCount: Math.round(avgFollowerCount),
            totalPosts: community.totalPosts,
            interconnectedness: community.interconnections / community.members.size,
          };
        }

        communityDetails.push(detail);
      }

      // Generate insights
      const insights: string[] = [];
      if (communityDetails.length > 0) {
        insights.push(
          `Found ${communityDetails.length} active communities discussing ${params.topic}`
        );

        const totalMembers = communityDetails.reduce((sum, c) => sum + c.size, 0);
        insights.push(`Total community members: ${totalMembers}`);

        const largestCommunity = communityDetails[0];
        insights.push(
          `Largest community has ${largestCommunity.size} members with ${largestCommunity.activityLevel} activity`
        );

        const highActivityCommunities = communityDetails.filter(
          c => c.activityLevel === 'high'
        ).length;
        if (highActivityCommunities > 0) {
          insights.push(`${highActivityCommunities} communities have high activity levels`);
        }
      } else {
        insights.push(`No communities found for topic: ${params.topic}`);
        insights.push('Try a more popular topic or lower the minCommunitySize parameter');
      }

      this.logger.info('Communities discovered', {
        count: communityDetails.length,
      });

      return {
        success: true,
        communities: communityDetails,
        insights,
      };
    } catch (error) {
      this.logger.error('Failed to discover communities', error);
      this.formatError(error);
    }
  }
}
