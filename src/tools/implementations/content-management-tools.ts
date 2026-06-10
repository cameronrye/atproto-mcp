/**
 * Content Management Tools - Delete posts and update profiles on AT Protocol
 */

import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import {
  type ATURI,
  type IDeletePostParams,
  type IUpdateProfileParams,
  ValidationError,
} from '../../types/index.js';

/**
 * Zod schema for delete post parameters
 */
const DeletePostSchema = z.object({
  uri: z
    .string()
    .min(1, 'Post URI is required')
    .describe(
      'AT-URI of the post to delete (at://did/app.bsky.feed.post/rkey). Must belong to the authenticated user.'
    ),
});

/**
 * Zod schema for update profile parameters
 */
const UpdateProfileSchema = z.object({
  displayName: z
    .string()
    .max(64, 'Display name cannot exceed 64 characters')
    .optional()
    .describe('New display name for the profile (max 64 characters). Omit to leave unchanged.'),
  description: z
    .string()
    .max(256, 'Description cannot exceed 256 characters')
    .optional()
    .describe('New bio/description for the profile (max 256 characters). Omit to leave unchanged.'),
  avatar: z
    .any()
    .optional()
    .describe(
      'New avatar image as a Blob object. Omit to keep the existing avatar. Use upload_image to obtain a blob first.'
    ),
  banner: z
    .any()
    .optional()
    .describe(
      'New banner/header image as a Blob object. Omit to keep the existing banner. Use upload_image to obtain a blob first.'
    ),
});

/**
 * Tool for deleting posts on AT Protocol
 */
export class DeletePostTool extends BaseTool {
  public readonly schema = {
    method: 'delete_post',
    description:
      "Delete a post on AT Protocol. Permanently removes the post from the authenticated user's repository; this action cannot be undone. Use this instead of create_post/reply_to_post when you need to remove existing content. Requires authentication (app password). Subject to per-tool rate limiting.",
    params: DeletePostSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the post was successfully deleted.',
        },
        message: {
          type: 'string',
          description: 'Human-readable result message.',
        },
        deletedPost: {
          type: 'object',
          description: 'Information about the deleted post.',
          properties: {
            uri: {
              type: 'string',
              description: 'AT-URI of the deleted post.',
            },
          },
          required: ['uri'],
        },
      },
      required: ['success', 'message', 'deletedPost'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'DeletePost');
  }

  protected async execute(params: IDeletePostParams): Promise<{
    success: boolean;
    message: string;
    deletedPost: {
      uri: ATURI;
    };
  }> {
    try {
      this.logger.info('Deleting post', {
        uri: params.uri,
      });

      // Validate the post URI
      this.validateAtUri(params.uri);

      // Verify the post exists and belongs to the current user
      await this.verifyPostOwnership(params.uri);

      // Delete the post record. The repo is pinned to the authenticated user's own
      // DID (verifyPostOwnership already confirmed the URI's authority matches) and
      // the collection is pinned to app.bsky.feed.post so a non-post URI cannot
      // delete an arbitrary record type.
      const { rkey } = this.parseAtUri(params.uri);
      await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          const repo = agent.session?.did;
          if (!repo) {
            throw new Error('User session not available');
          }
          return await agent.com.atproto.repo.deleteRecord({
            repo,
            collection: 'app.bsky.feed.post',
            rkey,
          });
        },
        'deletePost',
        { uri: params.uri }
      );

      this.logger.info('Post deleted successfully', {
        uri: params.uri,
      });

      return {
        success: true,
        message: 'Post deleted successfully',
        deletedPost: {
          uri: params.uri,
        },
      };
    } catch (error) {
      this.logger.error('Failed to delete post', error);
      this.formatError(error);
    }
  }

  /**
   * Verify that the post exists and belongs to the current user
   */
  private async verifyPostOwnership(uri: string): Promise<void> {
    try {
      const agent = this.atpClient.getAgent();
      const currentUserDid = agent.session?.did;

      if (!currentUserDid) {
        throw new Error('User session not available');
      }

      // Parse and pin the collection: delete_post must only ever delete a post
      // record, never some other record type named by an untrusted URI.
      const { repo: postOwnerDid, collection, rkey } = this.parseAtUri(uri);
      if (collection !== 'app.bsky.feed.post') {
        throw new ValidationError(
          `delete_post can only delete post records (collection "${collection}" is not app.bsky.feed.post)`,
          'uri',
          uri
        );
      }

      if (postOwnerDid !== currentUserDid) {
        throw new Error('Cannot delete post: post belongs to another user');
      }

      await this.executeAtpOperation(
        async () =>
          await agent.com.atproto.repo.getRecord({
            repo: postOwnerDid,
            collection,
            rkey,
          }),
        'verifyPost',
        { uri }
      );
    } catch (error) {
      this.logger.error('Post ownership verification failed', error, { uri });
      throw error;
    }
  }
}

/**
 * Tool for updating user profiles on AT Protocol
 */
export class UpdateProfileTool extends BaseTool {
  public readonly schema = {
    method: 'update_profile',
    description:
      'Update user profile on AT Protocol. Modifies the display name, description, avatar, and/or banner of the authenticated account; unspecified fields are preserved from the existing profile. Use upload_image to prepare blob values for avatar or banner before calling this tool. Requires authentication (app password). Subject to per-tool rate limiting.',
    params: UpdateProfileSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the profile was successfully updated.',
        },
        message: {
          type: 'string',
          description: 'Human-readable result message.',
        },
        updatedFields: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Names of the profile fields that were actually changed (e.g. ["displayName", "description"]).',
        },
        profile: {
          type: 'object',
          description: 'The new values of the updated profile fields.',
          properties: {
            displayName: {
              type: 'string',
              description: 'Updated display name, if it was changed.',
            },
            description: {
              type: 'string',
              description: 'Updated bio/description, if it was changed.',
            },
            avatar: {
              type: 'string',
              description: 'Set to "updated" when a new avatar was uploaded.',
            },
            banner: {
              type: 'string',
              description: 'Set to "updated" when a new banner was uploaded.',
            },
          },
        },
      },
      required: ['success', 'message', 'updatedFields', 'profile'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'UpdateProfile');
  }

  protected async execute(params: IUpdateProfileParams): Promise<{
    success: boolean;
    message: string;
    updatedFields: string[];
    profile: {
      displayName?: string;
      description?: string;
      avatar?: string;
      banner?: string;
    };
  }> {
    try {
      this.logger.info('Updating profile', {
        hasDisplayName: !!params.displayName,
        hasDescription: !!params.description,
        hasAvatar: !!params.avatar,
        hasBanner: !!params.banner,
      });

      // Get current profile (and its CID) to merge with updates.
      const { value: currentProfile, cid: currentCid } = await this.getCurrentProfile();

      // Build updated profile record. Start from the EXISTING record so fields
      // this tool does not manage (pinnedPost, createdAt, pronouns, labels, etc.)
      // are preserved — putRecord replaces the whole record, so rebuilding it
      // from scratch would silently delete them.
      const updatedProfile: any = {
        ...currentProfile,
        $type: 'app.bsky.actor.profile',
      };

      const updatedFields: string[] = [];

      if (params.displayName !== undefined) {
        updatedProfile.displayName = params.displayName;
        updatedFields.push('displayName');
      }
      if (params.description !== undefined) {
        updatedProfile.description = params.description;
        updatedFields.push('description');
      }

      // Handle avatar upload if provided (otherwise the existing avatar, spread
      // from currentProfile above, is kept).
      if (params.avatar) {
        this.logger.debug('Uploading new avatar');
        const avatarBlob = await this.uploadBlob(params.avatar);
        updatedProfile.avatar = avatarBlob.blob;
        updatedFields.push('avatar');
      }

      // Handle banner upload if provided (otherwise the existing banner is kept).
      if (params.banner) {
        this.logger.debug('Uploading new banner');
        const bannerBlob = await this.uploadBlob(params.banner);
        updatedProfile.banner = bannerBlob.blob;
        updatedFields.push('banner');
      }

      // Update the profile record
      await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          const userDid = agent.session?.did;

          if (!userDid) {
            throw new Error('User session not available');
          }

          return await agent.com.atproto.repo.putRecord({
            repo: userDid,
            collection: 'app.bsky.actor.profile',
            rkey: 'self',
            record: updatedProfile,
            // Compare-and-swap against the CID we read so a concurrent profile
            // update is detected (InvalidSwap) instead of being silently clobbered.
            ...(currentCid ? { swapRecord: currentCid } : {}),
          });
        },
        'updateProfile',
        { updatedFields }
      );

      this.logger.info('Profile updated successfully', {
        updatedFields,
      });

      return {
        success: true,
        message: 'Profile updated successfully',
        updatedFields,
        profile: {
          displayName: updatedProfile.displayName,
          description: updatedProfile.description,
          ...(updatedProfile.avatar && { avatar: 'updated' }),
          ...(updatedProfile.banner && { banner: 'updated' }),
        },
      };
    } catch (error) {
      this.logger.error('Failed to update profile', error);
      this.formatError(error);
    }
  }

  /**
   * Get the current profile record and its CID (the CID enables a compare-and-swap
   * on write). Returns an empty value with no CID when no profile exists yet.
   */
  private async getCurrentProfile(): Promise<{ value: any; cid?: string }> {
    try {
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          const userDid = agent.session?.did;

          if (!userDid) {
            throw new Error('User session not available');
          }

          return await agent.com.atproto.repo.getRecord({
            repo: userDid,
            collection: 'app.bsky.actor.profile',
            rkey: 'self',
          });
        },
        'getCurrentProfile',
        {}
      );

      return {
        value: response.data.value || {},
        ...(response.data.cid ? { cid: response.data.cid } : {}),
      };
    } catch {
      // If profile doesn't exist, return empty value (a first-time create has no
      // prior CID to swap against).
      this.logger.debug('No existing profile found, creating new one');
      return { value: {} };
    }
  }

  // uploadBlob is provided by BaseTool.
}
