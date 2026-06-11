/**
 * Repost Tool - Reposts content on AT Protocol
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import { type ATURI, type CID, type IRepostParams, ValidationError } from '../../types/index.js';

/**
 * Zod schema for repost parameters
 */
const RepostSchema = z.object({
  uri: z
    .string()
    .min(1, 'Post URI is required')
    .describe('AT-URI of the post to repost or quote (at://did/app.bsky.feed.post/rkey).'),
  cid: z
    .string()
    .min(1, 'Post CID is required')
    .describe('CID of the post to repost or quote; used for content integrity verification.'),
  // Coarse cap; the real 300-grapheme / 3000-byte limit is enforced in buildRichText.
  text: z
    .string()
    .max(3000, 'Quote text is too long (limit is 300 graphemes / 3000 bytes)')
    .describe(
      'Optional quote text (up to 300 graphemes / 3000 bytes). When provided the result is a quote post embedding the original; omit for a plain repost.'
    )
    .optional(),
});

/**
 * Tool for reposting content on AT Protocol
 *
 * AUTHENTICATION REQUIREMENT:
 * - Requires authentication (PRIVATE mode)
 * - Must have valid credentials to repost content
 */
export class RepostTool extends BaseTool {
  public readonly schema = {
    method: 'repost',
    description:
      "Repost content on AT Protocol. Reposts the identified post to the authenticated user's feed; if optional quote text is supplied, creates a quote post (new post embedding the original) instead. Requires authentication (app password). Deduplicates plain reposts so retrying on timeout is safe; use unrepost to remove a plain repost. Subject to per-tool rate limiting.",
    params: RepostSchema,
    outputSchema: {
      type: 'object',
      properties: {
        uri: {
          type: 'string',
          description: 'AT-URI of the newly created repost or quote-post record.',
        },
        cid: {
          type: 'string',
          description:
            'CID of the newly created repost or quote-post record. Absent when alreadyReposted=true: the existing record is reused and its CID is not re-fetched.',
        },
        success: {
          type: 'boolean',
          description: 'Whether the operation succeeded.',
        },
        message: {
          type: 'string',
          description: 'Human-readable status message.',
        },
        repostedPost: {
          type: 'object',
          description: 'The original post that was reposted or quoted.',
          properties: {
            uri: { type: 'string', description: 'AT-URI of the original post.' },
            cid: { type: 'string', description: 'CID of the original post.' },
          },
          required: ['uri', 'cid'],
        },
        isQuotePost: {
          type: 'boolean',
          description:
            'True when text was supplied and a quote post was created rather than a plain repost.',
        },
        alreadyReposted: {
          type: 'boolean',
          description:
            'True when a plain repost already existed; the existing record URI/CID is returned.',
        },
      },
      required: ['uri', 'success', 'message', 'repostedPost', 'isQuotePost', 'alreadyReposted'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'Repost', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: IRepostParams): Promise<{
    uri: ATURI;
    // Absent on the already-reposted branch: the existing record's CID is
    // unknown without an extra fetch, and an empty string would be a lie.
    cid?: CID;
    success: boolean;
    message: string;
    repostedPost: {
      uri: ATURI;
      cid: CID;
    };
    isQuotePost: boolean;
    alreadyReposted: boolean;
  }> {
    try {
      this.logger.info('Creating repost', {
        postUri: params.uri,
        postCid: params.cid,
        hasQuoteText: params.text != null && params.text !== '',
        quoteTextLength: params.text?.length ?? 0,
      });

      // Validate the post URI and CID
      this.validateAtUri(params.uri);
      this.validateCid(params.cid);

      // Check if this is a quote post or simple repost
      const isQuotePost = params.text != null && params.text !== '';

      // Idempotency: a simple repost is a no-op if the post is already reposted.
      // An LLM that retries on timeout must not create a duplicate repost record.
      // (Quote posts are genuine new posts, so they are never deduplicated.)
      if (!isQuotePost) {
        const existingRepost = await this.checkExistingRepost(params.uri);
        if (existingRepost) {
          this.logger.info('Post is already reposted; skipping duplicate', {
            postUri: params.uri,
            repostUri: existingRepost.uri,
          });
          return {
            uri: existingRepost.uri as ATURI,
            success: true,
            message: 'Post is already reposted',
            repostedPost: {
              uri: params.uri,
              cid: params.cid,
            },
            isQuotePost: false,
            alreadyReposted: true,
          };
        }
      }

      let response;

      if (isQuotePost) {
        // Create a quote post (post with embedded repost)
        response = await this.createQuotePost(params);
      } else {
        // Create a simple repost
        response = await this.createSimpleRepost(params);
      }

      const responseUri =
        'data' in (response as Record<string, unknown>)
          ? (response as { data: { uri: string } }).data.uri
          : (response as { uri: string }).uri;
      const responseCid =
        'data' in (response as Record<string, unknown>)
          ? (response as { data: { cid: string } }).data.cid
          : (response as { cid: string }).cid;

      this.logger.info('Repost created successfully', {
        repostUri: responseUri,
        repostCid: responseCid,
        postUri: params.uri,
        isQuotePost,
      });

      return {
        uri: responseUri as ATURI,
        cid: responseCid as CID,
        success: true,
        message: isQuotePost ? 'Quote post created successfully' : 'Repost created successfully',
        repostedPost: {
          uri: params.uri,
          cid: params.cid,
        },
        isQuotePost,
        alreadyReposted: false,
      };
    } catch (error) {
      this.logger.error('Failed to create repost', error);
      this.formatError(error);
    }
  }

  /**
   * Return the authoritative existing repost for a post (viewer.repost), or null.
   * Uses getPosts so there is no 100-record scan limit, mirroring BatchRepostTool.
   * viewer.repost only carries the record URI — its CID is deliberately NOT
   * fetched (that would cost an extra call), so the caller treats cid as absent.
   */
  private async checkExistingRepost(postUri: string): Promise<{ uri: string } | null> {
    try {
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getPosts({ uris: [postUri] });
        },
        'getPostViewerState',
        { postUri }
      );
      const repostUri = response.data.posts[0]?.viewer?.repost;
      return repostUri ? { uri: repostUri } : null;
    } catch (error) {
      // A failed viewer-state lookup must not block the repost; fall through to create.
      this.logger.warn('Could not check for existing repost', error);
      return null;
    }
  }

  /**
   * Create a simple repost record
   */
  private async createSimpleRepost(params: IRepostParams): Promise<unknown> {
    const repostRecord = {
      $type: 'app.bsky.feed.repost',
      subject: {
        uri: params.uri,
        cid: params.cid,
      },
      createdAt: new Date().toISOString(),
    };

    return await this.executeAtpOperation(
      async () => {
        const agent = this.atpClient.getAgent();
        return await agent.com.atproto.repo.createRecord({
          repo: agent.session?.did || '',
          collection: 'app.bsky.feed.repost',
          record: repostRecord,
        });
      },
      'createRepost',
      {
        postUri: params.uri,
        postCid: params.cid,
      }
    );
  }

  /**
   * Create a quote post (post with embedded repost)
   */
  private async createQuotePost(params: IRepostParams): Promise<unknown> {
    // Detect richtext facets (mentions/links/hashtags) just like a normal post —
    // agent.post() does NOT auto-detect them, so without this the quote text's
    // links/@mentions/#hashtags would be stored as inert plain text.
    const { text, facets } = await this.buildRichText(params.text ?? '');

    const quotePostRecord = {
      $type: 'app.bsky.feed.post' as const,
      text,
      ...(facets ? { facets } : {}),
      embed: {
        $type: 'app.bsky.embed.record',
        record: {
          uri: params.uri,
          cid: params.cid,
        },
      },
      createdAt: new Date().toISOString(),
    };

    return await this.executeAtpOperation(
      async () => {
        const agent = this.atpClient.getAgent();
        return await agent.post(quotePostRecord);
      },
      'createQuotePost',
      {
        postUri: params.uri,
        postCid: params.cid,
        quoteTextLength: params.text?.length || 0,
      }
    );
  }
}

/**
 * Unrepost Tool - Removes reposts on AT Protocol
 *
 * AUTHENTICATION REQUIREMENT:
 * - Requires authentication (PRIVATE mode)
 * - Must have valid credentials to remove reposts
 */
export class UnrepostTool extends BaseTool {
  public readonly schema = {
    method: 'unrepost',
    description:
      'Remove a repost on AT Protocol. Deletes the repost record owned by the authenticated user, undoing a previous plain repost; this action cannot be undone without re-calling repost. Requires authentication (app password). Use repost to create a repost and this tool only to remove one. Subject to per-tool rate limiting.',
    params: z.object({
      repostUri: z
        .string()
        .min(1, 'Repost URI is required')
        .describe(
          'AT-URI of the repost record to delete (at://did/app.bsky.feed.repost/rkey). Must reference a repost record, not a post.'
        ),
    }),
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the repost was successfully deleted.',
        },
        message: {
          type: 'string',
          description: 'Human-readable status message.',
        },
        deletedRepost: {
          type: 'object',
          description: 'The repost record that was deleted.',
          properties: {
            uri: { type: 'string', description: 'AT-URI of the deleted repost record.' },
          },
          required: ['uri'],
        },
      },
      required: ['success', 'message', 'deletedRepost'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'Unrepost', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: { repostUri: string }): Promise<{
    success: boolean;
    message: string;
    deletedRepost: {
      uri: ATURI;
    };
  }> {
    try {
      this.logger.info('Removing repost', {
        repostUri: params.repostUri,
      });

      // Validate the repost URI and pin the collection: the URI is untrusted, so
      // we must NOT delete whatever record type it happens to name.
      this.validateAtUri(params.repostUri);
      const { collection } = this.parseAtUri(params.repostUri);
      if (collection !== 'app.bsky.feed.repost') {
        throw new ValidationError(
          `repostUri must reference a repost record (collection "${collection}" is not app.bsky.feed.repost)`,
          'repostUri',
          params.repostUri
        );
      }

      // Delete the repost record via the SDK helper, which pins the collection to
      // app.bsky.feed.repost and the repo to the authenticated user's own DID.
      await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.deleteRepost(params.repostUri);
        },
        'deleteRepost',
        { repostUri: params.repostUri }
      );

      this.logger.info('Repost removed successfully', {
        repostUri: params.repostUri,
      });

      return {
        success: true,
        message: 'Repost removed successfully',
        deletedRepost: {
          uri: params.repostUri as ATURI,
        },
      };
    } catch (error) {
      this.logger.error('Failed to remove repost', error);
      this.formatError(error);
    }
  }
}
