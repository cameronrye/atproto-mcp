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
  actor: z
    .string()
    .min(1, 'Actor (DID or handle) is required')
    .describe(
      'Handle (e.g. alice.bsky.social) or DID of the target account to find similar users for.'
    ),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe('Maximum number of similar users to return (1–50, default 20).'),
  minFollowerCount: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe(
      'Minimum follower count a candidate must have to be included in results (default 0, meaning no minimum).'
    ),
  includeMetrics: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'When true, includes a metrics object on each result with followsBaseUser and followerRatioSimilarity values (default true).'
    ),
});

/**
 * Zod schema for discover communities parameters
 */
const DiscoverCommunitiesSchema = z.object({
  topic: z
    .string()
    .min(1, 'Topic is required')
    .describe(
      'Keyword or phrase to search for (e.g. "climate", "web dev"). Used to retrieve relevant posts and identify active community clusters.'
    ),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe('Maximum number of communities to return (1–50, default 20).'),
  minCommunitySize: z
    .number()
    .int()
    .min(2)
    .optional()
    .default(5)
    .describe(
      'Minimum number of distinct members required for a cluster to be reported as a community (minimum 2, default 5).'
    ),
  includeMetrics: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'When true, includes a metrics object on each community with avgFollowerCount, totalPosts, and interconnectedness values (default true).'
    ),
});

/**
 * Tool for finding users similar to a given user
 */
export class FindSimilarUsersTool extends BaseTool {
  public readonly schema = {
    method: 'find_similar_users',
    description:
      'Find users similar to a given user based on shared follow-graph connections (second-degree follows and accounts that follow the base user) and follower/following-ratio similarity. ' +
      'Content-topic similarity is NOT analyzed. ' +
      'Works without authentication; richer with auth. ' +
      'Use this instead of search_actors when you want accounts structurally similar to a known user rather than keyword matches. ' +
      'Subject to per-tool rate limiting.',
    params: FindSimilarUsersSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the operation completed successfully.',
        },
        similarUsers: {
          type: 'array',
          description: 'List of similar users sorted by descending similarity score.',
          items: {
            type: 'object',
            properties: {
              did: { type: 'string', description: 'Decentralized identifier of the user.' },
              handle: { type: 'string', description: 'Bluesky handle of the user.' },
              displayName: { type: 'string', description: 'Display name of the user, if set.' },
              description: { type: 'string', description: 'Profile bio of the user, if set.' },
              avatar: { type: 'string', description: "URL of the user's avatar image, if set." },
              followersCount: { type: 'number', description: 'Number of followers.' },
              followsCount: { type: 'number', description: 'Number of accounts the user follows.' },
              postsCount: { type: 'number', description: 'Total posts by this user.' },
              similarityScore: {
                type: 'number',
                description: 'Computed similarity score (higher is more similar).',
              },
              similarityReasons: {
                type: 'array',
                items: { type: 'string' },
                description: 'Human-readable reasons contributing to the similarity score.',
              },
              metrics: {
                type: 'object',
                description: 'Optional metrics object; present when includeMetrics is true.',
                properties: {
                  followsBaseUser: {
                    type: 'boolean',
                    description:
                      "True when this candidate appears in a sample of the base user's followers, i.e. the candidate follows the base user. Sample-based: false does not prove absence.",
                  },
                  followerRatioSimilarity: {
                    type: 'number',
                    description: 'Similarity of follower/following ratios (0–1).',
                  },
                },
              },
            },
            required: [
              'did',
              'handle',
              'followersCount',
              'followsCount',
              'postsCount',
              'similarityScore',
              'similarityReasons',
            ],
          },
        },
        baseUser: {
          type: 'object',
          description: 'Profile summary of the queried base user.',
          properties: {
            did: { type: 'string', description: 'DID of the base user.' },
            handle: { type: 'string', description: 'Handle of the base user.' },
            displayName: { type: 'string', description: 'Display name of the base user, if set.' },
          },
          required: ['did', 'handle'],
        },
        insights: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Summary observations about the results (e.g. average similarity score, average follower count).',
        },
      },
      required: ['success', 'similarUsers', 'baseUser', 'insights'],
    },
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
        followsBaseUser: boolean;
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

      // The base user's profile, follower sample, and follow sample are three
      // independent reads — issue them concurrently.
      const [profileResponse, followersResponse, followsResponse] = await Promise.all([
        this.executeAtpOperation(
          async () => agent.getProfile({ actor: params.actor }),
          'getProfile',
          { actor: params.actor }
        ),
        this.executeAtpOperation(
          async () => agent.getFollowers({ actor: params.actor, limit: 50 }),
          'getFollowers',
          { actor: params.actor, limit: 50 }
        ),
        this.executeAtpOperation(
          async () => agent.getFollows({ actor: params.actor, limit: 50 }),
          'getFollows',
          { actor: params.actor, limit: 50 }
        ),
      ]);

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

      const baseFollowers = new Set(
        (followersResponse.data.followers as any[]).map((f: any) => f.did)
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

      // Both second-degree scans are independent reads: fetch them with bounded
      // parallelism (failures degrade to an empty list, as before), then fold
      // the responses into candidateUsers in the original deterministic order
      // so the result content is identical to the sequential implementation.
      const [followsOfFollows, followersOfFollows] = await Promise.all([
        // Strategy 1: Check who the base user's follows also follow (2nd degree connections)
        this.mapWithConcurrency(baseFollows.slice(0, 10), 5, async follow => {
          try {
            const theirFollowsResponse = await this.executeAtpOperation(
              async () => agent.getFollows({ actor: follow.did, limit: 20 }),
              'getFollows',
              { actor: follow.did, limit: 20 }
            );
            return theirFollowsResponse.data.follows as any[];
          } catch {
            this.logger.warn('Failed to get follows for user', { did: follow.did });
            return [] as any[];
          }
        }),
        // Strategy 2: Check followers of the base user's follows
        this.mapWithConcurrency(baseFollows.slice(0, 5), 5, async follow => {
          try {
            const theirFollowersResponse = await this.executeAtpOperation(
              async () => agent.getFollowers({ actor: follow.did, limit: 20 }),
              'getFollowers',
              { actor: follow.did, limit: 20 }
            );
            return theirFollowersResponse.data.followers as any[];
          } catch {
            this.logger.warn('Failed to get followers for user', { did: follow.did });
            return [] as any[];
          }
        }),
      ]);

      for (const follows of followsOfFollows) {
        for (const candidate of follows) {
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
      }

      for (const followers of followersOfFollows) {
        for (const candidate of followers) {
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

        // The candidate appears in the base user's follower SAMPLE — all the
        // fetched data can truthfully say is "this account follows the base user".
        const followsBaseUser = baseFollowers.has(did);

        // Calculate similarity score (followsBaseUser carries a flat +15 bonus)
        const connectionScore = data.mutualFollowConnections * 2 + data.sharedFollowers;
        const followerRatioSimilarity = this.calculateFollowerRatioSimilarity(
          baseProfile as any,
          profile
        );

        const similarityScore =
          connectionScore * 10 + followerRatioSimilarity * 5 + (followsBaseUser ? 15 : 0);

        // Determine similarity reasons
        const reasons: string[] = [];
        if (data.mutualFollowConnections > 0) {
          reasons.push(`Followed by ${data.mutualFollowConnections} accounts you follow`);
        }
        if (data.sharedFollowers > 0) {
          reasons.push(`Follows ${data.sharedFollowers} accounts you follow`);
        }
        if (followsBaseUser) {
          reasons.push('Follows the base user');
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
            followsBaseUser,
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

        const followingBaseUser = topSimilarUsers.filter(
          u => u.metrics?.followsBaseUser === true
        ).length;
        if (followingBaseUser > 0) {
          insights.push(`${followingBaseUser} of these users follow the base user`);
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

  /**
   * Map `items` through an async `fn` with at most `limit` calls in flight,
   * preserving input order in the returned array. Used to overlap independent
   * network reads without flooding the PDS.
   */
  private async mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    const queue = items.map((item, index) => ({ item, index }));
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (let entry = queue.shift(); entry; entry = queue.shift()) {
        results[entry.index] = await fn(entry.item);
      }
    });
    await Promise.all(workers);
    return results;
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
    const chunks: string[][] = [];
    for (let i = 0; i < dids.length; i += 25) {
      chunks.push(dids.slice(i, i + 25));
    }
    // Chunks are independent reads keyed by DID — fetch them with bounded
    // parallelism rather than strictly one after another.
    await this.mapWithConcurrency(chunks, 4, async chunk => {
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
        this.logger.warn('Candidate profile hydration failed for a chunk', error);
      }
    });
  }
}

/**
 * Tool for discovering communities around topics
 */
export class DiscoverCommunitiesTool extends BaseTool {
  public readonly schema = {
    method: 'discover_communities',
    description:
      'Discover communities and groups of users around specific topics or interests by searching recent posts and clustering authors who interact with each other. ' +
      'Works without authentication; richer with auth. ' +
      'Use this instead of find_similar_users when you want topic-based community clusters rather than accounts structurally similar to a specific user. ' +
      'Subject to per-tool rate limiting.',
    params: DiscoverCommunitiesSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the operation completed successfully.',
        },
        communities: {
          type: 'array',
          description: 'List of discovered communities sorted by size and engagement (descending).',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Auto-generated name for the community (e.g. "climate Community 1").',
              },
              topic: {
                type: 'string',
                description: 'The topic keyword used to discover this community.',
              },
              size: { type: 'number', description: 'Number of distinct members in the community.' },
              coreMembers: {
                type: 'array',
                description:
                  'Up to 10 most relevant members, sorted by relevance score descending.',
                items: {
                  type: 'object',
                  properties: {
                    did: { type: 'string', description: 'DID of the member.' },
                    handle: { type: 'string', description: 'Bluesky handle of the member.' },
                    displayName: { type: 'string', description: 'Display name, if set.' },
                    avatar: { type: 'string', description: 'Avatar URL, if set.' },
                    followersCount: { type: 'number', description: 'Follower count.' },
                    postsCount: {
                      type: 'number',
                      description: 'Posts contributed to the topic in this search.',
                    },
                    relevanceScore: {
                      type: 'number',
                      description: 'Relevance score based on engagement and post count.',
                    },
                  },
                  required: ['did', 'handle', 'followersCount', 'postsCount', 'relevanceScore'],
                },
              },
              activityLevel: {
                type: 'string',
                enum: ['high', 'medium', 'low'],
                description:
                  'Activity level based on average posts per member: high (>=3), medium (1.5–2.9), low (<1.5).',
              },
              description: {
                type: 'string',
                description: 'Auto-generated human-readable summary of the community.',
              },
              metrics: {
                type: 'object',
                description: 'Optional metrics object; present when includeMetrics is true.',
                properties: {
                  avgFollowerCount: {
                    type: 'number',
                    description: 'Average follower count across all members.',
                  },
                  totalPosts: {
                    type: 'number',
                    description: 'Total posts by all community members on this topic.',
                  },
                  interconnectedness: {
                    type: 'number',
                    description: 'Ratio of cross-member interactions to community size.',
                  },
                },
              },
            },
            required: ['name', 'topic', 'size', 'coreMembers', 'activityLevel', 'description'],
          },
        },
        insights: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Summary observations about the discovered communities (e.g. total members, largest community).',
        },
      },
      required: ['success', 'communities', 'insights'],
    },
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
            this.logger.warn('Community member profile hydration failed for a chunk', error);
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
