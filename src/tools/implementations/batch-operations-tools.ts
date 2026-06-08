/**
 * Batch Operations Tools - Perform multiple operations in a single call
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import type { ATURI, CID, DID } from '../../types/index.js';

/**
 * Zod schema for batch follow parameters
 */
const BatchFollowSchema = z.object({
  actors: z.array(z.string().min(1)).min(1).max(25),
  continueOnError: z.boolean().optional().default(true),
});

interface IFollowResult {
  actor: string;
  success: boolean;
  uri?: ATURI;
  cid?: CID;
  did?: DID;
  handle?: string;
  error?: string;
  alreadyFollowing?: boolean;
}

/**
 * Batch Follow Tool - Follow multiple users in a single operation
 *
 * This tool allows following multiple users at once, reducing round-trips
 * and making it easier to manage bulk follow operations.
 *
 * AUTHENTICATION REQUIREMENT:
 * - Requires authentication (PRIVATE mode)
 * - Must have valid credentials to follow users
 */
export class BatchFollowTool extends BaseTool {
  public readonly schema = {
    method: 'batch_follow',
    description:
      'Follow multiple users in a single operation. Supports up to 25 users at once. Can continue on errors or stop at first failure. Requires authentication.',
    params: BatchFollowSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'BatchFollow', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: { actors: string[]; continueOnError?: boolean }): Promise<{
    success: boolean;
    results: IFollowResult[];
    summary: {
      total: number;
      processed: number;
      skipped: number;
      succeeded: number;
      failed: number;
      alreadyFollowing: number;
    };
  }> {
    try {
      this.logger.info('Batch following users', {
        count: params.actors.length,
        continueOnError: params.continueOnError,
      });

      const results: IFollowResult[] = [];
      let succeeded = 0;
      let failed = 0;
      let alreadyFollowing = 0;

      for (const actor of params.actors) {
        try {
          // Validate the actor identifier
          this.validateActor(actor);

          // Resolve the actor to get their DID and profile info
          const userProfile = await this.resolveActor(actor);

          // Check if already following this user (authoritative viewer state).
          if (userProfile.followingUri) {
            this.logger.debug('User is already being followed', {
              actor,
              followUri: userProfile.followingUri,
            });

            results.push({
              actor,
              success: true,
              uri: userProfile.followingUri as ATURI,
              cid: '' as CID,
              did: userProfile.did,
              handle: userProfile.handle,
              alreadyFollowing: true,
            });

            alreadyFollowing++;
            succeeded++;
            continue;
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
              actor,
              targetDid: userProfile.did,
            }
          );

          this.logger.debug('User followed successfully', {
            actor,
            followUri: response.data.uri,
          });

          results.push({
            actor,
            success: true,
            uri: response.data.uri as ATURI,
            cid: response.data.cid as CID,
            did: userProfile.did,
            handle: userProfile.handle,
            alreadyFollowing: false,
          });

          succeeded++;
        } catch (error) {
          this.logger.warn('Failed to follow user', error);

          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({
            actor,
            success: false,
            error: errorMessage,
          });

          failed++;

          if (!params.continueOnError) {
            break;
          }
        }
      }

      this.logger.info('Batch follow completed', {
        total: params.actors.length,
        succeeded,
        failed,
        alreadyFollowing,
      });

      return {
        success: failed === 0,
        results,
        summary: {
          total: params.actors.length,
          // When continueOnError is false the loop stops early; report how many
          // items were actually processed vs skipped so `total` is not mistaken
          // for "all processed".
          processed: results.length,
          skipped: params.actors.length - results.length,
          succeeded,
          failed,
          alreadyFollowing,
        },
      };
    } catch (error) {
      this.logger.error('Batch follow operation failed', error);
      this.formatError(error);
    }
  }

  /**
   * Resolve actor identifier to DID and profile information
   */
  private async resolveActor(
    actor: string
  ): Promise<{ did: DID; handle?: string; followingUri?: string }> {
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
      // viewer.following is the authoritative "am I already following this user"
      // signal (the follow record's URI), with no 100-record scan limit.
      ...(response.data.viewer?.following && { followingUri: response.data.viewer.following }),
    };
  }
}

/**
 * Zod schema for batch like parameters
 */
const BatchLikeSchema = z.object({
  uris: z.array(z.string().min(1)).min(1).max(25),
  continueOnError: z.boolean().optional().default(true),
});

interface ILikeResult {
  uri: string;
  success: boolean;
  likeUri?: ATURI;
  likeCid?: CID;
  error?: string;
  alreadyLiked?: boolean;
}

/**
 * Batch Like Tool - Like multiple posts in a single operation
 *
 * This tool allows liking multiple posts at once, reducing round-trips
 * and making it easier to manage bulk like operations.
 *
 * AUTHENTICATION REQUIREMENT:
 * - Requires authentication (PRIVATE mode)
 * - Must have valid credentials to like posts
 */
export class BatchLikeTool extends BaseTool {
  public readonly schema = {
    method: 'batch_like',
    description:
      'Like multiple posts in a single operation. Supports up to 25 posts at once. Can continue on errors or stop at first failure. Requires authentication.',
    params: BatchLikeSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'BatchLike', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: { uris: string[]; continueOnError?: boolean }): Promise<{
    success: boolean;
    results: ILikeResult[];
    summary: {
      total: number;
      processed: number;
      skipped: number;
      succeeded: number;
      failed: number;
      alreadyLiked: number;
    };
  }> {
    try {
      this.logger.info('Batch liking posts', {
        count: params.uris.length,
        continueOnError: params.continueOnError,
      });

      const results: ILikeResult[] = [];
      let succeeded = 0;
      let failed = 0;
      let alreadyLiked = 0;

      for (const uri of params.uris) {
        try {
          // Validate the URI
          this.validateAtUri(uri);

          // Get the CID for the post
          const cid = await this.getCidFromUri(uri);

          // Check if already liked
          const existingLike = await this.checkExistingLike(uri, cid);
          if (existingLike) {
            this.logger.debug('Post is already liked', {
              uri,
              likeUri: existingLike.uri,
            });

            results.push({
              uri,
              success: true,
              likeUri: existingLike.uri as ATURI,
              likeCid: existingLike.cid as CID,
              alreadyLiked: true,
            });

            alreadyLiked++;
            succeeded++;
            continue;
          }

          // Create the like record
          const likeRecord = {
            $type: 'app.bsky.feed.like',
            subject: {
              uri,
              cid,
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
            { uri }
          );

          this.logger.debug('Post liked successfully', {
            uri,
            likeUri: response.data.uri,
          });

          results.push({
            uri,
            success: true,
            likeUri: response.data.uri as ATURI,
            likeCid: response.data.cid as CID,
            alreadyLiked: false,
          });

          succeeded++;
        } catch (error) {
          this.logger.warn('Failed to like post', error);

          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({
            uri,
            success: false,
            error: errorMessage,
          });

          failed++;

          if (!params.continueOnError) {
            break;
          }
        }
      }

      this.logger.info('Batch like completed', {
        total: params.uris.length,
        succeeded,
        failed,
        alreadyLiked,
      });

      return {
        success: failed === 0,
        results,
        summary: {
          total: params.uris.length,
          // When continueOnError is false the loop stops early; report how many
          // items were actually processed vs skipped so `total` is not mistaken
          // for "all processed".
          processed: results.length,
          skipped: params.uris.length - results.length,
          succeeded,
          failed,
          alreadyLiked,
        },
      };
    } catch (error) {
      this.logger.error('Batch like operation failed', error);
      this.formatError(error);
    }
  }

  /**
   * Check if the post is already liked
   */
  private async checkExistingLike(
    postUri: string,
    _postCid: string
  ): Promise<{ uri: string; cid: string } | null> {
    try {
      // viewer.like is the authoritative "have I liked this post" signal, with
      // no 100-record scan limit (the old listRecords scan missed likes on
      // accounts with >100 likes, causing duplicate like records).
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

  // getCidFromUri is provided by BaseTool.
}

/**
 * Zod schema for batch repost parameters
 */
const BatchRepostSchema = z.object({
  uris: z.array(z.string().min(1)).min(1).max(25),
  continueOnError: z.boolean().optional().default(true),
});

interface IRepostResult {
  uri: string;
  success: boolean;
  repostUri?: ATURI;
  repostCid?: CID;
  error?: string;
  alreadyReposted?: boolean;
}

/**
 * Batch Repost Tool - Repost multiple posts in a single operation
 *
 * This tool allows reposting multiple posts at once, reducing round-trips
 * and making it easier to manage bulk repost operations.
 *
 * AUTHENTICATION REQUIREMENT:
 * - Requires authentication (PRIVATE mode)
 * - Must have valid credentials to repost
 */
export class BatchRepostTool extends BaseTool {
  public readonly schema = {
    method: 'batch_repost',
    description:
      'Repost multiple posts in a single operation. Supports up to 25 posts at once. Can continue on errors or stop at first failure. Requires authentication.',
    params: BatchRepostSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'BatchRepost', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: { uris: string[]; continueOnError?: boolean }): Promise<{
    success: boolean;
    results: IRepostResult[];
    summary: {
      total: number;
      processed: number;
      skipped: number;
      succeeded: number;
      failed: number;
      alreadyReposted: number;
    };
  }> {
    try {
      this.logger.info('Batch reposting posts', {
        count: params.uris.length,
        continueOnError: params.continueOnError,
      });

      const results: IRepostResult[] = [];
      let succeeded = 0;
      let failed = 0;
      let alreadyReposted = 0;

      for (const uri of params.uris) {
        try {
          // Validate the URI
          this.validateAtUri(uri);

          // Get the CID for the post
          const cid = await this.getCidFromUri(uri);

          // Check if already reposted
          const existingRepost = await this.checkExistingRepost(uri, cid);
          if (existingRepost) {
            this.logger.debug('Post is already reposted', {
              uri,
              repostUri: existingRepost.uri,
            });

            results.push({
              uri,
              success: true,
              repostUri: existingRepost.uri as ATURI,
              repostCid: existingRepost.cid as CID,
              alreadyReposted: true,
            });

            alreadyReposted++;
            succeeded++;
            continue;
          }

          // Create the repost record
          const repostRecord = {
            $type: 'app.bsky.feed.repost',
            subject: {
              uri,
              cid,
            },
            createdAt: new Date().toISOString(),
          };

          // Create the repost using AT Protocol
          const response = await this.executeAtpOperation(
            async () => {
              const agent = this.atpClient.getAgent();
              return await agent.com.atproto.repo.createRecord({
                repo: agent.session?.did || '',
                collection: 'app.bsky.feed.repost',
                record: repostRecord,
              });
            },
            'createRepost',
            { uri }
          );

          this.logger.debug('Post reposted successfully', {
            uri,
            repostUri: response.data.uri,
          });

          results.push({
            uri,
            success: true,
            repostUri: response.data.uri as ATURI,
            repostCid: response.data.cid as CID,
            alreadyReposted: false,
          });

          succeeded++;
        } catch (error) {
          this.logger.warn('Failed to repost post', error);

          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({
            uri,
            success: false,
            error: errorMessage,
          });

          failed++;

          if (!params.continueOnError) {
            break;
          }
        }
      }

      this.logger.info('Batch repost completed', {
        total: params.uris.length,
        succeeded,
        failed,
        alreadyReposted,
      });

      return {
        success: failed === 0,
        results,
        summary: {
          total: params.uris.length,
          // When continueOnError is false the loop stops early; report how many
          // items were actually processed vs skipped so `total` is not mistaken
          // for "all processed".
          processed: results.length,
          skipped: params.uris.length - results.length,
          succeeded,
          failed,
          alreadyReposted,
        },
      };
    } catch (error) {
      this.logger.error('Batch repost operation failed', error);
      this.formatError(error);
    }
  }

  /**
   * Check if the post is already reposted
   */
  private async checkExistingRepost(
    postUri: string,
    _postCid: string
  ): Promise<{ uri: string; cid: string } | null> {
    try {
      // viewer.repost is the authoritative "have I reposted this" signal, with
      // no 100-record scan limit.
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getPosts({ uris: [postUri] });
        },
        'getPostViewerState',
        { postUri }
      );

      const repostUri = response.data.posts[0]?.viewer?.repost;
      return repostUri ? { uri: repostUri, cid: '' } : null;
    } catch (error) {
      this.logger.warn('Could not check for existing repost', error);
      return null;
    }
  }

  // getCidFromUri is provided by BaseTool.
}
