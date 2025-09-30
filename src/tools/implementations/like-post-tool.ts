/**
 * Like Post Tool - Likes posts on AT Protocol
 */

import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import type { ATURI, CID, ILikePostParams } from '../../types/index.js';

/**
 * Zod schema for like post parameters
 */
const LikePostSchema = z.object({
  uri: z.string().min(1, 'Post URI is required'),
  cid: z.string().min(1, 'Post CID is required'),
});

/**
 * Tool for liking posts on AT Protocol
 */
export class LikePostTool extends BaseTool {
  public readonly schema = {
    method: 'like_post',
    description:
      'Like a post on AT Protocol. Creates a like record that references the target post.',
    params: LikePostSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'LikePost');
  }

  protected async execute(params: ILikePostParams): Promise<{
    uri: ATURI;
    cid: CID;
    success: boolean;
    message: string;
    likedPost: {
      uri: ATURI;
      cid: CID;
    };
  }> {
    try {
      this.logger.info('Liking post', {
        postUri: params.uri,
        postCid: params.cid,
      });

      // Validate the post URI and CID
      this.validateAtUri(params.uri);
      this.validateCid(params.cid);

      // Check if the post is already liked
      const existingLike = await this.checkExistingLike(params.uri);
      if (existingLike) {
        this.logger.info('Post is already liked', {
          postUri: params.uri,
          likeUri: existingLike.uri,
        });

        return {
          uri: existingLike.uri as ATURI,
          cid: existingLike.cid as CID,
          success: true,
          message: 'Post was already liked',
          likedPost: {
            uri: params.uri,
            cid: params.cid,
          },
        };
      }

      // Create the like record
      const likeRecord = {
        $type: 'app.bsky.feed.like',
        subject: {
          uri: params.uri,
          cid: params.cid,
        },
        createdAt: new Date().toISOString(),
      };

      // Create the like using AT Protocol
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.com.atproto.repo.createRecord({
            repo: agent.session?.did || '',
            collection: 'app.bsky.feed.like',
            record: likeRecord,
          });
        },
        'createLike',
        {
          postUri: params.uri,
          postCid: params.cid,
        }
      );

      this.logger.info('Post liked successfully', {
        likeUri: response.data.uri,
        likeCid: response.data.cid,
        postUri: params.uri,
      });

      return {
        uri: response.data.uri as ATURI,
        cid: response.data.cid as CID,
        success: true,
        message: 'Post liked successfully',
        likedPost: {
          uri: params.uri,
          cid: params.cid,
        },
      };
    } catch (error) {
      this.logger.error('Failed to like post', error);
      this.formatError(error);
    }
  }

  /**
   * Check if the post is already liked by the current user
   */
  private async checkExistingLike(postUri: string): Promise<{ uri: string; cid: string } | null> {
    try {
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          const userDid = agent.session?.did;

          if (!userDid) {
            throw new Error('User session not available');
          }

          // List existing likes to check for duplicates
          return await agent.com.atproto.repo.listRecords({
            repo: userDid,
            collection: 'app.bsky.feed.like',
            limit: 100, // Should be enough to find recent likes
          });
        },
        'listLikes',
        { postUri }
      );

      // Check if any of the likes match the target post
      for (const record of response.data.records) {
        const likeRecord = record.value as any;
        if (likeRecord.subject?.uri === postUri) {
          return {
            uri: record.uri,
            cid: record.cid,
          };
        }
      }

      return null;
    } catch (error) {
      this.logger.warn('Could not check for existing like', error);
      return null;
    }
  }
}

/**
 * Unlike Post Tool - Removes likes from posts on AT Protocol
 */
export class UnlikePostTool extends BaseTool {
  public readonly schema = {
    method: 'unlike_post',
    description: 'Remove a like from a post on AT Protocol. Deletes the like record.',
    params: z.object({
      likeUri: z.string().min(1, 'Like URI is required'),
    }),
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'UnlikePost');
  }

  protected async execute(params: { likeUri: string }): Promise<{
    success: boolean;
    message: string;
    deletedLike: {
      uri: ATURI;
    };
  }> {
    try {
      this.logger.info('Unliking post', {
        likeUri: params.likeUri,
      });

      // Validate the like URI
      this.validateAtUri(params.likeUri);

      // Delete the like record
      await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          const uriParts = params.likeUri.replace('at://', '').split('/');
          const did = uriParts[0];
          const collection = uriParts[1];
          const rkey = uriParts[2];

          if (!did || !collection || !rkey) {
            throw new Error(`Invalid AT URI format: ${params.likeUri}`);
          }

          return await agent.com.atproto.repo.deleteRecord({
            repo: did,
            collection,
            rkey,
          });
        },
        'deleteLike',
        { likeUri: params.likeUri }
      );

      this.logger.info('Post unliked successfully', {
        likeUri: params.likeUri,
      });

      return {
        success: true,
        message: 'Post unliked successfully',
        deletedLike: {
          uri: params.likeUri as ATURI,
        },
      };
    } catch (error) {
      this.logger.error('Failed to unlike post', error);
      this.formatError(error);
    }
  }
}
