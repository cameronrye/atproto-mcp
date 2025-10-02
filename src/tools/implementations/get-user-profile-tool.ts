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
  actor: z.string().min(1, 'Actor (DID or handle) is required'),
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
      'Retrieve a user profile from AT Protocol. Returns detailed profile information including stats and verification status. Works without authentication but provides additional viewer-specific data (following status, muted/blocked status) when authenticated.',
    params: GetUserProfileSchema,
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

      // Get the user profiles from AT Protocol
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getProfiles({ actors });
        },
        'getProfiles',
        { actorCount: actors.length }
      );

      const profiles = response.data.profiles.map((profileData: any) => ({
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
