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
    .max(300, 'Search query cannot exceed 300 characters'),
  limit: z.number().int().min(1).max(100).optional().default(25),
  cursor: z.string().optional(),
  sort: z.enum(['top', 'latest']).optional().default('latest'),
  since: z.string().optional(),
  until: z.string().optional(),
  mentions: z.string().optional(),
  author: z.string().optional(),
  lang: z
    .string()
    .regex(
      /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/,
      'Language code must be a valid BCP-47 tag (e.g. en, en-US, pt-BR)'
    )
    .optional(),
  domain: z.string().optional(),
  url: z.string().url().optional(),
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
      'Search for posts on AT Protocol. Supports text search with various filters including author, language, date range, and more. Requires authentication (AT Protocol API changed in 2025 to require auth for search).',
    params: SearchPostsSchema,
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
