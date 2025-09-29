/**
 * Content Management Tools - Delete posts and update profiles on AT Protocol
 */

import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import type { ATURI, IDeletePostParams, IUpdateProfileParams } from '../../types/index.js';

/**
 * Zod schema for delete post parameters
 */
const DeletePostSchema = z.object({
  uri: z.string().min(1, 'Post URI is required'),
});

/**
 * Zod schema for update profile parameters
 */
const UpdateProfileSchema = z.object({
  displayName: z.string().max(64, 'Display name cannot exceed 64 characters').optional(),
  description: z.string().max(256, 'Description cannot exceed 256 characters').optional(),
  avatar: z.any().optional(), // Blob type
  banner: z.any().optional(), // Blob type
});

/**
 * Tool for deleting posts on AT Protocol
 */
export class DeletePostTool extends BaseTool {
  public readonly schema = {
    method: 'delete_post',
    description:
      "Delete a post on AT Protocol. Permanently removes the post from the user's repository.",
    params: DeletePostSchema,
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

      // Delete the post record
      await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          const uriParts = params.uri.replace('at://', '').split('/');
          const did = uriParts[0];
          const collection = uriParts[1];
          const rkey = uriParts[2];

          if (!did || !collection || !rkey) {
            throw new Error(`Invalid AT URI format: ${params.uri}`);
          }

          return await agent.com.atproto.repo.deleteRecord({
            repo: did,
            collection,
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

      // Extract DID from URI
      const uriParts = uri.replace('at://', '').split('/');
      const postOwnerDid = uriParts[0];

      if (postOwnerDid !== currentUserDid) {
        throw new Error('Cannot delete post: post belongs to another user');
      }

      // Verify the post exists
      const collection = uriParts[1];
      const rkey = uriParts[2];

      await this.executeAtpOperation(
        async () => {
          if (!collection || !rkey) {
            throw new Error(`Invalid AT URI format: ${uri}`);
          }

          return await agent.com.atproto.repo.getRecord({
            repo: postOwnerDid,
            collection,
            rkey,
          });
        },
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
      'Update user profile on AT Protocol. Can modify display name, description, avatar, and banner.',
    params: UpdateProfileSchema,
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

      // Get current profile to merge with updates
      const currentProfile = await this.getCurrentProfile();

      // Build updated profile record
      const updatedProfile: any = {
        $type: 'app.bsky.actor.profile',
        displayName:
          params.displayName !== undefined ? params.displayName : currentProfile.displayName,
        description:
          params.description !== undefined ? params.description : currentProfile.description,
      };

      const updatedFields: string[] = [];

      // Handle avatar upload if provided
      if (params.avatar) {
        this.logger.debug('Uploading new avatar');
        const avatarBlob = await this.uploadBlob(params.avatar);
        updatedProfile.avatar = avatarBlob.blob;
        updatedFields.push('avatar');
      } else if (currentProfile.avatar) {
        updatedProfile.avatar = currentProfile.avatar;
      }

      // Handle banner upload if provided
      if (params.banner) {
        this.logger.debug('Uploading new banner');
        const bannerBlob = await this.uploadBlob(params.banner);
        updatedProfile.banner = bannerBlob.blob;
        updatedFields.push('banner');
      } else if (currentProfile.banner) {
        updatedProfile.banner = currentProfile.banner;
      }

      // Track which fields were updated
      if (params.displayName !== undefined) updatedFields.push('displayName');
      if (params.description !== undefined) updatedFields.push('description');

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
   * Get current profile record
   */
  private async getCurrentProfile(): Promise<any> {
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

      return response.data.value || {};
    } catch (error) {
      // If profile doesn't exist, return empty object
      this.logger.debug('No existing profile found, creating new one');
      return {};
    }
  }

  /**
   * Upload a blob to AT Protocol
   */
  private async uploadBlob(blob: Blob): Promise<{ blob: any }> {
    return await this.executeAtpOperation(
      async () => {
        const agent = this.atpClient.getAgent();
        const response = await agent.uploadBlob(blob, {
          encoding: blob.type,
        });
        return response.data;
      },
      'uploadBlob',
      { blobSize: blob.size, blobType: blob.type }
    );
  }
}
