/**
 * Get User Profile Tool - Retrieves user profiles from AT Protocol
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import type { DID, IAtpProfile, IGetUserProfileParams } from '../../types/index.js';

/**
 * Zod schema for get user profile parameters
 */
const GetUserProfileSchema = z.object({
  actor: z
    .string()
    .min(1, 'Actor (DID or handle) is required')
    .describe(
      'Handle (e.g. alice.bsky.social) or DID (e.g. did:plc:...) of the account whose profile to retrieve.'
    ),
});

/**
 * Tool for retrieving user profiles from AT Protocol
 *
 * AUTHENTICATION BEHAVIOR:
 * - Works in both authenticated and unauthenticated modes (ToolAuthMode.ENHANCED)
 * - In unauthenticated mode: Returns basic profile information (handle, display name,
 *   description, avatar, follower counts, etc.)
 * - In authenticated mode: Returns the same basic information PLUS viewer-specific
 *   data such as:
 *   - Whether you follow this user (viewer.following)
 *   - Whether this user follows you (viewer.followedBy)
 *   - Whether you have muted this user (viewer.muted)
 *   - Whether you have blocked this user (viewer.blocking)
 *   - Whether this user has blocked you (viewer.blockedBy)
 *
 * The difference in data comes from the AT Protocol API itself, not from this tool's
 * implementation. The tool calls the same agent.getProfile() method in both modes,
 * but the AT Protocol API returns different data based on authentication state.
 */
export class GetUserProfileTool extends BaseTool {
  public readonly schema = {
    method: 'get_user_profile',
    description:
      'Retrieve a user profile from AT Protocol, returning handle, display name, bio, avatar, banner, follower/following/post counts, and applied labels. Works without authentication; richer with auth — authenticated calls also return viewer-specific fields (following, followedBy, muted, blocking, blockedBy). Use get_user_summary for a condensed overview or get_user_connections for follower/following lists. Subject to per-tool rate limiting.',
    params: GetUserProfileSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the profile was retrieved successfully.',
        },
        profile: {
          type: 'object',
          description: 'Full profile record for the requested account.',
          properties: {
            did: {
              type: 'string',
              description: 'Decentralized identifier (DID) of the account.',
            },
            handle: {
              type: 'string',
              description: 'Human-readable handle of the account (e.g. alice.bsky.social).',
            },
            displayName: {
              type: 'string',
              description: 'Display name set by the user, if any.',
            },
            description: {
              type: 'string',
              description: 'Bio/description text set by the user, if any.',
            },
            avatar: {
              type: 'string',
              description: 'URL of the account avatar image, if set.',
            },
            banner: {
              type: 'string',
              description: 'URL of the profile banner image, if set.',
            },
            followersCount: {
              type: 'number',
              description: 'Number of accounts following this user.',
            },
            followsCount: {
              type: 'number',
              description: 'Number of accounts this user follows.',
            },
            postsCount: {
              type: 'number',
              description: 'Total number of posts authored by this user.',
            },
            indexedAt: {
              type: 'string',
              description: 'ISO 8601 timestamp of when this profile was last indexed.',
            },
            viewer: {
              type: 'object',
              description: 'Viewer-specific relationship data; only populated when authenticated.',
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
            labels: {
              type: 'array',
              description: 'Moderation labels applied to this account.',
              items: {
                type: 'object',
                properties: {
                  src: {
                    type: 'string',
                    description: 'DID of the labeler that issued this label.',
                  },
                  uri: {
                    type: 'string',
                    description: 'AT-URI of the subject that was labelled.',
                  },
                  cid: {
                    type: 'string',
                    description: 'CID of the labelled record version.',
                  },
                  val: {
                    type: 'string',
                    description: 'Label value string (e.g. "spam", "nudity").',
                  },
                  cts: {
                    type: 'string',
                    description: 'ISO 8601 timestamp when the label was created.',
                  },
                },
                required: ['src', 'uri', 'cid', 'val', 'cts'],
              },
            },
          },
          required: ['did', 'handle'],
        },
      },
      required: ['success', 'profile'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'GetUserProfile', ToolAuthMode.ENHANCED);
  }

  protected async execute(params: IGetUserProfileParams): Promise<{
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
      labels?: Array<{
        src: string;
        uri: string;
        cid: string;
        val: string;
        cts: string;
      }>;
    };
  }> {
    try {
      this.logger.info('Retrieving user profile', {
        actor: params.actor,
      });

      // Validate the actor identifier
      this.validateActor(params.actor);

      // Get the user profile from AT Protocol
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getProfile({ actor: params.actor });
        },
        'getProfile',
        { actor: params.actor }
      );

      const profileData = response.data;

      // Transform the profile data to match our interface
      const profile: IAtpProfile & {
        indexedAt?: string;
        viewer?: {
          muted?: boolean;
          blockedBy?: boolean;
          blocking?: string;
          following?: string;
          followedBy?: string;
        };
        labels?: Array<{
          src: string;
          uri: string;
          cid: string;
          val: string;
          cts: string;
        }>;
      } = {
        did: profileData.did as DID,
        handle: profileData.handle,
        displayName: profileData.displayName,
        description: profileData.description,
        avatar: profileData.avatar,
        banner: profileData.banner,
        followersCount: profileData.followersCount,
        followsCount: profileData.followsCount,
        postsCount: profileData.postsCount,
        indexedAt: profileData.indexedAt,
        viewer: profileData.viewer
          ? {
              muted: profileData.viewer.muted,
              blockedBy: profileData.viewer.blockedBy,
              blocking: profileData.viewer.blocking,
              following: profileData.viewer.following,
              followedBy: profileData.viewer.followedBy,
            }
          : undefined,
        labels: profileData.labels?.map((label: any) => ({
          src: label.src,
          uri: label.uri,
          cid: label.cid,
          val: label.val,
          cts: label.cts,
        })),
      };

      this.logger.info('User profile retrieved successfully', {
        actor: params.actor,
        did: profile.did,
        handle: profile.handle,
        displayName: profile.displayName,
        followersCount: profile.followersCount,
        followsCount: profile.followsCount,
        postsCount: profile.postsCount,
      });

      return {
        success: true,
        profile,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve user profile', error);
      this.formatError(error);
    }
  }

  /**
   * Get multiple user profiles in batch
   */
  public async getProfiles(actors: string[]): Promise<{
    success: boolean;
    profiles: Array<
      IAtpProfile & {
        indexedAt?: string;
        viewer?: {
          muted?: boolean;
          blockedBy?: boolean;
          blocking?: string;
          following?: string;
          followedBy?: string;
        };
      }
    >;
  }> {
    try {
      this.logger.info('Retrieving multiple user profiles', {
        actorCount: actors.length,
        actors: actors.slice(0, 5), // Log first 5 for debugging
      });

      // Validate all actor identifiers
      for (const actor of actors) {
        this.validateActor(actor);
      }

      // app.bsky.actor.getProfiles caps `actors` at 25 per request, so chunk
      // larger requests into batches of 25 and concatenate the results.
      const MAX_ACTORS_PER_REQUEST = 25;
      const batches: string[][] = [];
      for (let i = 0; i < actors.length; i += MAX_ACTORS_PER_REQUEST) {
        batches.push(actors.slice(i, i + MAX_ACTORS_PER_REQUEST));
      }

      const profileData: any[] = [];
      for (const batch of batches) {
        const response = await this.executeAtpOperation(
          async () => {
            const agent = this.atpClient.getAgent();
            return await agent.getProfiles({ actors: batch });
          },
          'getProfiles',
          { actorCount: batch.length }
        );
        profileData.push(...response.data.profiles);
      }

      const profiles = profileData.map((p: any) => ({
        did: p.did as DID,
        handle: p.handle,
        displayName: p.displayName,
        description: p.description,
        avatar: p.avatar,
        banner: p.banner,
        followersCount: p.followersCount,
        followsCount: p.followsCount,
        postsCount: p.postsCount,
        indexedAt: p.indexedAt,
        viewer: p.viewer
          ? {
              muted: p.viewer.muted,
              blockedBy: p.viewer.blockedBy,
              blocking: p.viewer.blocking,
              following: p.viewer.following,
              followedBy: p.viewer.followedBy,
            }
          : undefined,
      }));

      this.logger.info('Multiple user profiles retrieved successfully', {
        requestedCount: actors.length,
        retrievedCount: profiles.length,
      });

      return {
        success: true,
        profiles,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve multiple user profiles', error);
      throw error;
    }
  }
}
