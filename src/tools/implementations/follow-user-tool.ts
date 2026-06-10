/**
 * Follow User Tool - Follows users on AT Protocol
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import {
  type ATURI,
  type CID,
  type DID,
  type IFollowUserParams,
  ValidationError,
} from '../../types/index.js';

/**
 * Zod schema for follow user parameters
 */
const FollowUserSchema = z.object({
  actor: z
    .string()
    .min(1, 'Actor (DID or handle) is required')
    .describe('Handle (e.g. alice.bsky.social) or DID of the account to follow.'),
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
      'Follow a user on AT Protocol. Creates a follow record for the specified account; if the account is already followed the existing follow URI is returned without creating a duplicate. Requires authentication (app password). Use unfollow_user to reverse this action; for bulk relationship changes consider batch_action instead. Subject to per-tool rate limiting.',
    params: FollowUserSchema,
    outputSchema: {
      type: 'object',
      properties: {
        uri: {
          type: 'string',
          description: 'AT-URI of the follow record (at://did/app.bsky.graph.follow/rkey).',
        },
        cid: {
          type: 'string',
          description: 'CID of the follow record; empty string when the follow already existed.',
        },
        success: {
          type: 'boolean',
          description: 'Whether the follow is now in effect (true even if already followed).',
        },
        message: {
          type: 'string',
          description: 'Human-readable outcome message.',
        },
        followedUser: {
          type: 'object',
          description: 'Identifying information for the account that was followed.',
          properties: {
            did: {
              type: 'string',
              description: 'Decentralised Identifier of the followed account.',
            },
            handle: {
              type: 'string',
              description: 'Human-readable handle of the followed account, if available.',
            },
          },
          required: ['did'],
        },
      },
      required: ['uri', 'cid', 'success', 'message', 'followedUser'],
    },
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

      // Resolve the actor to get their DID, profile info, and the authoritative
      // "am I already following this user" signal (viewer.following).
      const userProfile = await this.resolveActor(params.actor);

      // Check if already following this user. viewer.following is the
      // authoritative signal — unlike a listRecords scan, it does not miss
      // follows beyond the first page on accounts that follow >100 users.
      if (userProfile.followingUri) {
        this.logger.info('User is already being followed', {
          actor: params.actor,
          followUri: userProfile.followingUri,
        });

        return {
          uri: userProfile.followingUri as ATURI,
          cid: '' as CID,
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
   * Resolve actor identifier to DID, profile information, and existing-follow state.
   *
   * `viewer.following` (the follow record's AT-URI when the authenticated user
   * already follows this actor) is the authoritative duplicate signal — unlike
   * a listRecords scan it does not miss follows beyond the first page on
   * accounts that follow >100 users.
   */
  private async resolveActor(
    actor: string
  ): Promise<{ did: DID; handle?: string; followingUri?: string }> {
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
        ...(response.data.viewer?.following && {
          followingUri: response.data.viewer.following,
        }),
      };
    } catch (error) {
      this.logger.error('Failed to resolve actor', error, { actor });
      throw error;
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
    description:
      'Unfollow a user on AT Protocol. Deletes the follow record identified by its AT-URI, permanently removing the follow relationship; this action cannot be undone (a new follow_user call is required to re-follow). Requires authentication (app password). Use follow_user to obtain the follow URI before calling this tool; for bulk unfollows consider batch_action. Subject to per-tool rate limiting.',
    params: z.object({
      followUri: z
        .string()
        .min(1, 'Follow URI is required')
        .describe(
          'AT-URI of the follow record to delete (at://did/app.bsky.graph.follow/rkey). Must reference an app.bsky.graph.follow collection record.'
        ),
    }),
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'True when the follow record was successfully deleted.',
        },
        message: {
          type: 'string',
          description: 'Human-readable outcome message.',
        },
        deletedFollow: {
          type: 'object',
          description: 'Information about the deleted follow record.',
          properties: {
            uri: {
              type: 'string',
              description: 'AT-URI of the deleted follow record.',
            },
          },
          required: ['uri'],
        },
      },
      required: ['success', 'message', 'deletedFollow'],
    },
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

      // Validate the follow URI and pin the collection: the URI is untrusted, so
      // we must NOT delete whatever record type it happens to name. A crafted URI
      // such as at://<self-did>/app.bsky.feed.post/<rkey> would otherwise delete
      // that post instead of a follow.
      this.validateAtUri(params.followUri);
      const { collection } = this.parseAtUri(params.followUri);
      if (collection !== 'app.bsky.graph.follow') {
        throw new ValidationError(
          `followUri must reference a follow record (collection "${collection}" is not app.bsky.graph.follow)`,
          'followUri',
          params.followUri
        );
      }

      // Delete the follow record via the SDK helper, which pins the collection to
      // app.bsky.graph.follow and the repo to the authenticated user's own DID.
      await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.deleteFollow(params.followUri);
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
