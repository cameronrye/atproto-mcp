/**
 * Create Post Tool - Creates new posts on AT Protocol
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import {
  type ATURI,
  type CID,
  type ICreatePostParams,
  validateATURI,
  validateCID,
} from '../../types/index.js';

/**
 * Zod schema for create post parameters
 */
const CreatePostSchema = z.object({
  text: z
    .string()
    .min(1, 'Post text cannot be empty')
    .max(300, 'Post text cannot exceed 300 characters'),
  reply: z
    .object({
      root: z.string().min(1, 'Root URI is required'),
      parent: z.string().min(1, 'Parent URI is required'),
    })
    .optional(),
  embed: z
    .object({
      images: z
        .array(
          z.object({
            alt: z.string().max(1000, 'Alt text cannot exceed 1000 characters'),
            image: z.any(), // Blob type
          })
        )
        .max(4, 'Cannot attach more than 4 images')
        .optional(),
      external: z
        .object({
          uri: z.string().url('External URI must be a valid URL'),
          title: z.string().max(300, 'Title cannot exceed 300 characters'),
          description: z.string().max(1000, 'Description cannot exceed 1000 characters'),
        })
        .optional(),
    })
    .optional(),
  langs: z.array(z.string().length(2, 'Language codes must be 2 characters')).optional(),
});

/**
 * Tool for creating new posts on AT Protocol
 *
 * AUTHENTICATION REQUIREMENT:
 * - Requires authentication (PRIVATE mode)
 * - Must have valid credentials to create posts
 */
export class CreatePostTool extends BaseTool {
  public readonly schema = {
    method: 'create_post',
    description:
      'Create a new post on AT Protocol. Supports text, replies, images, external links, and language tags. Requires authentication.',
    params: CreatePostSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'CreatePost', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: ICreatePostParams): Promise<{
    uri: ATURI;
    cid: CID;
    success: boolean;
    message: string;
  }> {
    try {
      this.logger.info('Creating new post', {
        textLength: params.text.length,
        hasReply: !!params.reply,
        hasEmbed: !!params.embed,
        langs: params.langs,
      });

      // Validate reply parameters if provided
      if (params.reply) {
        this.validateAtUri(params.reply.root);
        this.validateAtUri(params.reply.parent);
      }

      // Build the post record
      const postRecord: any = {
        $type: 'app.bsky.feed.post',
        text: params.text,
        createdAt: new Date().toISOString(),
      };

      // Add reply information if this is a reply
      if (params.reply) {
        postRecord.reply = {
          root: {
            uri: params.reply.root,
            cid: await this.getCidFromUri(params.reply.root),
          },
          parent: {
            uri: params.reply.parent,
            cid: await this.getCidFromUri(params.reply.parent),
          },
        };
      }

      // Add language tags if provided
      if (params.langs && params.langs.length > 0) {
        postRecord.langs = params.langs;
      }

      // Handle embeds if provided
      if (params.embed) {
        postRecord.embed = await this.processEmbed(params.embed);
      }

      // Create the post using AT Protocol
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.post(postRecord);
        },
        'createPost',
        { textLength: params.text.length }
      );

      this.logger.info('Post created successfully', {
        uri: response.uri,
        cid: response.cid,
      });

      // Validate and convert response values to branded types
      const uri = validateATURI(response.uri);
      const cid = validateCID(response.cid);

      return {
        uri,
        cid,
        success: true,
        message: 'Post created successfully',
      };
    } catch (error) {
      this.logger.error('Failed to create post', error);
      this.formatError(error);
    }
  }

  /**
   * Get CID from AT Protocol URI by resolving the record
   *
   * AT Protocol URIs have the format: at://did:plc:xxx/collection/rkey
   * This method fetches the actual record to get its CID
   */
  private async getCidFromUri(uri: string): Promise<string> {
    try {
      this.logger.debug('Resolving CID from URI', { uri });

      // Parse the AT URI: at://did:plc:xxx/collection/rkey
      if (!uri.startsWith('at://')) {
        throw new Error(`Invalid AT Protocol URI: ${uri}`);
      }

      const uriWithoutProtocol = uri.slice(5); // Remove 'at://'
      const parts = uriWithoutProtocol.split('/');

      if (parts.length < 3) {
        throw new Error(`Malformed AT Protocol URI: ${uri}`);
      }

      const repo = parts[0]!; // DID (guaranteed by length check)
      const collection = parts[1]!; // e.g., 'app.bsky.feed.post' (guaranteed by length check)
      const rkey = parts[2]!; // Record key (guaranteed by length check)

      // Fetch the record from AT Protocol to get its CID
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.com.atproto.repo.getRecord({
            repo,
            collection,
            rkey,
          });
        },
        'getRecord',
        { uri, repo, collection, rkey }
      );

      if (!response.data.cid) {
        throw new Error(`No CID found in record response for URI: ${uri}`);
      }

      this.logger.debug('Successfully resolved CID from URI', {
        uri,
        cid: response.data.cid,
      });

      return response.data.cid;
    } catch (error) {
      this.logger.error('Failed to resolve CID from URI', error, { uri });
      throw new Error(
        `Could not resolve CID from URI ${uri}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Process embed data for the post
   */
  private async processEmbed(embed: NonNullable<ICreatePostParams['embed']>): Promise<any> {
    const processedEmbed: any = {};

    // Handle image embeds
    if (embed.images && embed.images.length > 0) {
      this.logger.debug('Processing image embeds', { count: embed.images.length });

      const images = [];
      for (const img of embed.images) {
        try {
          // Upload the image blob
          const uploadResult = await this.uploadBlob(img.image);
          images.push({
            alt: img.alt,
            image: uploadResult.blob,
          });
        } catch (error) {
          this.logger.error('Failed to upload image', error);
          throw error;
        }
      }

      processedEmbed.$type = 'app.bsky.embed.images';
      processedEmbed.images = images;
    }

    // Handle external link embeds
    if (embed.external) {
      this.logger.debug('Processing external link embed', { uri: embed.external.uri });

      processedEmbed.$type = 'app.bsky.embed.external';
      processedEmbed.external = {
        uri: embed.external.uri,
        title: embed.external.title,
        description: embed.external.description,
      };
    }

    return processedEmbed;
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
