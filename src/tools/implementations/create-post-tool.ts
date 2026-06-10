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
    .max(3000, 'Post text is too long (limit is 300 graphemes / 3000 bytes)')
    .describe(
      'The post body. Max 300 graphemes / 3000 bytes (emoji count as one grapheme). Mentions, links and #hashtags are auto-detected into richtext facets unless you supply `facets` explicitly.'
    ),
  reply: z
    .object({
      root: z
        .string()
        .min(1, 'Root URI is required')
        .describe('AT-URI of the root post of the thread being replied to.'),
      parent: z
        .string()
        .min(1, 'Parent URI is required')
        .describe('AT-URI of the immediate parent post being replied to.'),
    })
    .describe('Set to make this post a reply in an existing thread.')
    .optional(),
  embed: z
    .object({
      images: z
        .array(
          z.object({
            alt: z
              .string()
              .max(1000, 'Alt text cannot exceed 1000 characters')
              .describe('Accessibility alt text describing the image (max 1000 characters).'),
            image: z.any().describe('The image as a Blob to upload and attach.'), // Blob type
          })
        )
        .max(4, 'Cannot attach more than 4 images')
        .describe('Up to 4 images to attach. Mutually exclusive with `external` and `quote`.')
        .optional(),
      external: z
        .object({
          uri: z
            .string()
            .url('External URI must be a valid URL')
            .describe('The URL the external link card points to.'),
          title: z
            .string()
            .max(300, 'Title cannot exceed 300 characters')
            .describe('Title shown on the external link card (max 300 characters).'),
          description: z
            .string()
            .max(1000, 'Description cannot exceed 1000 characters')
            .describe('Description shown on the external link card (max 1000 characters).'),
        })
        .describe('An external link card to attach. Mutually exclusive with `images` and `quote`.')
        .optional(),
    })
    .describe('Optional media embed: images OR an external link card (at most one).')
    .optional(),
  facets: z
    .array(
      z.object({
        index: z
          .object({
            byteStart: z
              .number()
              .int()
              .min(0)
              .describe('Start byte offset (UTF-8) of the annotated span, inclusive.'),
            byteEnd: z
              .number()
              .int()
              .min(0)
              .describe('End byte offset (UTF-8) of the annotated span, exclusive.'),
          })
          .describe('UTF-8 byte range of the text span this facet annotates.'),
        features: z
          .array(
            z.object({
              type: z
                .enum(['mention', 'link', 'hashtag'])
                .describe('The kind of richtext feature this span represents.'),
              value: z
                .string()
                .describe(
                  'For a mention: a handle or DID; for a link: the URL; for a hashtag: the tag without the leading #.'
                ),
            })
          )
          .describe('One or more features applied to the annotated span.'),
      })
    )
    .describe(
      'Optional explicit richtext facets (byte-range annotations). For mentions, `value` is a handle or DID; for links, a URL; for hashtags, the tag without #. Omit to let the server auto-detect facets from the text.'
    )
    .optional(),
  quote: z
    .object({
      uri: z.string().min(1).describe('AT-URI of the post to quote.'),
      cid: z.string().min(1).describe('CID (content hash) of the quoted post.'),
    })
    .describe(
      'Quote another post (record embed). Mutually exclusive with the `embed.images` and `embed.external` embeds.'
    )
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
    .describe(
      'Optional BCP-47 language tags (e.g. en, en-US, pt-BR) declaring the languages of the post text.'
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
      'Create a new post on AT Protocol (Bluesky). The single rich post-creation tool: supports plain text with auto-detected mentions/links/#hashtags, explicit richtext facets, replies, image embeds, an external link card, a quote (record) embed, and language tags. ' +
      'Requires authentication (app password). SIDE EFFECT: publishes a public post visible to everyone. Subject to per-tool rate limiting. ' +
      'Use create_thread to publish a multi-post chain in one call, and reply_to_post to reply to an existing post; use this tool for a single standalone post (it can also reply via the `reply` field).',
    params: CreatePostSchema,
    outputSchema: {
      type: 'object',
      properties: {
        uri: { type: 'string', description: 'AT-URI of the newly created post.' },
        cid: { type: 'string', description: 'CID (content hash) of the newly created post.' },
        success: {
          type: 'boolean',
          description: 'Whether the post was created successfully.',
        },
        message: {
          type: 'string',
          description: 'Human-readable status message.',
        },
      },
      required: ['uri', 'cid', 'success', 'message'],
    },
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
        hasQuote: !!params.quote,
        hasExplicitFacets: !!params.facets?.length,
        langs: params.langs,
      });

      // Validate reply parameters if provided
      if (params.reply) {
        this.validateAtUri(params.reply.root);
        this.validateAtUri(params.reply.parent);
      }

      // Build the post record. Facet handling is a choice between two sources:
      // explicit caller-supplied facets win and disable auto-detection (applying
      // both would double-annotate the text); otherwise auto-detect.
      const postRecord: any = {
        $type: 'app.bsky.feed.post',
        createdAt: new Date().toISOString(),
      };

      if (params.facets && params.facets.length > 0) {
        // Caller-supplied facets are UNTRUSTED: validate each byte range against
        // the text's UTF-8 length and resolve mention handles to DIDs. Enforce the
        // grapheme/byte text limits here too — the auto-detect path does so via
        // buildRichText, and the explicit-facets path must not skip them.
        this.assertPostTextWithinLimits(params.text);
        postRecord.text = params.text;
        postRecord.facets = await this.buildExplicitFacets(params.text, params.facets);
      } else {
        // Detect richtext facets (mentions/links/hashtags) so they are not stored
        // as inert plain text. agent.post() does not do this automatically.
        const { text, facets } = await this.buildRichText(params.text);
        postRecord.text = text;
        if (facets) {
          postRecord.facets = facets;
        }
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

      // Handle embeds if provided. A post embed is a union — images OR an
      // external link OR a quote (record), at most one.
      const processedEmbed = await this.processEmbed(params.embed, params.quote);
      if (processedEmbed) {
        postRecord.embed = processedEmbed;
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
   * Build caller-supplied richtext facets for the post.
   *
   * Caller-supplied facets are UNTRUSTED: validate the byte range against the
   * text's UTF-8 length (a bad range silently links the wrong substring or is
   * rejected by the PDS), and resolve mention handles to DIDs (a mention facet
   * must carry a DID, not a handle).
   */
  private async buildExplicitFacets(
    text: string,
    facets: NonNullable<ICreatePostParams['facets']>
  ): Promise<any[]> {
    const textByteLength = Buffer.byteLength(text, 'utf8');
    const builtFacets: any[] = [];
    for (const facet of facets) {
      const { byteStart, byteEnd } = facet.index;
      if (byteStart >= byteEnd || byteEnd > textByteLength) {
        throw new ValidationError(
          `Invalid facet byte range [${byteStart}, ${byteEnd}); must satisfy ` +
            `byteStart < byteEnd <= ${textByteLength} (the text's UTF-8 byte length).`,
          'facets'
        );
      }
      const features: any[] = [];
      for (const feature of facet.features) {
        switch (feature.type) {
          case 'mention': {
            const did = feature.value.startsWith('did:')
              ? feature.value
              : await this.resolveDid(feature.value);
            features.push({ $type: 'app.bsky.richtext.facet#mention', did });
            break;
          }
          case 'link':
            features.push({ $type: 'app.bsky.richtext.facet#link', uri: feature.value });
            break;
          case 'hashtag':
            features.push({ $type: 'app.bsky.richtext.facet#tag', tag: feature.value });
            break;
          default:
            features.push(feature);
        }
      }
      builtFacets.push({ index: facet.index, features });
    }
    return builtFacets;
  }

  /**
   * Process embed data for the post.
   *
   * An AT Protocol post embed is a union: a post may carry images OR an external
   * link OR a quote (record) embed — at most one. Combining any two previously
   * produced a malformed record, so any combination is rejected here.
   */
  private async processEmbed(
    embed: ICreatePostParams['embed'],
    quote: ICreatePostParams['quote']
  ): Promise<any | undefined> {
    const hasImages = !!(embed?.images && embed.images.length > 0);
    const hasExternal = !!embed?.external;
    const hasQuote = !!quote;

    const selected = [hasImages, hasExternal, hasQuote].filter(Boolean).length;
    if (selected > 1) {
      throw new ValidationError(
        'A post can include only one embed: images, an external link, or a quote (record) — not a combination. Provide only one.',
        'embed',
        { embed, quote }
      );
    }

    if (hasQuote && quote) {
      this.logger.debug('Processing quote (record) embed', { uri: quote.uri });

      return {
        $type: 'app.bsky.embed.record',
        record: {
          uri: quote.uri,
          cid: quote.cid,
        },
      };
    }

    if (hasImages && embed?.images) {
      this.logger.debug('Processing image embeds', { count: embed.images.length });

      const images = [];
      for (const img of embed.images) {
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

    if (hasExternal && embed?.external) {
      this.logger.debug('Processing external link embed', { uri: embed.external.uri });

      return {
        $type: 'app.bsky.embed.external',
        external: {
          uri: embed.external.uri,
          title: embed.external.title,
          description: embed.external.description,
        },
      };
    }

    return undefined;
  }

  // uploadBlob is provided by BaseTool.
}
