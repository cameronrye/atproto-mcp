/**
 * Create Post Tool - Creates new posts on AT Protocol
 */

import { z } from 'zod';
import { BaseTool, BlobDescriptorSchema, ToolAuthMode, blobDescriptorToLex } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import {
  type ATURI,
  type CID,
  type ICreatePostParams,
  type IQuoteControls,
  type IReplyControls,
  ValidationError,
  validateATURI,
  validateCID,
} from '../../types/index.js';

/**
 * A single app.bsky.feed.threadgate allow rule in lexicon form.
 */
export interface IThreadgateAllowRule {
  $type: string;
  list?: string;
}

/**
 * Map the tool-level reply controls onto app.bsky.feed.threadgate allow rules.
 * Pure and shared with create_thread. An empty result is meaningful: per the
 * lexicon, `allow: []` means NOBODY can reply (whereas omitting the record
 * entirely leaves replies open).
 */
export function buildThreadgateAllowRules(controls: IReplyControls): IThreadgateAllowRule[] {
  const rules: IThreadgateAllowRule[] = [];
  if (controls.allowMentioned) {
    rules.push({ $type: 'app.bsky.feed.threadgate#mentionRule' });
  }
  if (controls.allowFollowing) {
    rules.push({ $type: 'app.bsky.feed.threadgate#followingRule' });
  }
  if (controls.allowFollowers) {
    rules.push({ $type: 'app.bsky.feed.threadgate#followerRule' });
  }
  for (const list of controls.allowListUris ?? []) {
    rules.push({ $type: 'app.bsky.feed.threadgate#listRule', list });
  }
  return rules;
}

/**
 * Build the full app.bsky.feed.threadgate record for a post. The caller must
 * write it with the SAME rkey as the post (a lexicon requirement: the gate
 * record's rkey must match the gated post's rkey, in the same repository).
 */
export function buildThreadgateRecord(
  postUri: string,
  controls: IReplyControls
): Record<string, unknown> {
  return {
    $type: 'app.bsky.feed.threadgate',
    post: postUri,
    allow: buildThreadgateAllowRules(controls),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Validate reply controls BEFORE any post is published — these failures are
 * fully predictable, and surfacing them after the post exists would leave a
 * live post whose requested gate silently never applied.
 *
 * - every allowListUris entry must be the AT-URI of an app.bsky.graph.list
 *   record (a threadgate listRule referencing any other collection is invalid);
 * - the combined rule count must not exceed the lexicon's `allow` maxLength (5).
 */
export function validateReplyControls(controls: IReplyControls): void {
  for (const uri of controls.allowListUris ?? []) {
    const parts = uri.startsWith('at://') ? uri.slice('at://'.length).split('/') : [];
    const [repo, collection, rkey] = parts;
    if (parts.length < 3 || !repo || !rkey || collection !== 'app.bsky.graph.list') {
      throw new ValidationError(
        `replyControls.allowListUris entries must be AT-URIs of app.bsky.graph.list ` +
          `records (at://did/app.bsky.graph.list/rkey); got "${uri}".`,
        'replyControls.allowListUris',
        uri
      );
    }
  }
  const ruleCount = buildThreadgateAllowRules(controls).length;
  if (ruleCount > 5) {
    throw new ValidationError(
      `replyControls produce ${ruleCount} threadgate allow rules; the lexicon allows at most 5 ` +
        `(each enabled option and each list URI counts as one rule).`,
      'replyControls'
    );
  }
}

/**
 * Zod schema for the replyControls parameter, shared with create_thread (which
 * re-describes it as root-post-only).
 */
export const ReplyControlsSchema = z.object({
  allowMentioned: z
    .boolean()
    .optional()
    .describe('Allow replies from accounts @-mentioned in the post text (threadgate mentionRule).'),
  allowFollowing: z
    .boolean()
    .optional()
    .describe('Allow replies from accounts the author follows (threadgate followingRule).'),
  allowFollowers: z
    .boolean()
    .optional()
    .describe('Allow replies from accounts that follow the author (threadgate followerRule).'),
  allowListUris: z
    .array(
      z
        .string()
        .min(1, 'List URI cannot be empty')
        .describe('AT-URI of an app.bsky.graph.list record whose members may reply.')
    )
    .max(5, 'Cannot reference more than 5 lists (threadgate allows at most 5 rules)')
    .optional()
    .describe(
      'Allow replies from members of these moderation/curation lists (threadgate listRule). ' +
        'Each entry must be the AT-URI of an app.bsky.graph.list record ' +
        '(at://did/app.bsky.graph.list/rkey); anything else is rejected before the post is created.'
    ),
});

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
            image: BlobDescriptorSchema.describe(
              'Pre-uploaded image blob descriptor: pass the `image.blob` object from a prior upload_image call verbatim. The image must already be uploaded — this tool does not accept raw image data.'
            ),
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
          thumb: BlobDescriptorSchema.optional().describe(
            'Optional thumbnail for the link card as a pre-uploaded blob descriptor: pass the `preview.thumb.blob` object from generate_link_preview (or the `image.blob` from upload_image) verbatim. Omit for a card without a thumbnail.'
          ),
        })
        .describe(
          'An external link card to attach. Mutually exclusive with `images`, `video`, and `quote`.'
        )
        .optional(),
      video: z
        .object({
          video: BlobDescriptorSchema.describe(
            'Pre-uploaded PROCESSED video blob descriptor: pass the `video.blob` object from a prior upload_video call verbatim. The video must already have been uploaded and processed by the video service — this tool does not accept raw video data.'
          ),
          captions: z
            .array(
              z.object({
                lang: z
                  .string()
                  .min(2, 'Language code must be at least 2 characters')
                  .describe(
                    'BCP-47 language code for the caption track (e.g. "en", "fr", "pt-BR").'
                  ),
                file: BlobDescriptorSchema.describe(
                  'Pre-uploaded WebVTT caption blob descriptor: pass a `video.captions[].file` object from upload_video verbatim.'
                ),
              })
            )
            .max(20, 'Cannot attach more than 20 caption tracks')
            .optional()
            .describe(
              'Up to 20 caption tracks, each pairing a language code with a pre-uploaded .vtt caption blob descriptor.'
            ),
          alt: z
            .string()
            .max(1000, 'Alt text cannot exceed 1000 characters')
            .optional()
            .describe('Accessibility alt text describing the video (max 1000 characters).'),
          aspectRatio: z
            .object({
              width: z.number().int().min(1).describe('Width component of the aspect ratio.'),
              height: z.number().int().min(1).describe('Height component of the aspect ratio.'),
            })
            .optional()
            .describe(
              'Optional aspect ratio hint (e.g. {"width": 16, "height": 9}) clients use to reserve layout space before the video loads.'
            ),
        })
        .describe(
          'A video to attach (app.bsky.embed.video). Mutually exclusive with `images`, `external`, and `quote`.'
        )
        .optional(),
    })
    .describe('Optional media embed: images OR an external link card OR a video (at most one).')
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
                  'For a mention: a handle or DID (a leading @ is stripped); for a link: the URL; for a hashtag: the tag (a leading # is stripped).'
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
      'Quote another post (record embed). Mutually exclusive with the `embed.images`, `embed.external`, and `embed.video` embeds.'
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
  replyControls: ReplyControlsSchema.describe(
    'Who can reply to this post. Writes an app.bsky.feed.threadgate record (same rkey as the post) ' +
      'AFTER the post is created. Enabled options combine, up to 5 rules. Provide the object with NO ' +
      'rules enabled to let nobody reply; omit it entirely to leave replies open to everyone. ' +
      'If the gate write fails after the post succeeded, the call still succeeds with gateApplied:false ' +
      'and a warning instead of failing.'
  ).optional(),
  quoteControls: z
    .object({
      allowQuotes: z
        .boolean()
        .describe(
          'Set false to disable quoting/embedding of this post: writes an app.bsky.feed.postgate ' +
            'record (same rkey as the post) with a disableRule. true is the network default — ' +
            'quoting stays enabled and no postgate record is written.'
        ),
    })
    .describe(
      'Quote (embed) policy for this post. Only allowQuotes:false writes an app.bsky.feed.postgate ' +
        'record, AFTER the post is created. If that write fails after the post succeeded, the call ' +
        'still succeeds with gateApplied:false and a warning instead of failing.'
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
      'Create a new post on AT Protocol (Bluesky). The single rich post-creation tool: supports plain text with auto-detected mentions/links/#hashtags, explicit richtext facets, replies, image embeds, a video embed (from upload_video), an external link card, a quote (record) embed, language tags, reply controls (who can reply, via a threadgate record), and quote controls (quote policy, via a postgate record). ' +
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
        gateApplied: {
          type: 'boolean',
          description:
            'Present only when replyControls and/or quoteControls were requested. True when every ' +
            'requested gate record (threadgate/postgate) is in effect. False when the post was ' +
            'created but a gate write failed — the post is LIVE without the requested controls ' +
            '(success stays true; see `warning` for which gate failed and how to retry).',
        },
        warning: {
          type: 'string',
          description:
            'Present only when gateApplied is false: explains which gate record (threadgate ' +
            'and/or postgate) could not be written and how to retry. The post itself was created ' +
            'successfully.',
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
    gateApplied?: boolean;
    warning?: string;
  }> {
    try {
      this.logger.info('Creating new post', {
        textLength: params.text.length,
        hasReply: !!params.reply,
        hasEmbed: !!params.embed,
        hasQuote: !!params.quote,
        hasExplicitFacets: !!params.facets?.length,
        langs: params.langs,
        hasReplyControls: !!params.replyControls,
        hasQuoteControls: !!params.quoteControls,
      });

      // Validate reply controls BEFORE publishing anything: a bad list URI or
      // too many rules is fully predictable, and failing after agent.post()
      // would leave a live post whose requested gate never applied.
      if (params.replyControls) {
        validateReplyControls(params.replyControls);
      }

      // Validate reply parameters if provided, pinning their collection: a
      // reply's root/parent must be app.bsky.feed.post records — referencing
      // any other record type (a like, a follow, …) produces a structurally
      // invalid reply (mirrors reply_to_post).
      if (params.reply) {
        this.validateAtUri(params.reply.root);
        this.validateAtUri(params.reply.parent);
        this.assertPostCollection('reply.root', params.reply.root);
        this.assertPostCollection('reply.parent', params.reply.parent);
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

      // Apply reply/quote gate records AFTER the post exists. The post is
      // already live, so a gate failure must not fail the whole call — it is
      // reported as gateApplied:false + warning instead.
      const gateResult = await this.applyGates(uri, params.replyControls, params.quoteControls);

      return {
        uri,
        cid,
        success: true,
        message: 'Post created successfully',
        ...(gateResult ?? {}),
      };
    } catch (error) {
      this.logger.error('Failed to create post', error);
      this.formatError(error);
    }
  }

  /**
   * Write the requested threadgate (reply controls) and/or postgate (quote
   * controls) records for a freshly created post. Both records are keyed by
   * the POST's OWN rkey in the post's own repository — a lexicon requirement —
   * so they are written via com.atproto.repo.putRecord (create-or-replace at a
   * fixed rkey) rather than createRecord.
   *
   * The post is already live when this runs, so failures here must not throw:
   * they are converted into gateApplied:false plus a warning describing how to
   * retry. Returns undefined when no controls were requested at all (the
   * result then carries no gateApplied/warning fields).
   */
  private async applyGates(
    postUri: string,
    replyControls?: IReplyControls,
    quoteControls?: IQuoteControls
  ): Promise<{ gateApplied: boolean; warning?: string } | undefined> {
    if (!replyControls && !quoteControls) {
      return undefined;
    }

    const { repo, rkey } = this.parseAtUri(postUri);
    const warnings: string[] = [];

    if (replyControls) {
      try {
        await this.executeAtpOperation(
          async () => {
            const agent = this.atpClient.getAgent();
            return await agent.com.atproto.repo.putRecord({
              repo,
              collection: 'app.bsky.feed.threadgate',
              rkey,
              record: buildThreadgateRecord(postUri, replyControls),
            });
          },
          'applyThreadgate',
          { postUri, rkey }
        );
        this.logger.info('Threadgate (reply controls) applied', { postUri, rkey });
      } catch (error) {
        this.logger.warn('Post created but threadgate write failed', error);
        warnings.push(
          `Reply controls could not be applied (the app.bsky.feed.threadgate write failed: ` +
            `${error instanceof Error ? error.message : 'unknown error'}). The post itself was ` +
            `created and replies are currently OPEN; retry by writing a threadgate record with ` +
            `rkey "${rkey}".`
        );
      }
    }

    // allowQuotes:true is the network default (no postgate record means anyone
    // can embed, per the lexicon), so only allowQuotes:false writes a record.
    if (quoteControls && !quoteControls.allowQuotes) {
      try {
        await this.executeAtpOperation(
          async () => {
            const agent = this.atpClient.getAgent();
            return await agent.com.atproto.repo.putRecord({
              repo,
              collection: 'app.bsky.feed.postgate',
              rkey,
              record: {
                $type: 'app.bsky.feed.postgate',
                post: postUri,
                embeddingRules: [{ $type: 'app.bsky.feed.postgate#disableRule' }],
                createdAt: new Date().toISOString(),
              },
            });
          },
          'applyPostgate',
          { postUri, rkey }
        );
        this.logger.info('Postgate (quote controls) applied', { postUri, rkey });
      } catch (error) {
        this.logger.warn('Post created but postgate write failed', error);
        warnings.push(
          `Quote controls could not be applied (the app.bsky.feed.postgate write failed: ` +
            `${error instanceof Error ? error.message : 'unknown error'}). The post itself was ` +
            `created and quoting is currently ENABLED; retry by writing a postgate record with ` +
            `rkey "${rkey}".`
        );
      }
    }

    return warnings.length === 0
      ? { gateApplied: true }
      : { gateApplied: false, warning: warnings.join(' ') };
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
    const textBytes = Buffer.from(text, 'utf8');
    const textByteLength = textBytes.length;
    // A byte offset is a UTF-8 codepoint boundary iff it is the end of the text
    // or the byte it points at is not a continuation byte (10xxxxxx).
    const isCodepointBoundary = (offset: number): boolean =>
      offset === textByteLength || ((textBytes[offset] ?? 0) & 0xc0) !== 0x80;
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
      if (!isCodepointBoundary(byteStart) || !isCodepointBoundary(byteEnd)) {
        throw new ValidationError(
          `Invalid facet byte range [${byteStart}, ${byteEnd}): offsets split a ` +
            `multi-byte UTF-8 character. Facet offsets are UTF-8 byte positions ` +
            `and must fall on codepoint boundaries.`,
          'facets'
        );
      }
      const features: any[] = [];
      for (const feature of facet.features) {
        switch (feature.type) {
          case 'mention': {
            // Normalize a leading '@' (callers copy it from the rendered text);
            // '@bob.test' is not a resolvable handle.
            const value = feature.value.replace(/^@/, '');
            const did = value.startsWith('did:') ? value : await this.resolveDid(value);
            features.push({ $type: 'app.bsky.richtext.facet#mention', did });
            break;
          }
          case 'link':
            features.push({ $type: 'app.bsky.richtext.facet#link', uri: feature.value });
            break;
          case 'hashtag':
            // Normalize a leading '#': the lexicon tag is recorded WITHOUT it,
            // so '#tag' would produce a literal "#tag" tag.
            features.push({
              $type: 'app.bsky.richtext.facet#tag',
              tag: feature.value.replace(/^#/, ''),
            });
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
   * Reject a reply ref whose collection is not app.bsky.feed.post.
   * Mirrors reply_to_post's validation.
   */
  private assertPostCollection(field: 'reply.root' | 'reply.parent', uri: string): void {
    const { collection } = this.parseAtUri(uri);
    if (collection !== 'app.bsky.feed.post') {
      throw new ValidationError(
        `${field} must reference a post record (collection "${collection}" is not app.bsky.feed.post)`,
        field,
        uri
      );
    }
  }

  /**
   * Process embed data for the post.
   *
   * An AT Protocol post embed is a union: a post may carry images OR an
   * external link OR a video OR a quote (record) embed — at most one.
   * Combining any two produces a malformed record, so any combination is
   * rejected here.
   */
  private async processEmbed(
    embed: ICreatePostParams['embed'],
    quote: ICreatePostParams['quote']
  ): Promise<any | undefined> {
    const hasImages = !!(embed?.images && embed.images.length > 0);
    const hasExternal = !!embed?.external;
    const hasVideo = !!embed?.video;
    const hasQuote = !!quote;

    const selected = [hasImages, hasExternal, hasVideo, hasQuote].filter(Boolean).length;
    if (selected > 1) {
      throw new ValidationError(
        'A post can include only one embed: images, an external link, a video, or a quote (record) — not a combination. Provide only one.',
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

      // The blobs were already uploaded via upload_image — reference them in the
      // record's lexicon form instead of re-uploading (a binary Blob can never
      // arrive through JSON MCP params, only the descriptor can).
      const images = embed.images.map(img => ({
        alt: img.alt,
        image: blobDescriptorToLex(img.image),
      }));

      return {
        $type: 'app.bsky.embed.images',
        images,
      };
    }

    if (hasVideo && embed?.video) {
      const video = embed.video;
      this.logger.debug('Processing video embed', {
        captionCount: video.captions?.length ?? 0,
        hasAspectRatio: !!video.aspectRatio,
      });

      // The PROCESSED blob came back from upload_video (the app.bsky.video
      // service transcoded it and stored it on the PDS) — reference it in
      // lexicon form. Optional fields are only emitted when provided.
      return {
        $type: 'app.bsky.embed.video',
        video: blobDescriptorToLex(video.video),
        ...(video.alt ? { alt: video.alt } : {}),
        ...(video.aspectRatio ? { aspectRatio: video.aspectRatio } : {}),
        ...(video.captions && video.captions.length > 0
          ? {
              captions: video.captions.map(caption => ({
                lang: caption.lang,
                file: blobDescriptorToLex(caption.file),
              })),
            }
          : {}),
      };
    }

    if (hasExternal && embed?.external) {
      this.logger.debug('Processing external link embed', { uri: embed.external.uri });

      // Wire the optional pre-uploaded thumb descriptor
      // (generate_link_preview's preview.thumb.blob) into the lexicon record —
      // otherwise the uploaded thumbnail blob would be orphaned.
      const thumb = embed.external.thumb;

      return {
        $type: 'app.bsky.embed.external',
        external: {
          uri: embed.external.uri,
          title: embed.external.title,
          description: embed.external.description,
          ...(thumb ? { thumb: blobDescriptorToLex(thumb) } : {}),
        },
      };
    }

    return undefined;
  }
}
