/**
 * Timeline and Feed Tools - Retrieve timelines and feeds from AT Protocol
 */

import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import type { IAtpPost, IGetTimelineParams } from '../../types/index.js';

/**
 * Zod schema for get timeline parameters
 */
const GetTimelineSchema = z.object({
  algorithm: z
    .string()
    .optional()
    .describe(
      'Feed algorithm or generator AT-URI to use (e.g. "reverse-chronological" or at://did/.../app.bsky.feed.generator/rkey). Omit for the default home timeline algorithm.'
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .describe('Maximum number of posts to return (1–100, default 50).'),
  cursor: z
    .string()
    .optional()
    .describe(
      'Opaque pagination cursor from the previous response cursor field; omit for the first page.'
    ),
});

/**
 * Tool for retrieving user timelines from AT Protocol
 */
export class GetTimelineTool extends BaseTool {
  public readonly schema = {
    method: 'get_timeline',
    description:
      "Retrieve the user's home timeline from AT Protocol, returning posts from followed accounts and algorithmically recommended content. Requires authentication (app password). Use get_author_feed to retrieve posts from a specific user instead of the authenticated user's own feed. Subject to per-tool rate limiting.",
    params: GetTimelineSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the timeline was retrieved successfully.',
        },
        posts: {
          type: 'array',
          description: 'List of posts in the timeline.',
          items: {
            type: 'object',
            properties: {
              uri: { type: 'string', description: 'AT-URI of the post.' },
              cid: { type: 'string', description: 'Content identifier (CID) of the post.' },
              author: {
                type: 'object',
                description: 'Author of the post.',
                properties: {
                  did: { type: 'string', description: "Author's DID." },
                  handle: { type: 'string', description: "Author's handle." },
                  displayName: { type: 'string', description: "Author's display name." },
                  avatar: { type: 'string', description: "URL of the author's avatar image." },
                },
              },
              record: {
                type: 'object',
                description: 'Post record content.',
                properties: {
                  text: { type: 'string', description: 'Text content of the post.' },
                  createdAt: {
                    type: 'string',
                    description: 'ISO 8601 timestamp when the post was created.',
                  },
                },
              },
              replyCount: { type: 'number', description: 'Number of replies to the post.' },
              repostCount: { type: 'number', description: 'Number of reposts.' },
              likeCount: { type: 'number', description: 'Number of likes.' },
              indexedAt: {
                type: 'string',
                description: 'ISO 8601 timestamp when the post was indexed.',
              },
            },
          },
        },
        cursor: {
          type: 'string',
          description:
            'Opaque pagination cursor to pass in a subsequent request to retrieve the next page; absent when there are no more results.',
        },
        hasMore: {
          type: 'boolean',
          description: 'Whether additional pages of results are available.',
        },
        algorithm: {
          type: 'string',
          description: 'The algorithm or feed generator AT-URI used for this request, if provided.',
        },
      },
      required: ['success', 'posts', 'hasMore'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'GetTimeline');
  }

  protected async execute(params: IGetTimelineParams): Promise<{
    success: boolean;
    posts: IAtpPost[];
    cursor?: string;
    hasMore: boolean;
    algorithm?: string;
  }> {
    try {
      this.logger.info('Retrieving timeline', {
        algorithm: params.algorithm,
        limit: params.limit,
        hasCursor: !!params.cursor,
      });

      // Build timeline parameters
      const timelineParams: any = {
        limit: params.limit || 50,
      };

      if (params.cursor) timelineParams.cursor = params.cursor;
      if (params.algorithm) timelineParams.algorithm = params.algorithm;

      // Get timeline using AT Protocol
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getTimeline(timelineParams);
        },
        'getTimeline',
        {
          algorithm: params.algorithm,
          limit: params.limit,
        }
      );

      // Transform posts to our interface
      const posts: IAtpPost[] = response.data.feed.map((feedItem: any) =>
        this.transformPostView(feedItem.post)
      );

      const hasMore = !!response.data.cursor;
      const cursor = response.data.cursor;

      this.logger.info('Timeline retrieved successfully', {
        postsCount: posts.length,
        hasMore,
        algorithm: params.algorithm,
      });

      return {
        success: true,
        posts,
        cursor,
        hasMore,
        algorithm: params.algorithm,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve timeline', error);
      this.formatError(error);
    }
  }
}
