/**
 * Search Posts Tool - Searches for posts on AT Protocol
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import type { IAtpPost, ISearchPostsParams } from '../../types/index.js';

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
  lang: z.string().length(2, 'Language code must be 2 characters').optional(),
  domain: z.string().optional(),
  url: z.string().url().optional(),
});

/**
 * Tool for searching posts on AT Protocol
 */
export class SearchPostsTool extends BaseTool {
  public readonly schema = {
    method: 'search_posts',
    description:
      'Search for posts on AT Protocol. Supports text search with various filters including author, language, date range, and more. No authentication required.',
    params: SearchPostsSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'SearchPosts', ToolAuthMode.PUBLIC);
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

      // Execute search using AT Protocol (public endpoint)
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getPublicAgent();
          return await agent.app.bsky.feed.searchPosts(searchParams);
        },
        'searchPosts',
        {
          query: params.q,
          limit: params.limit,
          sort: params.sort,
        }
      );

      // Transform posts to our interface
      const posts: IAtpPost[] = response.data.posts.map((post: any) => this.transformPost(post));

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
   * Transform AT Protocol post data to our interface
   */
  private transformPost(postData: any): IAtpPost {
    return {
      uri: postData.uri,
      cid: postData.cid,
      author: {
        did: postData.author.did,
        handle: postData.author.handle,
        displayName: postData.author.displayName,
        description: postData.author.description,
        avatar: postData.author.avatar,
        followersCount: postData.author.followersCount,
        followsCount: postData.author.followsCount,
        postsCount: postData.author.postsCount,
      },
      record: {
        text: postData.record.text || '',
        createdAt: postData.record.createdAt,
        reply: postData.record.reply
          ? {
              root: {
                uri: postData.record.reply.root.uri,
                cid: postData.record.reply.root.cid,
              },
              parent: {
                uri: postData.record.reply.parent.uri,
                cid: postData.record.reply.parent.cid,
              },
            }
          : undefined,
        embed: postData.record.embed,
        langs: postData.record.langs,
        labels: postData.record.labels,
        tags: postData.record.tags,
      },
      replyCount: postData.replyCount,
      repostCount: postData.repostCount,
      likeCount: postData.likeCount,
      indexedAt: postData.indexedAt,
      viewer: postData.viewer
        ? {
            repost: postData.viewer.repost,
            like: postData.viewer.like,
          }
        : undefined,
    };
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

      const result = await this.execute({
        q: query || '*', // Use wildcard if no specific query
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
