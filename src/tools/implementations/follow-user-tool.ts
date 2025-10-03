/**
 * Follow User Tool - Follows users on AT Protocol
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import type { ATURI, CID, DID, IFollowUserParams } from '../../types/index.js';

/**
 * Zod schema for follow user parameters
 */
const FollowUserSchema = z.object({
  actor: z.string().min(1, 'Actor (DID or handle) is required'),
});

/**
 * Tool for following users on AT Protocol
 *
 * AUTHENTICATION REQUIREMENT:
 * - Requires authentication (PRIVATE mode)
 * - Must have valid credentials to follow users
 */
export class FollowUserTool extends BaseTool {
  public readonly schema = {
    method: 'follow_user',
    description:
      'Follow a user on AT Protocol. Creates a follow record for the specified user. Requires authentication.',
    params: FollowUserSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'FollowUser', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: IFollowUserParams): Promise<{
    uri: ATURI;
    cid: CID;
    success: boolean;
    message: string;
    followedUser: {
      did: DID;
      handle?: string;
    };
  }> {
    try {
      this.logger.info('Following user', {
        actor: params.actor,
      });

      // Validate the actor identifier
      this.validateActor(params.actor);

      // Resolve the actor to get their DID and profile info
      const userProfile = await this.resolveActor(params.actor);

      // Check if already following this user
      const existingFollow = await this.checkExistingFollow(userProfile.did);
      if (existingFollow) {
        this.logger.info('User is already being followed', {
          actor: params.actor,
          followUri: existingFollow.uri,
        });

        return {
          uri: existingFollow.uri as ATURI,
          cid: existingFollow.cid as CID,
          success: true,
          message: 'User was already being followed',
          followedUser: {
            did: userProfile.did,
            handle: userProfile.handle,
          },
        };
      }

      // Create the follow record
      const followRecord = {
        $type: 'app.bsky.graph.follow',
        subject: userProfile.did,
        createdAt: new Date().toISOString(),
      };

      // Create the follow using AT Protocol
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.com.atproto.repo.createRecord({
            repo: agent.session?.did || '',
            collection: 'app.bsky.graph.follow',
            record: followRecord,
          });
        },
        'createFollow',
        {
          actor: params.actor,
          targetDid: userProfile.did,
        }
      );

      this.logger.info('User followed successfully', {
        followUri: response.data.uri,
        followCid: response.data.cid,
        actor: params.actor,
        targetDid: userProfile.did,
      });

      return {
        uri: response.data.uri as ATURI,
        cid: response.data.cid as CID,
        success: true,
        message: 'User followed successfully',
        followedUser: {
          did: userProfile.did,
          handle: userProfile.handle,
        },
      };
    } catch (error) {
      this.logger.error('Failed to follow user', error);
      this.formatError(error);
    }
  }

  /**
   * Resolve actor identifier to DID and profile information
   */
  private async resolveActor(actor: string): Promise<{ did: DID; handle?: string }> {
    try {
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getProfile({ actor });
        },
        'getProfile',
        { actor }
      );

      return {
        did: response.data.did as DID,
        ...(response.data.handle && { handle: response.data.handle }),
      };
    } catch (error) {
      this.logger.error('Failed to resolve actor', error, { actor });
      throw error;
    }
  }

  /**
   * Check if the user is already being followed
   */
  private async checkExistingFollow(
    targetDid: string
  ): Promise<{ uri: string; cid: string } | null> {
    try {
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          const userDid = agent.session?.did;

          if (!userDid) {
            throw new Error('User session not available');
          }

          // List existing follows to check for duplicates
          return await agent.com.atproto.repo.listRecords({
            repo: userDid,
            collection: 'app.bsky.graph.follow',
            limit: 100, // Should be enough to find recent follows
          });
        },
        'listFollows',
        { targetDid }
      );

      // Check if any of the follows match the target user
      for (const record of response.data.records) {
        const followRecord = record.value as any;
        if (followRecord.subject === targetDid) {
          return {
            uri: record.uri,
            cid: record.cid,
          };
        }
      }

      return null;
    } catch (error) {
      this.logger.warn('Could not check for existing follow', error);
      return null;
    }
  }
}

/**
 * Unfollow User Tool - Unfollows users on AT Protocol
 *
 * AUTHENTICATION REQUIREMENT:
 * - Requires authentication (PRIVATE mode)
 * - Must have valid credentials to unfollow users
 */
export class UnfollowUserTool extends BaseTool {
  public readonly schema = {
    method: 'unfollow_user',
    description: 'Unfollow a user on AT Protocol. Deletes the follow record.',
    params: z.object({
      followUri: z.string().min(1, 'Follow URI is required'),
    }),
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'UnfollowUser', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: { followUri: string }): Promise<{
    success: boolean;
    message: string;
    deletedFollow: {
      uri: ATURI;
    };
  }> {
    try {
      this.logger.info('Unfollowing user', {
        followUri: params.followUri,
      });

      // Validate the follow URI
      this.validateAtUri(params.followUri);

      // Delete the follow record
      await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          const uriParts = params.followUri.replace('at://', '').split('/');
          const did = uriParts[0];
          const collection = uriParts[1];
          const rkey = uriParts[2];

          if (!did || !collection || !rkey) {
            throw new Error(`Invalid AT URI format: ${params.followUri}`);
          }

          return await agent.com.atproto.repo.deleteRecord({
            repo: did,
            collection,
            rkey,
          });
        },
        'deleteFollow',
        { followUri: params.followUri }
      );

      this.logger.info('User unfollowed successfully', {
        followUri: params.followUri,
      });

      return {
        success: true,
        message: 'User unfollowed successfully',
        deletedFollow: {
          uri: params.followUri as ATURI,
        },
      };
    } catch (error) {
      this.logger.error('Failed to unfollow user', error);
      this.formatError(error);
    }
  }
}
