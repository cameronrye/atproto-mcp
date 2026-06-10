/**
 * Get Author Feed Tool - List posts by a specific AT Protocol user
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import type { IAtpPost } from '../../types/index.js';

/**
 * Zod schema for get author feed parameters
 */
const GetAuthorFeedSchema = z.object({
  actor: z.string().min(1).describe('Handle or DID of the account whose posts to list.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Max posts per page (1–100, default 50).'),
  cursor: z.string().optional().describe('Pagination cursor from a previous response.'),
  filter: z
    .enum([
      'posts_with_replies',
      'posts_no_replies',
      'posts_with_media',
      'posts_and_author_threads',
    ])
    .optional()
    .describe("Which of the author's posts to include (default posts_with_replies)."),
});

type GetAuthorFeedParams = z.infer<typeof GetAuthorFeedSchema>;

/**
 * Tool for listing posts by a specific AT Protocol user.
 *
 * AUTHENTICATION BEHAVIOR:
 * - Works without authentication (ToolAuthMode.ENHANCED)
 * - Authenticated requests include viewer state (liked/reposted by the caller)
 */
export class GetAuthorFeedTool extends BaseTool {
  public readonly schema = {
    method: 'get_author_feed',
    description:
      "Retrieve posts by a specific AT Protocol user. Works without authentication; richer with auth. Lists a specific user's posts. Differs from get_timeline (your home feed) and search_posts (query-based search). Subject to per-tool rate limiting.",
    params: GetAuthorFeedSchema,
    outputSchema: {
      type: 'object',
      description: "Paginated list of the author's posts.",
      properties: {
        success: { type: 'boolean', description: 'Whether the request succeeded.' },
        posts: {
          type: 'array',
          description: 'Posts by the specified author for this page.',
          items: {
            type: 'object',
            properties: {
              uri: { type: 'string', description: 'AT Protocol URI of the post.' },
              cid: { type: 'string', description: 'Content identifier (CID) of the post.' },
              author: {
                type: 'object',
                properties: {
                  did: { type: 'string', description: 'Decentralized identifier of the author.' },
                  handle: { type: 'string', description: 'AT Protocol handle of the author.' },
                  displayName: {
                    type: 'string',
                    description: "Author's display name, if set.",
                  },
                  avatar: { type: 'string', description: "URL of the author's avatar image." },
                },
                required: ['did', 'handle'],
              },
              text: { type: 'string', description: 'Text content of the post.' },
              createdAt: {
                type: 'string',
                description: 'ISO 8601 timestamp when the post was created.',
              },
              replyCount: {
                type: 'number',
                description: 'Number of replies.',
              },
              repostCount: { type: 'number', description: 'Number of reposts.' },
              likeCount: { type: 'number', description: 'Number of likes.' },
            },
            required: ['uri', 'cid', 'author', 'text', 'createdAt'],
          },
        },
        cursor: {
          type: 'string',
          description: 'Opaque cursor for the next page; absent when there are no more results.',
        },
      },
      required: ['success', 'posts'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'GetAuthorFeed', ToolAuthMode.ENHANCED);
  }

  protected async execute(params: GetAuthorFeedParams): Promise<{
    success: boolean;
    posts: IAtpPost[];
    cursor?: string;
  }> {
    try {
      this.logger.info('Retrieving author feed', {
        actor: params.actor,
        limit: params.limit,
        filter: params.filter,
        hasCursor: !!params.cursor,
      });

      this.validateActor(params.actor);

      const feedParams: {
        actor: string;
        limit: number;
        cursor?: string;
        filter?: string;
      } = {
        actor: params.actor,
        limit: params.limit ?? 50,
      };

      if (params.cursor) feedParams.cursor = params.cursor;
      if (params.filter) feedParams.filter = params.filter;

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.app.bsky.feed.getAuthorFeed(feedParams);
        },
        'getAuthorFeed',
        { actor: params.actor, filter: params.filter, limit: params.limit }
      );

      const posts: IAtpPost[] = response.data.feed.map((feedItem: any) =>
        this.transformPostView(feedItem.post)
      );

      this.logger.info('Author feed retrieved successfully', {
        actor: params.actor,
        postsCount: posts.length,
        hasCursor: !!response.data.cursor,
      });

      return {
        success: true,
        posts,
        cursor: response.data.cursor,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve author feed', error);
      this.formatError(error);
    }
  }
}
