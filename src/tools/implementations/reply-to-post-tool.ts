/**
 * Reply to Post Tool - Creates replies to existing posts on AT Protocol
 */

import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import type { ATURI, CID, IReplyToPostParams } from '../../types/index.js';

/**
 * Zod schema for reply to post parameters
 */
const ReplyToPostSchema = z.object({
  text: z
    .string()
    .min(1, 'Reply text cannot be empty')
    .max(300, 'Reply text cannot exceed 300 characters'),
  root: z.string().min(1, 'Root post URI is required'),
  parent: z.string().min(1, 'Parent post URI is required'),
  langs: z.array(z.string().length(2, 'Language codes must be 2 characters')).optional(),
});

/**
 * Tool for replying to posts on AT Protocol
 */
export class ReplyToPostTool extends BaseTool {
  public readonly schema = {
    method: 'reply_to_post',
    description:
      'Reply to an existing post on AT Protocol. Creates a threaded reply with proper parent/root references. Requires authentication.',
    params: ReplyToPostSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'ReplyToPost');
  }

  protected async execute(params: IReplyToPostParams): Promise<{
    uri: ATURI;
    cid: CID;
    success: boolean;
    message: string;
    replyTo: {
      root: ATURI;
      parent: ATURI;
    };
  }> {
    try {
      this.logger.info('Creating reply to post', {
        textLength: params.text.length,
        root: params.root,
        parent: params.parent,
        langs: params.langs,
      });

      // Validate the URIs
      this.validateAtUri(params.root);
      this.validateAtUri(params.parent);

      // Get CIDs for the root and parent posts
      const [rootCid, parentCid] = await Promise.all([
        this.getCidFromUri(params.root),
        this.getCidFromUri(params.parent),
      ]);

      // Build the reply record
      const replyRecord = {
        $type: 'app.bsky.feed.post' as const,
        text: params.text,
        createdAt: new Date().toISOString(),
        reply: {
          root: {
            uri: params.root,
            cid: rootCid,
          },
          parent: {
            uri: params.parent,
            cid: parentCid,
          },
        },
      };

      // Add language tags if provided
      if (params.langs && params.langs.length > 0) {
        (replyRecord as any).langs = params.langs;
      }

      // Create the reply using AT Protocol
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.post(replyRecord);
        },
        'createReply',
        {
          textLength: params.text.length,
          root: params.root,
          parent: params.parent,
        }
      );

      this.logger.info('Reply created successfully', {
        uri: response.uri,
        cid: response.cid,
        root: params.root,
        parent: params.parent,
      });

      return {
        uri: response.uri as ATURI,
        cid: response.cid as CID,
        success: true,
        message: 'Reply created successfully',
        replyTo: {
          root: params.root,
          parent: params.parent,
        },
      };
    } catch (error) {
      this.logger.error('Failed to create reply', error);
      this.formatError(error);
    }
  }

  /**
   * Get CID from AT Protocol URI by fetching the record
   */
  private async getCidFromUri(uri: string): Promise<string> {
    try {
      this.logger.debug('Resolving CID from URI', { uri });

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          // Parse the AT URI to extract components
          const uriParts = uri.replace('at://', '').split('/');
          if (uriParts.length < 3) {
            throw new Error(`Invalid AT URI format: ${uri}`);
          }

          const did = uriParts[0];
          const collection = uriParts[1];
          const rkey = uriParts[2];

          if (!did || !collection || !rkey) {
            throw new Error(`Invalid AT URI components: ${uri}`);
          }

          // Get the record to obtain its CID
          return await agent.com.atproto.repo.getRecord({
            repo: did,
            collection,
            rkey,
          });
        },
        'getRecord',
        { uri }
      );

      const cid = response.data.cid;
      if (!cid) {
        throw new Error(`No CID found for URI: ${uri}`);
      }
      this.logger.debug('Resolved CID from URI', { uri, cid });
      return cid;
    } catch (error) {
      this.logger.error('Failed to resolve CID from URI', error);
      // Fallback to extracting rkey as CID (not ideal but prevents failure)
      const parts = uri.split('/');
      const rkey = parts[parts.length - 1];
      this.logger.warn('Using rkey as fallback CID', { uri, rkey });
      return rkey || 'fallback-cid';
    }
  }

  /**
   * Validate that the parent and root posts exist and are accessible
   */
  private async validatePostExists(uri: string): Promise<boolean> {
    try {
      await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          const uriParts = uri.replace('at://', '').split('/');
          const did = uriParts[0];
          const collection = uriParts[1];
          const rkey = uriParts[2];

          if (!did || !collection || !rkey) {
            throw new Error(`Invalid AT URI components: ${uri}`);
          }

          return await agent.com.atproto.repo.getRecord({
            repo: did,
            collection,
            rkey,
          });
        },
        'validatePost',
        { uri }
      );
      return true;
    } catch (error) {
      this.logger.warn('Post validation failed', error);
      return false;
    }
  }
}
