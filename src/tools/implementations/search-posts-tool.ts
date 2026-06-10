/**
 * Search Posts Tool - Searches for posts on AT Protocol
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import { type IAtpPost, type ISearchPostsParams, ValidationError } from '../../types/index.js';

/**
 * Zod schema for search posts parameters
 */
const SearchPostsSchema = z.object({
  q: z
    .string()
    .min(1, 'Search query is required')
    .max(300, 'Search query cannot exceed 300 characters')
    .describe(
      'Full-text search query string (1–300 characters). Supports keywords and hashtags (e.g. "#bluesky launch").'
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(25)
    .describe('Maximum number of posts to return per page (1–100, default 25).'),
  cursor: z
    .string()
    .optional()
    .describe(
      'Opaque pagination cursor from the previous response cursor field; omit for the first page.'
    ),
  sort: z
    .enum(['top', 'latest'])
    .optional()
    .default('latest')
    .describe(
      'Sort order for results: "latest" returns newest posts first (default), "top" returns most-engaged posts first.'
    ),
  since: z
    .string()
    .optional()
    .describe(
      'ISO 8601 datetime lower bound (inclusive) for post creation time (e.g. "2024-01-01T00:00:00Z"). Omit to search all time.'
    ),
  until: z
    .string()
    .optional()
    .describe(
      'ISO 8601 datetime upper bound (exclusive) for post creation time (e.g. "2024-12-31T23:59:59Z"). Omit for no upper bound.'
    ),
  mentions: z
    .string()
    .optional()
    .describe(
      'Filter to posts that mention this handle or DID (e.g. "alice.bsky.social" or "did:plc:...").'
    ),
  author: z
    .string()
    .optional()
    .describe(
      'Filter to posts authored by this handle or DID (e.g. "alice.bsky.social" or "did:plc:..."). Requires a non-empty q term.'
    ),
  lang: z
    .string()
    .regex(
      /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/,
      'Language code must be a valid BCP-47 tag (e.g. en, en-US, pt-BR)'
    )
    .optional()
    .describe('BCP-47 language tag to filter posts by language (e.g. "en", "en-US", "pt-BR").'),
  domain: z
    .string()
    .optional()
    .describe(
      'Filter to posts containing links from this domain (e.g. "bsky.app"). Do not include protocol or path.'
    ),
  url: z
    .string()
    .url()
    .optional()
    .describe(
      'Filter to posts containing this exact URL (must be a fully-qualified URL, e.g. "https://example.com/article").'
    ),
});

/**
 * Tool for searching posts on AT Protocol
 *
 * AUTHENTICATION REQUIREMENT:
 * - As of 2025, the AT Protocol search API requires authentication
 * - Previously this was a public endpoint, but the API has changed
 * - This tool now requires valid credentials to function
 */
export class SearchPostsTool extends BaseTool {
  public readonly schema = {
    method: 'search_posts',
    description:
      'Search for posts on Bluesky using full-text queries with optional filters for author, language, date range, mentions, domain, and URL. Returns a paginated list of matching posts sorted by recency or engagement. Requires authentication (app password). Use search_actors to find users instead of posts. Subject to per-tool rate limiting.',
    params: SearchPostsSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the search request completed successfully.',
        },
        posts: {
          type: 'array',
          description: 'Array of posts matching the search query.',
          items: {
            type: 'object',
            properties: {
              uri: { type: 'string', description: 'AT-URI of the post (at://did/.../rkey).' },
              cid: { type: 'string', description: 'Content identifier (CID) of the post.' },
              author: {
                type: 'object',
                description: 'Profile of the post author.',
                properties: {
                  did: { type: 'string', description: 'Decentralized identifier of the author.' },
                  handle: {
                    type: 'string',
                    description: 'Handle of the author (e.g. alice.bsky.social).',
                  },
                  displayName: { type: 'string', description: 'Display name of the author.' },
                  avatar: { type: 'string', description: 'URL of the author avatar image.' },
                },
                required: ['did', 'handle'],
              },
              record: {
                type: 'object',
                description: 'The raw post record.',
                properties: {
                  text: { type: 'string', description: 'Plain text content of the post.' },
                  createdAt: { type: 'string', description: 'ISO 8601 creation timestamp.' },
                  langs: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'BCP-47 language tags declared by the author.',
                  },
                  tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Hashtags attached to the post.',
                  },
                },
                required: ['text', 'createdAt'],
              },
              replyCount: { type: 'number', description: 'Number of replies to the post.' },
              repostCount: { type: 'number', description: 'Number of reposts.' },
              likeCount: { type: 'number', description: 'Number of likes.' },
              indexedAt: {
                type: 'string',
                description: 'ISO 8601 timestamp when the post was indexed.',
              },
            },
            required: ['uri', 'cid', 'author', 'record', 'indexedAt'],
          },
        },
        cursor: {
          type: 'string',
          description:
            'Opaque pagination cursor to pass as cursor in the next call; absent when no further pages exist.',
        },
        hasMore: {
          type: 'boolean',
          description: 'True when a subsequent page of results is available.',
        },
        searchQuery: {
          type: 'string',
          description: 'The search query string that was executed.',
        },
        totalResults: {
          type: 'number',
          description:
            'Approximate total number of matching posts reported by the API, if available.',
        },
      },
      required: ['success', 'posts', 'hasMore', 'searchQuery'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'SearchPosts', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: ISearchPostsParams): Promise<{
    success: boolean;
    posts: IAtpPost[];
    cursor?: string;
    hasMore: boolean;
    searchQuery: string;
    totalResults?: number;
  }> {
    try {
      this.logger.info('Searching posts', {
        query: params.q,
        limit: params.limit,
        sort: params.sort,
        author: params.author,
        lang: params.lang,
        hasCursor: !!params.cursor,
      });

      // Build search parameters
      const searchParams: any = {
        q: params.q,
        limit: params.limit || 25,
      };

      // Add optional parameters
      if (params.cursor) searchParams.cursor = params.cursor;
      if (params.sort) searchParams.sort = params.sort;

      // Validate and add date parameters (ISO 8601 format)
      if (params.since) {
        this.validateISO8601Date(params.since, 'since');
        searchParams.since = params.since;
      }
      if (params.until) {
        this.validateISO8601Date(params.until, 'until');
        searchParams.until = params.until;
      }

      if (params.mentions) searchParams.mentions = params.mentions;
      if (params.author) {
        this.validateActor(params.author);
        searchParams.author = params.author;
      }
      if (params.lang) searchParams.lang = params.lang;
      if (params.domain) searchParams.domain = params.domain;
      if (params.url) searchParams.url = params.url;

      // Execute search using AT Protocol (requires authentication as of 2025)
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.app.bsky.feed.searchPosts(searchParams);
        },
        'searchPosts',
        {
          query: params.q,
          limit: params.limit,
          sort: params.sort,
        }
      );

      // Transform posts to our interface (shared mapper lives on BaseTool)
      const posts: IAtpPost[] = response.data.posts.map((post: any) =>
        this.transformPostView(post)
      );

      const hasMore = !!response.data.cursor;
      const cursor = response.data.cursor;

      this.logger.info('Posts search completed', {
        query: params.q,
        foundPosts: posts.length,
        hasMore,
        hasCursor: !!cursor,
      });

      return {
        success: true,
        posts,
        cursor,
        hasMore,
        searchQuery: params.q,
        totalResults: response.data.hitsTotal,
      };
    } catch (error) {
      this.logger.error('Failed to search posts', error);
      this.formatError(error);
    }
  }

  /**
   * Search posts by hashtag
   */
  public async searchByHashtag(
    hashtag: string,
    options?: {
      limit?: number;
      cursor?: string;
      sort?: 'top' | 'latest';
    }
  ): Promise<{
    success: boolean;
    posts: IAtpPost[];
    cursor?: string;
    hasMore: boolean;
    hashtag: string;
  }> {
    try {
      // Ensure hashtag starts with #
      const formattedHashtag = hashtag.startsWith('#') ? hashtag : `#${hashtag}`;

      const result = await this.execute({
        q: formattedHashtag,
        limit: options?.limit || 25,
        cursor: options?.cursor,
        sort: options?.sort || 'latest',
      });

      return {
        success: result.success,
        posts: result.posts,
        cursor: result.cursor,
        hasMore: result.hasMore,
        hashtag: formattedHashtag,
      };
    } catch (error) {
      this.logger.error('Failed to search posts by hashtag', error);
      throw error;
    }
  }

  /**
   * Search posts by author
   */
  public async searchByAuthor(
    author: string,
    query?: string,
    options?: {
      limit?: number;
      cursor?: string;
      sort?: 'top' | 'latest';
    }
  ): Promise<{
    success: boolean;
    posts: IAtpPost[];
    cursor?: string;
    hasMore: boolean;
    author: string;
  }> {
    try {
      this.validateActor(author);

      // AT Protocol search requires a non-empty query term and has no match-all
      // wildcard ('*' would be searched literally and match nothing). To list an
      // author's posts without a search term, use get_timeline / an author feed.
      if (!query || query.trim() === '') {
        throw new ValidationError(
          "searchByAuthor requires a non-empty query term (AT Protocol search has no match-all wildcard). To list all of an author's posts, use an author-feed tool instead.",
          'query',
          query
        );
      }

      const result = await this.execute({
        q: query,
        author,
        limit: options?.limit || 25,
        cursor: options?.cursor,
        sort: options?.sort || 'latest',
      });

      return {
        success: result.success,
        posts: result.posts,
        cursor: result.cursor,
        hasMore: result.hasMore,
        author,
      };
    } catch (error) {
      this.logger.error('Failed to search posts by author', error);
      throw error;
    }
  }
}
