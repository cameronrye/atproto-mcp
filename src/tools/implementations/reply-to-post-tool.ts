/**
 * Reply to Post Tool - Creates replies to existing posts on AT Protocol
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import type { ATURI, CID, IReplyToPostParams } from '../../types/index.js';

/**
 * Zod schema for reply to post parameters
 */
const ReplyToPostSchema = z.object({
  text: z
    .string()
    .min(1, 'Reply text cannot be empty')
    // Coarse cap; the real 300-grapheme / 3000-byte limit is enforced in buildRichText.
    .max(3000, 'Reply text is too long (limit is 300 graphemes / 3000 bytes)')
    .describe(
      'Text content of the reply (1–300 graphemes / up to 3000 bytes). Mentions (@handle), links, and hashtags are automatically resolved into rich-text facets.'
    ),
  root: z
    .string()
    .min(1, 'Root post URI is required')
    .describe(
      'AT-URI of the top-level post that started the thread (at://did/app.bsky.feed.post/rkey). Must be the original root even when replying to a nested reply.'
    ),
  parent: z
    .string()
    .min(1, 'Parent post URI is required')
    .describe(
      'AT-URI of the immediate post being replied to (at://did/app.bsky.feed.post/rkey). May equal root when replying directly to the thread starter.'
    ),
  langs: z
    .array(
      z
        .string()
        .regex(
          /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/,
          'Language codes must be valid BCP-47 tags (e.g. en, en-US, pt-BR)'
        )
        .describe('A single BCP-47 language tag for the reply text (e.g. "en", "en-US", "pt-BR").')
    )
    .optional()
    .describe(
      'List of BCP-47 language tags indicating the language(s) of the reply text. Omit if unknown.'
    ),
});

/**
 * Tool for replying to posts on AT Protocol
 *
 * AUTHENTICATION REQUIREMENT:
 * - Requires authentication (PRIVATE mode)
 * - Must have valid credentials to reply to posts
 */
export class ReplyToPostTool extends BaseTool {
  public readonly schema = {
    method: 'reply_to_post',
    description:
      'Reply to an existing post on AT Protocol, creating a threaded reply with proper parent and root CID references. Requires authentication (app password). Creates a new post record linked into the thread; the action cannot be undone (use delete_post to remove it afterwards). Use this instead of create_post whenever the new content belongs inside an existing thread; use create_thread to start a multi-post thread from scratch. Subject to per-tool rate limiting.',
    params: ReplyToPostSchema,
    outputSchema: {
      type: 'object',
      properties: {
        uri: {
          type: 'string',
          description: 'AT-URI of the newly created reply post (at://did/app.bsky.feed.post/rkey).',
        },
        cid: {
          type: 'string',
          description: 'Content identifier (CID) of the newly created reply record.',
        },
        success: {
          type: 'boolean',
          description: 'True when the reply was created successfully.',
        },
        message: {
          type: 'string',
          description: 'Human-readable status message describing the outcome.',
        },
        replyTo: {
          type: 'object',
          description: 'The root and parent URIs that this reply is linked to.',
          properties: {
            root: {
              type: 'string',
              description: 'AT-URI of the top-level post that started the thread.',
            },
            parent: {
              type: 'string',
              description: 'AT-URI of the immediate post that was replied to.',
            },
          },
          required: ['root', 'parent'],
        },
      },
      required: ['uri', 'cid', 'success', 'message', 'replyTo'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'ReplyToPost', ToolAuthMode.PRIVATE);
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
        this.getReplyCid(params.root),
        this.getReplyCid(params.parent),
      ]);

      // Detect richtext facets so mentions/links/hashtags are not inert text.
      const { text, facets } = await this.buildRichText(params.text);

      // Build the reply record
      const replyRecord = {
        $type: 'app.bsky.feed.post' as const,
        text,
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

      if (facets) {
        (replyRecord as any).facets = facets;
      }

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
   * Resolve a post's CID via the shared BaseTool.getCidFromUri, adding the
   * reply-specific guidance on failure.
   *
   * A reply must reference the parent/root post by its real CID — falling back
   * to the rkey (or a literal placeholder) produces a structurally invalid
   * reply record, so we fail clearly instead.
   */
  private async getReplyCid(uri: string): Promise<string> {
    try {
      return await this.getCidFromUri(uri);
    } catch (error) {
      throw new Error(
        `Could not resolve the CID for ${uri}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }. A reply requires the real CID of the parent and root posts.`
      );
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
