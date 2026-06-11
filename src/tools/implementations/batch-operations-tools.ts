/**
 * Batch Operations Tools - Perform multiple operations in a single call
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import type { ATURI, CID, DID } from '../../types/index.js';

/**
 * Zod schema for batch_action parameters
 */
const BatchActionSchema = z.object({
  action: z.enum(['follow', 'like', 'repost']).describe('The action to apply to every target.'),
  targets: z
    .array(z.string().min(1))
    .min(1)
    .max(25)
    .describe(
      'For action=follow: handles or DIDs. For action=like/repost: post AT-URIs. 1–25 items.'
    ),
  continueOnError: z
    .boolean()
    .default(true)
    .describe(
      'Whether to keep processing remaining targets after an individual target fails. ' +
        'Defaults to true; set to false to stop at the first failure (unprocessed targets ' +
        'are reported as skipped in the summary).'
    ),
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

interface ILikeResult {
  uri: string;
  success: boolean;
  likeUri?: ATURI;
  likeCid?: CID;
  error?: string;
  alreadyLiked?: boolean;
}

interface IRepostResult {
  uri: string;
  success: boolean;
  repostUri?: ATURI;
  repostCid?: CID;
  error?: string;
  alreadyReposted?: boolean;
}

/**
 * Batch Action Tool — batch the same action across up to 25 targets in one call.
 *
 * AUTHENTICATION REQUIREMENT:
 * - Requires authentication (app password); PRIVATE mode.
 *
 * SIDE EFFECTS:
 * - Performs real writes (follows/likes/reposts) to the network on the caller's behalf.
 *
 * RATE LIMITS:
 * - Subject to per-tool rate limiting.
 */
export class BatchActionTool extends BaseTool {
  public readonly schema = {
    method: 'batch_action',
    description:
      'Batch the same action across up to 25 targets in one call. ' +
      'Supported actions: follow (handles/DIDs), like (AT-URIs), repost (AT-URIs). ' +
      'Requires authentication (app password). ' +
      "Performs real writes (follows/likes/reposts) to the network on the caller's behalf. " +
      'Subject to per-tool rate limiting.',
    params: BatchActionSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        action: { type: 'string', enum: ['follow', 'like', 'repost'] },
        results: {
          type: 'array',
          description: 'Per-target outcome {target/uri, success, error?}.',
        },
        summary: {
          type: 'object',
          description: 'Counts: total, succeeded, failed, skipped.',
        },
      },
      required: ['success', 'action', 'results', 'summary'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'BatchAction', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: {
    action: 'follow' | 'like' | 'repost';
    targets: string[];
    continueOnError: boolean;
  }): Promise<{
    success: boolean;
    action: 'follow' | 'like' | 'repost';
    results: Array<IFollowResult | ILikeResult | IRepostResult>;
    summary: {
      total: number;
      processed: number;
      skipped: number;
      succeeded: number;
      failed: number;
    };
  }> {
    const continueOnError = params.continueOnError;
    switch (params.action) {
      case 'follow': {
        const r = await this.batchFollow(params.targets, continueOnError);
        return { ...r, action: 'follow' };
      }
      case 'like': {
        const r = await this.batchLike(params.targets, continueOnError);
        return { ...r, action: 'like' };
      }
      case 'repost': {
        const r = await this.batchRepost(params.targets, continueOnError);
        return { ...r, action: 'repost' };
      }
    }
  }

  // -------------------------------------------------------------------------
  // Batched hydration helpers — one read round-trip for the whole batch
  // -------------------------------------------------------------------------

  /**
   * Fetch the post views for ALL target URIs in one app.bsky.feed.getPosts call
   * (the schema caps targets at 25, which is also getPosts' per-call limit).
   * Each view carries the post CID and the caller's viewer.like/viewer.repost
   * state, so the write loop needs no further reads. Targets that fail URI
   * validation are excluded here; the write loop re-validates and attributes
   * the error to that target. If the batched read itself fails, the error is
   * returned so the loop can attribute it per target under continueOnError.
   */
  private async hydratePostViews(uris: string[]): Promise<{
    views: Map<string, { cid?: string; viewer?: { like?: string; repost?: string } }>;
    hydrationError?: Error;
  }> {
    const views = new Map<string, { cid?: string; viewer?: { like?: string; repost?: string } }>();
    const validUris = [
      ...new Set(
        uris.filter(uri => {
          try {
            this.validateAtUri(uri);
            return true;
          } catch {
            return false;
          }
        })
      ),
    ];
    if (validUris.length === 0) {
      return { views };
    }

    try {
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getPosts({ uris: validUris });
        },
        'getPosts',
        { count: validUris.length }
      );
      for (const post of response.data.posts) {
        views.set(post.uri, post);
      }
      return { views };
    } catch (error) {
      return {
        views,
        hydrationError: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  /**
   * Fetch the profiles for ALL target actors in one app.bsky.actor.getProfiles
   * call (the schema caps targets at 25, which is also getProfiles' per-call
   * limit). Each profile view carries did/handle and viewer.following (the
   * authoritative "already following" signal), so the write loop needs no
   * further reads. Profiles are keyed by both DID and lowercased handle so
   * either form of target identifier resolves.
   */
  private async hydrateFollowProfiles(actors: string[]): Promise<{
    profiles: Map<string, { did: DID; handle?: string; followingUri?: string }>;
    hydrationError?: Error;
  }> {
    const profiles = new Map<string, { did: DID; handle?: string; followingUri?: string }>();
    const validActors = [
      ...new Set(
        actors.filter(actor => {
          try {
            this.validateActor(actor);
            return true;
          } catch {
            return false;
          }
        })
      ),
    ];
    if (validActors.length === 0) {
      return { profiles };
    }

    try {
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getProfiles({ actors: validActors });
        },
        'getProfiles',
        { count: validActors.length }
      );
      for (const profile of response.data.profiles) {
        const entry = {
          did: profile.did as DID,
          ...(profile.handle && { handle: profile.handle }),
          // viewer.following is the follow record's URI when already following.
          ...(profile.viewer?.following && { followingUri: profile.viewer.following }),
        };
        profiles.set(profile.did, entry);
        if (profile.handle) {
          profiles.set(profile.handle.toLowerCase(), entry);
        }
      }
      return { profiles };
    } catch (error) {
      return {
        profiles,
        hydrationError: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  }

  // -------------------------------------------------------------------------
  // Private action implementations (verbatim ports of the old execute bodies)
  // -------------------------------------------------------------------------

  private async batchFollow(
    actors: string[],
    continueOnError: boolean
  ): Promise<{
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
        count: actors.length,
        continueOnError,
      });

      const results: IFollowResult[] = [];
      let succeeded = 0;
      let failed = 0;
      let alreadyFollowing = 0;

      // Hydrate ALL targets in one getProfiles round-trip before the write loop.
      const { profiles, hydrationError } = await this.hydrateFollowProfiles(actors);

      for (const actor of actors) {
        try {
          // Validate the actor identifier
          this.validateActor(actor);

          if (hydrationError) {
            throw hydrationError;
          }

          // Look up the actor's hydrated profile (DID + viewer.following). An
          // actor missing from the batched response is THIS actor's failure,
          // not the batch's.
          const userProfile = profiles.get(actor) ?? profiles.get(actor.toLowerCase());
          if (!userProfile) {
            throw new Error(`Profile not found for actor: ${actor}`);
          }

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

          if (!continueOnError) {
            break;
          }
        }
      }

      this.logger.info('Batch follow completed', {
        total: actors.length,
        succeeded,
        failed,
        alreadyFollowing,
      });

      return {
        success: failed === 0,
        results,
        summary: {
          total: actors.length,
          // When continueOnError is false the loop stops early; report how many
          // items were actually processed vs skipped so `total` is not mistaken
          // for "all processed".
          processed: results.length,
          skipped: actors.length - results.length,
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

  private async batchLike(
    uris: string[],
    continueOnError: boolean
  ): Promise<{
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
        count: uris.length,
        continueOnError,
      });

      const results: ILikeResult[] = [];
      let succeeded = 0;
      let failed = 0;
      let alreadyLiked = 0;

      // One round-trip for the WHOLE batch: each post view carries both the CID
      // (for the like subject) and viewer.like (authoritative "already liked").
      const { views, hydrationError } = await this.hydratePostViews(uris);

      for (const uri of uris) {
        try {
          // Validate the URI
          this.validateAtUri(uri);

          if (hydrationError) {
            throw hydrationError;
          }

          // A URI missing from the batched response is THIS target's failure,
          // not the batch's.
          const post = views.get(uri);
          if (!post?.cid) {
            throw new Error(`Post not found or missing CID: ${uri}`);
          }

          const existingLikeUri = post.viewer?.like;
          if (existingLikeUri) {
            this.logger.debug('Post is already liked', { uri, likeUri: existingLikeUri });

            results.push({
              uri,
              success: true,
              likeUri: existingLikeUri as ATURI,
              likeCid: '' as CID,
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
              cid: post.cid,
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

          if (!continueOnError) {
            break;
          }
        }
      }

      this.logger.info('Batch like completed', {
        total: uris.length,
        succeeded,
        failed,
        alreadyLiked,
      });

      return {
        success: failed === 0,
        results,
        summary: {
          total: uris.length,
          // When continueOnError is false the loop stops early; report how many
          // items were actually processed vs skipped so `total` is not mistaken
          // for "all processed".
          processed: results.length,
          skipped: uris.length - results.length,
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

  private async batchRepost(
    uris: string[],
    continueOnError: boolean
  ): Promise<{
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
        count: uris.length,
        continueOnError,
      });

      const results: IRepostResult[] = [];
      let succeeded = 0;
      let failed = 0;
      let alreadyReposted = 0;

      // One round-trip for the WHOLE batch: each post view carries both the CID
      // (for the repost subject) and viewer.repost (authoritative "already
      // reposted").
      const { views, hydrationError } = await this.hydratePostViews(uris);

      for (const uri of uris) {
        try {
          // Validate the URI
          this.validateAtUri(uri);

          if (hydrationError) {
            throw hydrationError;
          }

          // A URI missing from the batched response is THIS target's failure,
          // not the batch's.
          const post = views.get(uri);
          if (!post?.cid) {
            throw new Error(`Post not found or missing CID: ${uri}`);
          }

          const existingRepostUri = post.viewer?.repost;
          if (existingRepostUri) {
            this.logger.debug('Post is already reposted', { uri, repostUri: existingRepostUri });

            results.push({
              uri,
              success: true,
              repostUri: existingRepostUri as ATURI,
              repostCid: '' as CID,
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
              cid: post.cid,
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

          if (!continueOnError) {
            break;
          }
        }
      }

      this.logger.info('Batch repost completed', {
        total: uris.length,
        succeeded,
        failed,
        alreadyReposted,
      });

      return {
        success: failed === 0,
        results,
        summary: {
          total: uris.length,
          // When continueOnError is false the loop stops early; report how many
          // items were actually processed vs skipped so `total` is not mistaken
          // for "all processed".
          processed: results.length,
          skipped: uris.length - results.length,
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
}
