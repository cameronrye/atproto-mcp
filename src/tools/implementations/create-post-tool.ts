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
  ValidationError,
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
    // Coarse upper bound only; the real 300-grapheme / 3000-byte limit is
    // enforced in buildRichText (String.length over-counts emoji).
    .max(3000, 'Post text is too long (limit is 300 graphemes / 3000 bytes)'),
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
  langs: z
    .array(
      z
        .string()
        .regex(
          /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/,
          'Language codes must be valid BCP-47 tags (e.g. en, en-US, pt-BR)'
        )
    )
    .optional(),
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

      // Detect richtext facets (mentions/links/hashtags) so they are not stored
      // as inert plain text. agent.post() does not do this automatically.
      const { text, facets } = await this.buildRichText(params.text);

      // Build the post record
      const postRecord: any = {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString(),
      };

      if (facets) {
        postRecord.facets = facets;
      }

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
        const processedEmbed = await this.processEmbed(params.embed);
        if (processedEmbed) {
          postRecord.embed = processedEmbed;
        }
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

  // getCidFromUri is provided by BaseTool (shared by reply/batch tools).

  /**
   * Process embed data for the post
   */
  private async processEmbed(
    embed: NonNullable<ICreatePostParams['embed']>
  ): Promise<any | undefined> {
    const hasImages = !!(embed.images && embed.images.length > 0);
    const hasExternal = !!embed.external;

    // An AT Protocol post embed is a union: a post may carry images OR an
    // external link, not both. Combining them previously produced a malformed
    // record (`$type: external` with an `images` array). Reject the combination.
    if (hasImages && hasExternal) {
      throw new ValidationError(
        'A post can include either images or an external link embed, not both. Provide only one.',
        'embed',
        embed
      );
    }

    if (hasImages) {
      this.logger.debug('Processing image embeds', { count: embed.images!.length });

      const images = [];
      for (const img of embed.images!) {
        try {
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

      return {
        $type: 'app.bsky.embed.images',
        images,
      };
    }

    if (hasExternal) {
      this.logger.debug('Processing external link embed', { uri: embed.external!.uri });

      return {
        $type: 'app.bsky.embed.external',
        external: {
          uri: embed.external!.uri,
          title: embed.external!.title,
          description: embed.external!.description,
        },
      };
    }

    return undefined;
  }

  // uploadBlob is provided by BaseTool.
}
