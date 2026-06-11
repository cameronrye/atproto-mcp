/**
 * Bookmark Tools - Manage private bookmarks on AT Protocol
 *
 * Bookmarks (app.bsky.bookmark.*) are PRIVATE to the authenticated account:
 * they are stored server-side by the AppView ("stash"), not as public repo
 * records, so other users can never see them and no bookmark-record AT-URI/CID
 * exists — bookmarks are keyed by the bookmarked post's URI. The AppView treats
 * a duplicate createBookmark and a deleteBookmark for a missing bookmark as
 * no-ops, and only app.bsky.feed.post records can be bookmarked
 * (UnsupportedCollection otherwise).
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import { type ATURI, type CID, type IAtpPost, ValidationError } from '../../types/index.js';

const POST_COLLECTION = 'app.bsky.feed.post';

/**
 * Bookmarks only support post records; fail fast locally (mirroring
 * unlike_post's collection pinning) instead of round-tripping to the server
 * for a guaranteed UnsupportedCollection error.
 */
function assertPostCollection(collection: string, uri: string): void {
  if (collection !== POST_COLLECTION) {
    throw new ValidationError(
      `uri must reference a post record (collection "${collection}" is not ${POST_COLLECTION}); only posts can be bookmarked`,
      'uri',
      uri
    );
  }
}

/**
 * Zod schema for add bookmark parameters
 */
const AddBookmarkSchema = z.object({
  uri: z
    .string()
    .min(1, 'Post URI is required')
    .describe(
      'AT-URI of the post to bookmark (at://did/app.bsky.feed.post/rkey). Only posts can be bookmarked.'
    ),
  cid: z
    .string()
    .min(1, 'Post CID cannot be empty')
    .optional()
    .describe(
      'CID of the post record. Optional: resolved automatically from the post view when omitted.'
    ),
});

/**
 * Tool for privately bookmarking posts on AT Protocol
 *
 * AUTHENTICATION REQUIREMENT:
 * - Requires authentication (PRIVATE mode): bookmarks belong to the
 *   authenticated account and the endpoint rejects anonymous calls.
 */
export class AddBookmarkTool extends BaseTool {
  public readonly schema = {
    method: 'add_bookmark',
    description:
      'Privately bookmark a post on AT Protocol (app.bsky.bookmark.createBookmark). Bookmarks are private to your account and stored server-side — they are not public records, other users cannot see them, and no bookmark-record URI exists (bookmarks are keyed by the post URI). Only posts can be bookmarked; bookmarking an already-bookmarked post is a no-op. Requires authentication (app password). Use remove_bookmark to remove and get_bookmarks to list. Subject to per-tool rate limiting.',
    params: AddBookmarkSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the bookmark operation succeeded.' },
        message: { type: 'string', description: 'Human-readable status message.' },
        alreadyBookmarked: {
          type: 'boolean',
          description:
            'True when the post was already bookmarked; no create call is issued (the endpoint is also idempotent server-side, so a duplicate create would be a no-op anyway).',
        },
        bookmarkedPost: {
          type: 'object',
          description:
            'The post that was bookmarked. There is no bookmark-record URI: bookmarks are private server-side state keyed by this post URI.',
          properties: {
            uri: { type: 'string', description: 'AT-URI of the bookmarked post.' },
            cid: {
              type: 'string',
              description:
                'CID of the bookmarked post (resolved from the post view when not supplied).',
            },
          },
          required: ['uri', 'cid'],
        },
      },
      required: ['success', 'message', 'alreadyBookmarked', 'bookmarkedPost'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'AddBookmark', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: { uri: string; cid?: string }): Promise<{
    success: boolean;
    message: string;
    alreadyBookmarked: boolean;
    bookmarkedPost: {
      uri: ATURI;
      cid: CID;
    };
  }> {
    try {
      this.logger.info('Adding bookmark', { postUri: params.uri });

      this.validateAtUri(params.uri);
      const { collection } = this.parseAtUri(params.uri);
      assertPostCollection(collection, params.uri);
      if (params.cid) {
        this.validateCid(params.cid);
      }

      // One getPosts round-trip yields both the authoritative viewer.bookmarked
      // state (mirroring like_post's viewer.like pre-check) and the post CID.
      const state = await this.fetchBookmarkState(params.uri);

      if (state?.bookmarked) {
        this.logger.info('Post is already bookmarked', { postUri: params.uri });
        return {
          success: true,
          message: 'Post was already bookmarked',
          alreadyBookmarked: true,
          bookmarkedPost: {
            uri: params.uri as ATURI,
            cid: (params.cid ?? state.cid) as CID,
          },
        };
      }

      const cid = params.cid ?? state?.cid;
      if (!cid) {
        throw new ValidationError(
          `Could not resolve the CID for ${params.uri}: the post view could not be fetched. Verify the post exists, or pass cid explicitly.`,
          'cid'
        );
      }

      await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.app.bsky.bookmark.createBookmark({ uri: params.uri, cid });
        },
        'createBookmark',
        { postUri: params.uri, postCid: cid }
      );

      this.logger.info('Post bookmarked successfully', { postUri: params.uri, postCid: cid });

      return {
        success: true,
        message: 'Post bookmarked successfully',
        alreadyBookmarked: false,
        bookmarkedPost: {
          uri: params.uri as ATURI,
          cid: cid as CID,
        },
      };
    } catch (error) {
      this.logger.error('Failed to add bookmark', error);
      this.formatError(error);
    }
  }

  /**
   * Fetch the post view to learn its CID and whether the authenticated user has
   * already bookmarked it (viewer.bookmarked). Returns null when the check
   * cannot be performed — the caller then proceeds with an explicit cid if one
   * was supplied (graceful degradation, mirroring like_post's checkExistingLike).
   */
  private async fetchBookmarkState(
    postUri: string
  ): Promise<{ cid?: string; bookmarked: boolean } | null> {
    try {
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getPosts({ uris: [postUri] });
        },
        'getPostViewerState',
        { postUri }
      );
      const post = response.data.posts[0];
      return post ? { cid: post.cid, bookmarked: post.viewer?.bookmarked === true } : null;
    } catch (error) {
      this.logger.warn('Could not check existing bookmark state', error);
      return null;
    }
  }
}

/**
 * Zod schema for remove bookmark parameters
 */
const RemoveBookmarkSchema = z.object({
  uri: z
    .string()
    .min(1, 'Post URI is required')
    .describe(
      'AT-URI of the bookmarked post (at://did/app.bsky.feed.post/rkey). Bookmarks are keyed by the post URI — pass the post URI itself, not a bookmark-record URI (none exists).'
    ),
});

/**
 * Tool for removing private bookmarks on AT Protocol
 *
 * AUTHENTICATION REQUIREMENT:
 * - Requires authentication (PRIVATE mode)
 */
export class RemoveBookmarkTool extends BaseTool {
  public readonly schema = {
    method: 'remove_bookmark',
    description:
      'Remove a private bookmark from a post on AT Protocol (app.bsky.bookmark.deleteBookmark). Takes the bookmarked post AT-URI — bookmarks are keyed by post URI, there is no separate bookmark-record URI. Removing a bookmark that does not exist succeeds as a no-op. Requires authentication (app password). Use add_bookmark to add and get_bookmarks to list. Subject to per-tool rate limiting.',
    params: RemoveBookmarkSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the remove operation succeeded.' },
        message: { type: 'string', description: 'Human-readable status message.' },
        wasBookmarked: {
          type: 'boolean',
          description:
            'True when the post was confirmed bookmarked before removal. False when it was not bookmarked, or when the prior state could not be confirmed — in that case the delete is still issued and the server treats deleting a missing bookmark as a no-op.',
        },
        removedBookmark: {
          type: 'object',
          description: 'The post whose bookmark was removed (or confirmed absent).',
          properties: {
            uri: { type: 'string', description: 'AT-URI of the post.' },
          },
          required: ['uri'],
        },
      },
      required: ['success', 'message', 'wasBookmarked', 'removedBookmark'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'RemoveBookmark', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: { uri: string }): Promise<{
    success: boolean;
    message: string;
    wasBookmarked: boolean;
    removedBookmark: {
      uri: ATURI;
    };
  }> {
    try {
      this.logger.info('Removing bookmark', { postUri: params.uri });

      this.validateAtUri(params.uri);
      const { collection } = this.parseAtUri(params.uri);
      assertPostCollection(collection, params.uri);

      const state = await this.fetchBookmarkState(params.uri);

      if (state && !state.bookmarked) {
        // Definitively not bookmarked: skip the delete call entirely.
        this.logger.info('Post was not bookmarked; nothing to remove', { postUri: params.uri });
        return {
          success: true,
          message: 'Post was not bookmarked; nothing to remove',
          wasBookmarked: false,
          removedBookmark: { uri: params.uri as ATURI },
        };
      }

      // Bookmarked, or prior state unknown (pre-check failed). Issue the delete
      // either way: the AppView treats deleting a missing bookmark as a no-op,
      // so this is safe, and skipping on a flaky pre-check would silently drop
      // the user's request.
      await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.app.bsky.bookmark.deleteBookmark({ uri: params.uri });
        },
        'deleteBookmark',
        { postUri: params.uri }
      );

      const confirmed = state?.bookmarked === true;
      this.logger.info('Bookmark removed', { postUri: params.uri, confirmed });

      return {
        success: true,
        message: confirmed
          ? 'Bookmark removed successfully'
          : 'Bookmark removal submitted; the prior bookmark state could not be confirmed (the server treats removing a missing bookmark as a no-op)',
        wasBookmarked: confirmed,
        removedBookmark: { uri: params.uri as ATURI },
      };
    } catch (error) {
      this.logger.error('Failed to remove bookmark', error);
      this.formatError(error);
    }
  }

  /**
   * Fetch the authoritative viewer.bookmarked state for the post. Returns null
   * when the check cannot be performed; the caller then still issues the
   * delete (the endpoint is a no-op for missing bookmarks).
   */
  private async fetchBookmarkState(postUri: string): Promise<{ bookmarked: boolean } | null> {
    try {
      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getPosts({ uris: [postUri] });
        },
        'getPostViewerState',
        { postUri }
      );
      const post = response.data.posts[0];
      return post ? { bookmarked: post.viewer?.bookmarked === true } : null;
    } catch (error) {
      this.logger.warn('Could not check existing bookmark state', error);
      return null;
    }
  }
}

/**
 * Zod schema for get bookmarks parameters
 */
const GetBookmarksSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Max bookmarks per page (1–100, default 50).'),
  cursor: z
    .string()
    .optional()
    .describe(
      'Opaque pagination cursor from the previous response cursor field; omit for the first page.'
    ),
});

/**
 * A single bookmark entry in the get_bookmarks result. `post` is present only
 * when the bookmarked post is still viewable; otherwise `unavailableReason`
 * says why (the bookmark itself still exists either way).
 */
interface IBookmarkEntry {
  uri: ATURI;
  cid: CID;
  bookmarkedAt?: string;
  post?: IAtpPost;
  unavailableReason?: 'blocked' | 'not_found' | 'unknown';
}

/**
 * Tool for listing the authenticated account's private bookmarks
 *
 * AUTHENTICATION REQUIREMENT:
 * - Requires authentication (PRIVATE mode): bookmarks are private per-account
 *   state, so there is nothing to fetch anonymously.
 */
export class GetBookmarksTool extends BaseTool {
  public readonly schema = {
    method: 'get_bookmarks',
    description:
      "List the authenticated account's private bookmarks (app.bsky.bookmark.getBookmarks) with cursor pagination. Each entry carries the full bookmarked post view when the post is still viewable, or an unavailableReason (blocked / not_found) when it is not. Requires authentication (app password). Use add_bookmark / remove_bookmark to manage bookmarks. Subject to per-tool rate limiting.",
    params: GetBookmarksSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the request succeeded.' },
        bookmarks: {
          type: 'array',
          description: 'The bookmarks for this page.',
          items: {
            type: 'object',
            properties: {
              uri: { type: 'string', description: 'AT-URI of the bookmarked post.' },
              cid: { type: 'string', description: 'CID of the bookmarked post.' },
              bookmarkedAt: {
                type: 'string',
                description:
                  'ISO 8601 timestamp when the bookmark was created. Absent when the server does not report it.',
              },
              post: {
                type: 'object',
                description:
                  'Full view of the bookmarked post. Present only when the post is still viewable; absent when unavailableReason is set.',
                properties: {
                  uri: { type: 'string', description: 'AT-URI of the post.' },
                  cid: { type: 'string', description: 'CID of the post.' },
                  author: {
                    type: 'object',
                    description: 'Author of the post.',
                    properties: {
                      did: { type: 'string', description: "Author's DID." },
                      handle: { type: 'string', description: "Author's handle." },
                      displayName: { type: 'string', description: "Author's display name." },
                      avatar: { type: 'string', description: "URL of the author's avatar image." },
                    },
                    required: ['did', 'handle'],
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
              unavailableReason: {
                type: 'string',
                enum: ['blocked', 'not_found', 'unknown'],
                description:
                  'Why the post view is missing: "blocked" (blocked content), "not_found" (post deleted), or "unknown" (unrecognized item type). Absent when post is present.',
              },
            },
            required: ['uri', 'cid'],
          },
        },
        cursor: {
          type: 'string',
          description: 'Opaque cursor for the next page; absent when there are no more results.',
        },
        hasMore: {
          type: 'boolean',
          description: 'Whether additional pages of results are available.',
        },
      },
      required: ['success', 'bookmarks', 'hasMore'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'GetBookmarks', ToolAuthMode.PRIVATE);
  }

  protected async execute(params: { limit?: number; cursor?: string }): Promise<{
    success: boolean;
    bookmarks: IBookmarkEntry[];
    cursor?: string;
    hasMore: boolean;
  }> {
    try {
      this.logger.info('Retrieving bookmarks', {
        limit: params.limit,
        hasCursor: !!params.cursor,
      });

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.app.bsky.bookmark.getBookmarks({
            limit: params.limit ?? 50,
            cursor: params.cursor,
          });
        },
        'getBookmarks',
        { limit: params.limit }
      );

      const bookmarks: IBookmarkEntry[] = response.data.bookmarks.map((bookmark: any) => {
        const entry: IBookmarkEntry = {
          uri: bookmark.subject.uri as ATURI,
          cid: bookmark.subject.cid as CID,
          bookmarkedAt: bookmark.createdAt,
        };

        const itemType = typeof bookmark.item?.$type === 'string' ? bookmark.item.$type : '';
        if (itemType === 'app.bsky.feed.defs#postView') {
          entry.post = this.transformPostView(bookmark.item);
        } else if (itemType === 'app.bsky.feed.defs#blockedPost') {
          entry.unavailableReason = 'blocked';
        } else if (itemType === 'app.bsky.feed.defs#notFoundPost') {
          entry.unavailableReason = 'not_found';
        } else {
          entry.unavailableReason = 'unknown';
        }

        return entry;
      });

      const cursor = response.data.cursor;
      const hasMore = !!cursor;

      this.logger.info('Bookmarks retrieved successfully', {
        count: bookmarks.length,
        hasMore,
      });

      return {
        success: true,
        bookmarks,
        cursor,
        hasMore,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve bookmarks', error);
      this.formatError(error);
    }
  }
}
