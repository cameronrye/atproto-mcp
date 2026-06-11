/**
 * Starter Pack Tools - Discover and inspect Bluesky starter packs
 *
 * Both endpoints (app.bsky.graph.searchStarterPacks / getStarterPack) are
 * public AppView reads — the searchStarterPacks lexicon says "Does not require
 * auth" and getStarterPack carries no auth requirement — so both tools are
 * ENHANCED: available unauthenticated via the public API fallback, using the
 * authenticated session when one exists (mirroring get_user_profile /
 * get_user_connections).
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import { type ATURI, type CID, type DID, ValidationError } from '../../types/index.js';

const STARTER_PACK_COLLECTION = 'app.bsky.graph.starterpack';

/**
 * Compact creator shape shared by both tools (from ProfileViewBasic).
 */
interface IStarterPackCreator {
  did: DID;
  handle: string;
  displayName?: string;
  avatar?: string;
}

function mapCreator(creator: any): IStarterPackCreator {
  return {
    did: creator.did as DID,
    handle: creator.handle,
    displayName: creator.displayName,
    avatar: creator.avatar,
  };
}

/**
 * The starterPackView/starterPackViewBasic `record` field is an untyped map in
 * the lexicon; pull the fields the app.bsky.graph.starterpack record defines.
 */
function recordFields(record: unknown): { name: string; description?: string } {
  const rec = (record ?? {}) as { name?: string; description?: string };
  return { name: rec.name ?? '', description: rec.description };
}

/**
 * JSON-schema fragment for the creator object, shared by both outputSchemas.
 */
const CREATOR_OUTPUT_SCHEMA = {
  type: 'object',
  description: 'Profile of the account that created the starter pack.',
  properties: {
    did: { type: 'string', description: "Creator's DID." },
    handle: { type: 'string', description: "Creator's handle." },
    displayName: { type: 'string', description: "Creator's display name, if set." },
    avatar: { type: 'string', description: "URL of the creator's avatar image." },
  },
  required: ['did', 'handle'],
};

/**
 * Zod schema for search starter packs parameters
 */
const SearchStarterPacksSchema = z.object({
  q: z
    .string()
    .min(1, 'Search query is required')
    .describe(
      'Search query string for finding starter packs (e.g. "typescript developers"). Plain keywords work; the API recommends Lucene query syntax for advanced queries.'
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Max starter packs per page (1–100, default 25).'),
  cursor: z
    .string()
    .optional()
    .describe(
      'Opaque pagination cursor from the previous response cursor field; omit for the first page.'
    ),
});

/**
 * Tool for searching Bluesky starter packs
 *
 * AUTHENTICATION REQUIREMENT:
 * - Works without authentication (ENHANCED mode): public AppView endpoint,
 *   uses the authenticated session when one exists.
 */
export class SearchStarterPacksTool extends BaseTool {
  public readonly schema = {
    method: 'search_starter_packs',
    description:
      'Search for Bluesky starter packs by keyword (app.bsky.graph.searchStarterPacks). Returns a paginated list of matching packs with name, description, creator, member count, and joined counts. Works without authentication. Use get_starter_pack to fetch full details (member sample, feeds, list info) for a specific pack. Subject to per-tool rate limiting.',
    params: SearchStarterPacksSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the search succeeded.' },
        query: { type: 'string', description: 'The search query that was executed.' },
        starterPacks: {
          type: 'array',
          description: 'The matched starter packs for this page.',
          items: {
            type: 'object',
            properties: {
              uri: {
                type: 'string',
                description:
                  'AT-URI of the starter pack record (at://did/app.bsky.graph.starterpack/rkey); pass to get_starter_pack for full details.',
              },
              cid: { type: 'string', description: 'CID of the starter pack record.' },
              name: { type: 'string', description: 'Display name of the starter pack.' },
              description: {
                type: 'string',
                description: 'Description of the starter pack, if set.',
              },
              creator: CREATOR_OUTPUT_SCHEMA,
              listItemCount: {
                type: 'number',
                description: 'Number of accounts in the pack’s reference list, when reported.',
              },
              joinedWeekCount: {
                type: 'number',
                description: 'Accounts that joined via this pack in the past week, when reported.',
              },
              joinedAllTimeCount: {
                type: 'number',
                description: 'Accounts that joined via this pack all-time, when reported.',
              },
              indexedAt: {
                type: 'string',
                description: 'ISO 8601 timestamp when the pack was indexed.',
              },
            },
            required: ['uri', 'cid', 'name', 'creator', 'indexedAt'],
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
      required: ['success', 'query', 'starterPacks', 'hasMore'],
    },
  };

  constructor(atpClient: AtpClient) {
    // Public AppView search; works unauthenticated ("Does not require auth").
    super(atpClient, 'SearchStarterPacks', ToolAuthMode.ENHANCED);
  }

  protected async execute(params: { q: string; limit?: number; cursor?: string }): Promise<{
    success: boolean;
    query: string;
    starterPacks: Array<{
      uri: ATURI;
      cid: CID;
      name: string;
      description?: string;
      creator: IStarterPackCreator;
      listItemCount?: number;
      joinedWeekCount?: number;
      joinedAllTimeCount?: number;
      indexedAt: string;
    }>;
    cursor?: string;
    hasMore: boolean;
  }> {
    try {
      this.logger.info('Searching starter packs', {
        query: params.q,
        limit: params.limit,
        hasCursor: !!params.cursor,
      });

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.app.bsky.graph.searchStarterPacks({
            q: params.q,
            limit: params.limit ?? 25,
            cursor: params.cursor,
          });
        },
        'searchStarterPacks',
        { query: params.q, limit: params.limit }
      );

      const starterPacks = response.data.starterPacks.map(entry => {
        const { name, description } = recordFields(entry.record);
        return {
          uri: entry.uri as ATURI,
          cid: entry.cid as CID,
          name,
          description,
          creator: mapCreator(entry.creator),
          listItemCount: entry.listItemCount,
          joinedWeekCount: entry.joinedWeekCount,
          joinedAllTimeCount: entry.joinedAllTimeCount,
          indexedAt: entry.indexedAt,
        };
      });

      const cursor = response.data.cursor;
      const hasMore = !!cursor;

      this.logger.info('Starter pack search completed', {
        query: params.q,
        count: starterPacks.length,
        hasMore,
      });

      return {
        success: true,
        query: params.q,
        starterPacks,
        cursor,
        hasMore,
      };
    } catch (error) {
      this.logger.error('Failed to search starter packs', error);
      this.formatError(error);
    }
  }
}

/**
 * Zod schema for get starter pack parameters
 */
const GetStarterPackSchema = z.object({
  starterPack: z
    .string()
    .min(1, 'Starter pack reference is required')
    .describe(
      'Starter pack reference: an AT-URI (at://did/app.bsky.graph.starterpack/rkey) or a bsky.app link (https://bsky.app/starter-pack/{handle-or-did}/{rkey}). go.bsky.app short links are not supported — open one in a browser and use the resulting bsky.app URL.'
    ),
});

/**
 * Tool for fetching a single Bluesky starter pack with full details
 *
 * AUTHENTICATION REQUIREMENT:
 * - Works without authentication (ENHANCED mode): public AppView endpoint,
 *   uses the authenticated session when one exists.
 */
export class GetStarterPackTool extends BaseTool {
  public readonly schema = {
    method: 'get_starter_pack',
    description:
      'Fetch a Bluesky starter pack (app.bsky.graph.getStarterPack) by AT-URI or bsky.app link, returning its name, description, creator, reference-list info, a sample of member profiles, included feeds, and joined counts. Works without authentication. Use search_starter_packs to discover packs by keyword, and get_list to page through the full member list. Subject to per-tool rate limiting.',
    params: GetStarterPackSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the request succeeded.' },
        starterPack: {
          type: 'object',
          description: 'Full view of the starter pack.',
          properties: {
            uri: { type: 'string', description: 'AT-URI of the starter pack record.' },
            cid: { type: 'string', description: 'CID of the starter pack record.' },
            name: { type: 'string', description: 'Display name of the starter pack.' },
            description: {
              type: 'string',
              description: 'Description of the starter pack, if set.',
            },
            creator: CREATOR_OUTPUT_SCHEMA,
            list: {
              type: 'object',
              description:
                'The reference list backing the pack, when reported. Pass its uri to get_list to page through all members.',
              properties: {
                uri: { type: 'string', description: 'AT-URI of the list record.' },
                cid: { type: 'string', description: 'CID of the list record.' },
                name: { type: 'string', description: 'Name of the list.' },
                purpose: {
                  type: 'string',
                  description:
                    'List purpose NSID (starter pack lists are app.bsky.graph.defs#referencelist).',
                },
                avatar: { type: 'string', description: 'URL of the list avatar image, if set.' },
                listItemCount: {
                  type: 'number',
                  description: 'Total number of accounts in the list, when reported.',
                },
              },
              required: ['uri', 'cid', 'name', 'purpose'],
            },
            sampleProfiles: {
              type: 'array',
              description:
                'Sample of member profiles from the pack’s list (not the full membership; use get_list for that).',
              items: {
                type: 'object',
                properties: {
                  did: { type: 'string', description: "Member's DID." },
                  handle: { type: 'string', description: "Member's handle." },
                  displayName: { type: 'string', description: "Member's display name, if set." },
                  description: { type: 'string', description: "Member's bio, if set." },
                  avatar: { type: 'string', description: "URL of the member's avatar image." },
                },
                required: ['did', 'handle'],
              },
            },
            feeds: {
              type: 'array',
              description: 'Feed generators included in the starter pack (often empty).',
              items: {
                type: 'object',
                properties: {
                  uri: { type: 'string', description: 'AT-URI of the feed generator record.' },
                  cid: { type: 'string', description: 'CID of the feed generator record.' },
                  displayName: { type: 'string', description: 'Display name of the feed.' },
                  description: { type: 'string', description: 'Description of the feed, if set.' },
                  avatar: { type: 'string', description: 'URL of the feed avatar image, if set.' },
                  likeCount: { type: 'number', description: 'Number of likes on the feed.' },
                  creator: CREATOR_OUTPUT_SCHEMA,
                },
                required: ['uri', 'cid', 'displayName', 'creator'],
              },
            },
            joinedWeekCount: {
              type: 'number',
              description: 'Accounts that joined via this pack in the past week, when reported.',
            },
            joinedAllTimeCount: {
              type: 'number',
              description: 'Accounts that joined via this pack all-time, when reported.',
            },
            indexedAt: {
              type: 'string',
              description: 'ISO 8601 timestamp when the pack was indexed.',
            },
          },
          required: ['uri', 'cid', 'name', 'creator', 'sampleProfiles', 'feeds', 'indexedAt'],
        },
      },
      required: ['success', 'starterPack'],
    },
  };

  constructor(atpClient: AtpClient) {
    // Public AppView read; works unauthenticated.
    super(atpClient, 'GetStarterPack', ToolAuthMode.ENHANCED);
  }

  protected async execute(params: { starterPack: string }): Promise<{
    success: boolean;
    starterPack: {
      uri: ATURI;
      cid: CID;
      name: string;
      description?: string;
      creator: IStarterPackCreator;
      list?: {
        uri: ATURI;
        cid: CID;
        name: string;
        purpose: string;
        avatar?: string;
        listItemCount?: number;
      };
      sampleProfiles: Array<{
        did: DID;
        handle: string;
        displayName?: string;
        description?: string;
        avatar?: string;
      }>;
      feeds: Array<{
        uri: ATURI;
        cid: CID;
        displayName: string;
        description?: string;
        avatar?: string;
        likeCount?: number;
        creator: IStarterPackCreator;
      }>;
      joinedWeekCount?: number;
      joinedAllTimeCount?: number;
      indexedAt: string;
    };
  }> {
    try {
      this.logger.info('Retrieving starter pack', { reference: params.starterPack });

      const atUri = await this.resolveStarterPackUri(params.starterPack);

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.app.bsky.graph.getStarterPack({ starterPack: atUri });
        },
        'getStarterPack',
        { starterPack: atUri }
      );

      const view = response.data.starterPack;
      const { name, description } = recordFields(view.record);

      this.logger.info('Starter pack retrieved successfully', {
        uri: view.uri,
        name,
        sampleCount: view.listItemsSample?.length ?? 0,
      });

      return {
        success: true,
        starterPack: {
          uri: view.uri as ATURI,
          cid: view.cid as CID,
          name,
          description,
          creator: mapCreator(view.creator),
          list: view.list
            ? {
                uri: view.list.uri as ATURI,
                cid: view.list.cid as CID,
                name: view.list.name,
                purpose: view.list.purpose,
                avatar: view.list.avatar,
                listItemCount: view.list.listItemCount,
              }
            : undefined,
          sampleProfiles: (view.listItemsSample ?? []).map(item => ({
            did: item.subject.did as DID,
            handle: item.subject.handle,
            displayName: item.subject.displayName,
            description: item.subject.description,
            avatar: item.subject.avatar,
          })),
          feeds: (view.feeds ?? []).map(feed => ({
            uri: feed.uri as ATURI,
            cid: feed.cid as CID,
            displayName: feed.displayName,
            description: feed.description,
            avatar: feed.avatar,
            likeCount: feed.likeCount,
            creator: mapCreator(feed.creator),
          })),
          joinedWeekCount: view.joinedWeekCount,
          joinedAllTimeCount: view.joinedAllTimeCount,
          indexedAt: view.indexedAt,
        },
      };
    } catch (error) {
      this.logger.error('Failed to retrieve starter pack', error);
      this.formatError(error);
    }
  }

  /**
   * Resolve the user-supplied reference (at:// URI or bsky.app link) to the
   * at:// URI the getStarterPack endpoint requires. Web links carry a handle
   * or DID plus rkey; handles are resolved to DIDs first because starter pack
   * AT-URIs are repo-addressed by DID.
   */
  private async resolveStarterPackUri(reference: string): Promise<string> {
    if (reference.startsWith('at://')) {
      // Pin the collection: getStarterPack only serves starter pack records,
      // so fail fast on e.g. a list or post URI instead of round-tripping.
      const { collection } = this.parseAtUri(reference);
      if (collection !== STARTER_PACK_COLLECTION) {
        throw new ValidationError(
          `starterPack must reference a starter pack record (collection "${collection}" is not ${STARTER_PACK_COLLECTION})`,
          'starterPack',
          reference
        );
      }
      return reference;
    }

    let url: URL;
    try {
      url = new URL(reference);
    } catch {
      throw new ValidationError(
        'starterPack must be an at:// URI (at://did/app.bsky.graph.starterpack/rkey) or a bsky.app link (https://bsky.app/starter-pack/{handle-or-did}/{rkey})',
        'starterPack',
        reference
      );
    }

    const segments = url.pathname.split('/').filter(Boolean);
    const [prefix, rawActor, rkey] = segments;
    if (
      url.hostname !== 'bsky.app' ||
      segments.length !== 3 ||
      !prefix ||
      !rawActor ||
      !rkey ||
      !['starter-pack', 'start'].includes(prefix)
    ) {
      throw new ValidationError(
        'Unrecognized starter pack link. Expected https://bsky.app/starter-pack/{handle-or-did}/{rkey} (go.bsky.app short links are not supported — open one in a browser and use the resulting bsky.app URL).',
        'starterPack',
        reference
      );
    }

    // DIDs appear URL-encoded in links (colons may be %3A); decode before use.
    const actor = decodeURIComponent(rawActor);
    this.validateActor(actor);
    const did = await this.resolveDid(actor);

    return `at://${did}/${STARTER_PACK_COLLECTION}/${rkey}`;
  }
}
