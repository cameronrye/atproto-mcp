/**
 * Like Post Tool - Likes posts on AT Protocol
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import { type ATURI, type CID, type ILikePostParams, ValidationError } from '../../types/index.js';

/**
 * Zod schema for like post parameters
 */
const LikePostSchema = z.object({
  uri: z
    .string()
    .min(1, 'Post URI is required')
    .describe('AT-URI of the post to like (at://did/app.bsky.feed.post/rkey).'),
  cid: z
    .string()
    .min(1, 'Post CID is required')
    .describe('CID of the post record; used to confirm the exact version being liked.'),
});

/**
 * Tool for liking posts on AT Protocol
 *
 * AUTHENTICATION REQUIREMENT:
 * - Requires authentication (PRIVATE mode)
 * - Must have valid credentials to like posts
 */
export class LikePostTool extends BaseTool {
  public readonly schema = {
    method: 'like_post',
    description:
      'Like a post on AT Protocol by creating a like record that references the target post. If the post is already liked the existing like is returned without creating a duplicate. Requires authentication (app password). Use unlike_post to remove a like. Subject to per-tool rate limiting.',
    params: LikePostSchema,
    outputSchema: {
      type: 'object',
      properties: {
        uri: {
          type: 'string',
          description: 'AT-URI of the newly created (or existing) like record.',
        },
        cid: { type: 'string', description: 'CID of the like record.' },
        success: { type: 'boolean', description: 'Whether the like operation succeeded.' },
        message: { type: 'string', description: 'Human-readable status message.' },
        likedPost: {
          type: 'object',
          description: 'The post that was liked.',
          properties: {
            uri: { type: 'string', description: 'AT-URI of the liked post.' },
            cid: { type: 'string', description: 'CID of the liked post.' },
          },
          required: ['uri', 'cid'],
        },
      },
      required: ['uri', 'cid', 'success', 'message', 'likedPost'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'LikePost', ToolAuthMode.PRIVATE);
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
      // Use the post's viewer.like (authoritative, single call) rather than
      // scanning the first 100 like records — that scan missed likes on accounts
      // with >100 likes and let duplicate like records be created.
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getPosts({ uris: [postUri] });
        },
        'getPostViewerState',
        { postUri }
      );

      const likeUri = response.data.posts[0]?.viewer?.like;
      return likeUri ? { uri: likeUri, cid: '' } : null;
    } catch (error) {
      this.logger.warn('Could not check for existing like', error);
      return null;
    }
  }
}

/**
 * Unlike Post Tool - Removes likes from posts on AT Protocol
 *
 * AUTHENTICATION REQUIREMENT:
 * - Requires authentication (PRIVATE mode)
 * - Must have valid credentials to unlike posts
 */
export class UnlikePostTool extends BaseTool {
  public readonly schema = {
    method: 'unlike_post',
    description:
      'Remove a like from a post on AT Protocol by deleting the like record identified by its AT-URI. This action permanently removes the like and cannot be undone. Requires authentication (app password). Use like_post to add a like. Subject to per-tool rate limiting.',
    params: z.object({
      likeUri: z
        .string()
        .min(1, 'Like URI is required')
        .describe(
          'AT-URI of the like record to delete (at://did/app.bsky.feed.like/rkey); obtained from a previous like_post response or post viewer state.'
        ),
    }),
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the unlike operation succeeded.' },
        message: { type: 'string', description: 'Human-readable status message.' },
        deletedLike: {
          type: 'object',
          description: 'The like record that was deleted.',
          properties: {
            uri: { type: 'string', description: 'AT-URI of the deleted like record.' },
          },
          required: ['uri'],
        },
      },
      required: ['success', 'message', 'deletedLike'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'UnlikePost', ToolAuthMode.PRIVATE);
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

      // Validate the like URI and pin the collection: the URI is untrusted, so we
      // must NOT delete whatever record type it happens to name. Passing e.g. a
      // post or follow URI here would otherwise delete that record.
      this.validateAtUri(params.likeUri);
      const { collection } = this.parseAtUri(params.likeUri);
      if (collection !== 'app.bsky.feed.like') {
        throw new ValidationError(
          `likeUri must reference a like record (collection "${collection}" is not app.bsky.feed.like)`,
          'likeUri',
          params.likeUri
        );
      }

      // Delete the like record via the SDK helper, which pins the collection to
      // app.bsky.feed.like and the repo to the authenticated user's own DID.
      await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.deleteLike(params.likeUri);
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
