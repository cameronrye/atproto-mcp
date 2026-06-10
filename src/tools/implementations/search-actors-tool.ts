/**
 * Search Actors Tool - Find AT Protocol accounts by handle or display name
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';

/**
 * Zod schema for search actors parameters
 */
const SearchActorsSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      'Search term matched against handle and display name (e.g. "alice" or "Alice Smith").'
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Max accounts to return (1–100, default 25).'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor from a previous response; omit for the first page.'),
});

type SearchActorsParams = z.infer<typeof SearchActorsSchema>;

interface IActorResult {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
}

/**
 * Tool for finding AT Protocol accounts by handle or display name.
 *
 * AUTHENTICATION BEHAVIOR:
 * - Works without authentication (ToolAuthMode.ENHANCED)
 * - Authenticated requests may return viewer-specific data
 */
export class SearchActorsTool extends BaseTool {
  public readonly schema = {
    method: 'search_actors',
    description:
      'Search for AT Protocol accounts by handle or display name. Works without authentication; richer with auth. Use this when you know a name but not the exact handle/DID; use get_user_profile when you already have the handle/DID. Subject to per-tool rate limiting.',
    params: SearchActorsSchema,
    outputSchema: {
      type: 'object',
      description: 'Paginated list of matching accounts.',
      properties: {
        success: { type: 'boolean', description: 'Whether the request succeeded.' },
        actors: {
          type: 'array',
          description: 'Accounts matching the search term.',
          items: {
            type: 'object',
            properties: {
              did: { type: 'string', description: 'Decentralized identifier.' },
              handle: { type: 'string', description: 'AT Protocol handle.' },
              displayName: { type: 'string', description: 'Display name, if set.' },
              description: { type: 'string', description: 'Bio / profile description.' },
              avatar: { type: 'string', description: 'URL of the avatar image.' },
            },
            required: ['did', 'handle'],
          },
        },
        cursor: {
          type: 'string',
          description: 'Opaque cursor for the next page; absent when there are no more results.',
        },
      },
      required: ['success', 'actors'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'SearchActors', ToolAuthMode.ENHANCED);
  }

  protected async execute(params: SearchActorsParams): Promise<{
    success: boolean;
    actors: IActorResult[];
    cursor?: string;
  }> {
    try {
      this.logger.info('Searching actors', {
        query: params.query,
        limit: params.limit,
        hasCursor: !!params.cursor,
      });

      const searchParams: { q: string; limit: number; cursor?: string } = {
        q: params.query,
        limit: params.limit ?? 25,
      };

      if (params.cursor) searchParams.cursor = params.cursor;

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.app.bsky.actor.searchActors(searchParams);
        },
        'searchActors',
        { query: params.query, limit: params.limit }
      );

      const actors: IActorResult[] = response.data.actors.map((actor: any) => ({
        did: actor.did,
        handle: actor.handle,
        displayName: actor.displayName,
        description: actor.description,
        avatar: actor.avatar,
      }));

      this.logger.info('Actor search completed', {
        query: params.query,
        foundActors: actors.length,
        hasCursor: !!response.data.cursor,
      });

      return {
        success: true,
        actors,
        cursor: response.data.cursor,
      };
    } catch (error) {
      this.logger.error('Failed to search actors', error);
      this.formatError(error);
    }
  }
}
