/**
 * Create Thread Tool - Creates multi-post threads in a single operation
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import type { ATURI, CID } from '../../types/index.js';

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
          .max(300, 'Post text cannot exceed 300 characters'),
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
      })
    )
    .min(2, 'Thread must contain at least 2 posts')
    .max(25, 'Thread cannot exceed 25 posts'),
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
      'Create a multi-post thread on AT Protocol. Posts are automatically chained together with proper reply structure. Useful for longer-form content that exceeds the 300-character limit. Requires authentication.',
    params: CreateThreadSchema,
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
