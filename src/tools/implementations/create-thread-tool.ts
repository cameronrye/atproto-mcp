/**
 * Create Thread Tool - Creates multi-post threads in a single operation
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import { type ATURI, type CID, ValidationError } from '../../types/index.js';

/**
 * Zod schema for create thread parameters
 */
const CreateThreadSchema = z.object({
  posts: z
    .array(
      z.object({
        text: z
          .string()
          .min(1, 'Post text cannot be empty')
          // Coarse cap; the real 300-grapheme / 3000-byte limit is enforced in buildRichText.
          .max(3000, 'Post text is too long (limit is 300 graphemes / 3000 bytes)')
          .describe(
            'Text content of this post (1–300 graphemes / 3000 bytes). Mentions (@handle), URLs, and hashtags are auto-linked via richtext facets.'
          ),
        langs: z
          .array(
            z
              .string()
              .regex(
                /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/,
                'Language codes must be valid BCP-47 tags (e.g. en, en-US, pt-BR)'
              )
              .describe(
                'BCP-47 language tag for this post (e.g. "en", "en-US", "pt-BR"). Overrides the thread-level langs for this post only.'
              )
          )
          .optional()
          .describe(
            'Per-post language tags (BCP-47). When set, overrides the thread-level langs field for this individual post.'
          ),
      })
    )
    .min(2, 'Thread must contain at least 2 posts')
    .max(25, 'Thread cannot exceed 25 posts')
    .describe(
      'Ordered array of posts to publish as a thread (2–25 items). Each post is automatically chained as a reply to the previous one.'
    ),
  langs: z
    .array(
      z
        .string()
        .regex(
          /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/,
          'Language codes must be valid BCP-47 tags (e.g. en, en-US, pt-BR)'
        )
        .describe('BCP-47 language tag (e.g. "en", "en-US", "pt-BR").')
    )
    .optional()
    .describe(
      'Default language tags (BCP-47) applied to every post in the thread. Individual posts can override this with their own langs field.'
    ),
});

/**
 * Tool for creating multi-post threads on AT Protocol
 *
 * This tool creates a thread of posts in a single operation, automatically
 * handling the reply chain structure. Each post in the thread replies to
 * the previous one, with all posts maintaining a reference to the root post.
 *
 * AUTHENTICATION REQUIREMENT:
 * - Requires authentication (PRIVATE mode)
 * - Must have valid credentials to create posts
 */
export class CreateThreadTool extends BaseTool {
  public readonly schema = {
    method: 'create_thread',
    description:
      'Create a thread of 2–25 posts in a single operation, automatically chaining each post as a reply to the previous one so readers see them as a continuous conversation. Use this instead of repeated create_post calls when content spans multiple posts; use create_post for a single standalone post or reply_to_post to append to an existing thread. Requires authentication (app password). If publishing fails mid-thread, already-published posts are returned with a failedAtPosition indicator so you can delete or resume them. Subject to per-tool rate limiting.',
    params: CreateThreadSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description:
            'True when all posts were published; false when only some posts were created before a failure.',
        },
        message: {
          type: 'string',
          description:
            'Human-readable summary of the outcome, including partial-failure details when applicable.',
        },
        thread: {
          type: 'array',
          description: 'Ordered list of every post that was successfully published.',
          items: {
            type: 'object',
            properties: {
              uri: {
                type: 'string',
                description: 'AT-URI of the published post (at://did/app.bsky.feed.post/rkey).',
              },
              cid: {
                type: 'string',
                description: 'Content identifier (CID) of the published post record.',
              },
              text: {
                type: 'string',
                description: 'Original text content of this post.',
              },
              position: {
                type: 'number',
                description: '1-based index of this post within the thread.',
              },
              isRoot: {
                type: 'boolean',
                description: 'True only for the first post (the thread root).',
              },
            },
            required: ['uri', 'cid', 'text', 'position', 'isRoot'],
          },
        },
        rootPost: {
          type: 'object',
          description: 'URI and CID of the root (first) post, which anchors the entire thread.',
          properties: {
            uri: {
              type: 'string',
              description: 'AT-URI of the root post.',
            },
            cid: {
              type: 'string',
              description: 'CID of the root post record.',
            },
          },
          required: ['uri', 'cid'],
        },
        totalPosts: {
          type: 'number',
          description:
            'Number of posts actually published (may be less than requested if an error occurred mid-thread).',
        },
        failedAtPosition: {
          type: 'number',
          description:
            '1-based position of the post that failed; present only when success is false.',
        },
      },
      required: ['success', 'message', 'thread', 'rootPost', 'totalPosts'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'CreateThread', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: {
    posts: Array<{ text: string; langs?: string[] }>;
    langs?: string[];
  }): Promise<{
    success: boolean;
    message: string;
    thread: Array<{
      uri: ATURI;
      cid: CID;
      text: string;
      position: number;
      isRoot: boolean;
    }>;
    rootPost: {
      uri: ATURI;
      cid: CID;
    };
    totalPosts: number;
    failedAtPosition?: number;
  }> {
    const createdPosts: Array<{
      uri: ATURI;
      cid: CID;
      text: string;
      position: number;
      isRoot: boolean;
    }> = [];

    let rootUri: ATURI | null = null;
    let rootCid: CID | null = null;

    try {
      this.logger.info('Creating thread', {
        postCount: params.posts.length,
        totalCharacters: params.posts.reduce((sum, p) => sum + p.text.length, 0),
      });

      // Validate EVERY post's text limits upfront, before creating any record.
      // A 300-grapheme/3000-byte violation is fully predictable, so letting post
      // N fail inside the loop would orphan posts 1..N-1 on the network for no
      // reason. (Unpredictable mid-loop failures, e.g. network errors, still use
      // the partial-failure recovery path below.)
      params.posts.forEach((post, i) => {
        try {
          this.assertPostTextWithinLimits(post.text);
        } catch (error) {
          if (error instanceof ValidationError) {
            throw new ValidationError(
              `Post ${i + 1} of ${params.posts.length}: ${error.message}`,
              'posts',
              undefined,
              { position: i + 1 }
            );
          }
          throw error;
        }
      });

      let previousUri: ATURI | null = null;
      let previousCid: CID | null = null;

      // Create each post in sequence
      for (let i = 0; i < params.posts.length; i++) {
        const post = params.posts[i];
        if (!post) {
          throw new Error(`Post at index ${i} is undefined`);
        }

        const isRoot = i === 0;

        // Determine language tags (post-specific or thread-wide)
        const langs = post.langs || params.langs;

        // Detect richtext facets so mentions/links/hashtags are not inert text.
        const { text, facets } = await this.buildRichText(post.text);

        // Build the post record
        const postRecord: any = {
          $type: 'app.bsky.feed.post',
          text,
          createdAt: new Date().toISOString(),
        };

        if (facets) {
          postRecord.facets = facets;
        }

        // Add language tags if provided
        if (langs && langs.length > 0) {
          postRecord.langs = langs;
        }

        // Add reply structure for non-root posts
        if (!isRoot && rootUri && rootCid && previousUri && previousCid) {
          postRecord.reply = {
            root: {
              uri: rootUri,
              cid: rootCid,
            },
            parent: {
              uri: previousUri,
              cid: previousCid,
            },
          };
        }

        // Create the post
        const response = await this.executeAtpOperation(
          async () => {
            const agent = this.atpClient.getAgent();
            return await agent.post(postRecord);
          },
          'createThreadPost',
          {
            position: i + 1,
            totalPosts: params.posts.length,
            textLength: post.text.length,
            isRoot,
          }
        );

        const createdUri = response.uri as ATURI;
        const createdCid = response.cid as CID;

        // Store root post reference
        if (isRoot) {
          rootUri = createdUri;
          rootCid = createdCid;
        }

        // Update previous post reference for next iteration
        previousUri = createdUri;
        previousCid = createdCid;

        createdPosts.push({
          uri: createdUri,
          cid: createdCid,
          text: post.text,
          position: i + 1,
          isRoot,
        });

        this.logger.debug('Thread post created', {
          position: i + 1,
          uri: createdUri,
          isRoot,
        });
      }

      this.logger.info('Thread created successfully', {
        totalPosts: createdPosts.length,
        rootUri,
        rootCid,
      });

      return {
        success: true,
        message: `Thread created successfully with ${createdPosts.length} posts`,
        thread: createdPosts,
        rootPost: {
          uri: rootUri!,
          cid: rootCid!,
        },
        totalPosts: createdPosts.length,
      };
    } catch (error) {
      // If some posts were already published, they are LIVE on the network. Return
      // them (with the failing position) so the caller can delete or resume rather
      // than retrying and creating a second partial thread. Only a clean failure
      // (nothing created yet) propagates as an error.
      if (createdPosts.length > 0 && rootUri && rootCid) {
        this.logger.error('Thread partially created; returning created posts for recovery', error, {
          createdCount: createdPosts.length,
          createdUris: createdPosts.map(p => p.uri),
        });
        return {
          success: false,
          message:
            `Thread partially created: ${createdPosts.length} of ${params.posts.length} ` +
            `posts were published before an error occurred. Use the returned thread URIs ` +
            `to delete the partial thread or resume from the failed position.`,
          thread: createdPosts,
          rootPost: { uri: rootUri, cid: rootCid },
          totalPosts: createdPosts.length,
          failedAtPosition: createdPosts.length + 1,
        };
      }
      this.logger.error('Failed to create thread', error);
      this.formatError(error);
    }
  }
}
