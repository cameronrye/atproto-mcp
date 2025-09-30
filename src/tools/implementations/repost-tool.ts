/**
 * Repost Tool - Reposts content on AT Protocol
 */

import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import type { ATURI, CID, IRepostParams } from '../../types/index.js';

/**
 * Zod schema for repost parameters
 */
const RepostSchema = z.object({
  uri: z.string().min(1, 'Post URI is required'),
  cid: z.string().min(1, 'Post CID is required'),
  text: z.string().max(300, 'Quote text cannot exceed 300 characters').optional(),
});

/**
 * Tool for reposting content on AT Protocol
 */
export class RepostTool extends BaseTool {
  public readonly schema = {
    method: 'repost',
    description:
      'Repost content on AT Protocol. Can be a simple repost or a quote post with additional text.',
    params: RepostSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'Repost');
  }

  protected async execute(params: IRepostParams): Promise<{
    uri: ATURI;
    cid: CID;
    success: boolean;
    message: string;
    repostedPost: {
      uri: ATURI;
      cid: CID;
    };
    isQuotePost: boolean;
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
      };
    } catch (error) {
      this.logger.error('Failed to create repost', error);
      this.formatError(error);
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
    const quotePostRecord = {
      $type: 'app.bsky.feed.post' as const,
      text: params.text ?? '',
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
 */
export class UnrepostTool extends BaseTool {
  public readonly schema = {
    method: 'unrepost',
    description: 'Remove a repost on AT Protocol. Deletes the repost record.',
    params: z.object({
      repostUri: z.string().min(1, 'Repost URI is required'),
    }),
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'Unrepost');
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

      // Validate the repost URI
      this.validateAtUri(params.repostUri);

      // Delete the repost record
      await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          const uriParts = params.repostUri.replace('at://', '').split('/');
          const did = uriParts[0];
          const collection = uriParts[1];
          const rkey = uriParts[2];

          if (!did || !collection || !rkey) {
            throw new Error(`Invalid AT URI format: ${params.repostUri}`);
          }

          return await agent.com.atproto.repo.deleteRecord({
            repo: did,
            collection,
            rkey,
          });
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
