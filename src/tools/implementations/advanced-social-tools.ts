/**
 * Advanced social features for AT Protocol
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';

const CreateListSchema = z.object({
  name: z
    .string()
    .min(1, 'List name is required')
    .max(64, 'List name cannot exceed 64 characters')
    .describe('Display name for the list (1–64 characters).'),
  description: z
    .string()
    .max(300, 'Description cannot exceed 300 characters')
    .optional()
    .describe('Optional plain-text description of the list (max 300 characters).'),
  purpose: z
    .enum(['modlist', 'curatelist'])
    .default('curatelist')
    .describe(
      'List type: "curatelist" for a user-curated follow list, "modlist" for a moderation/block list. Defaults to "curatelist".'
    ),
});

const AddToListSchema = z.object({
  listUri: z
    .string()
    .min(1, 'List URI is required')
    .describe('AT-URI of the target list (at://did/app.bsky.graph.list/rkey).'),
  actor: z
    .string()
    .min(1, 'Actor (DID or handle) is required')
    .describe('Handle (e.g. alice.bsky.social) or DID of the user to add to the list.'),
});

const RemoveFromListSchema = z.object({
  listUri: z
    .string()
    .min(1, 'List URI is required')
    .describe('AT-URI of the target list (at://did/app.bsky.graph.list/rkey).'),
  actor: z
    .string()
    .min(1, 'Actor (DID or handle) is required')
    .describe('Handle (e.g. alice.bsky.social) or DID of the user to remove from the list.'),
});

const GetListSchema = z.object({
  listUri: z
    .string()
    .min(1, 'List URI is required')
    .describe('AT-URI of the list to read (at://did/app.bsky.graph.list/rkey).'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .default(50)
    .describe('Max list members to return per page (1–100, default 50).'),
  cursor: z
    .string()
    .optional()
    .describe(
      'Opaque pagination cursor from the previous response cursor field; omit for the first page.'
    ),
});

const GetCustomFeedSchema = z.object({
  feedUri: z
    .string()
    .min(1, 'Feed URI is required')
    .describe(
      'AT-URI of the custom algorithm feed generator (at://did/app.bsky.feed.generator/rkey).'
    ),
  limit: z
    .number()
    .min(1)
    .max(100)
    .default(50)
    .describe('Max posts to return per page (1–100, default 50).'),
  cursor: z
    .string()
    .optional()
    .describe(
      'Opaque pagination cursor from the previous response cursor field; omit for the first page.'
    ),
});

export class CreateListTool extends BaseTool {
  public readonly schema = {
    method: 'create_list',
    description:
      "Create a new list for organizing users (curate list) or moderation purposes (mod list). Requires authentication (app password). Creates a permanent list record in the authenticated user's repository; use add_to_list / remove_from_list to manage its members and get_list to inspect them. Subject to per-tool rate limiting.",
    params: CreateListSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the list was created successfully.' },
        message: { type: 'string', description: 'Human-readable result message.' },
        list: {
          type: 'object',
          description: 'Metadata of the newly created list.',
          properties: {
            uri: { type: 'string', description: 'AT-URI of the new list record.' },
            cid: { type: 'string', description: 'CID of the new list record.' },
            name: { type: 'string', description: 'Display name of the list.' },
            description: { type: 'string', description: 'Optional description of the list.' },
            purpose: { type: 'string', description: 'List purpose: "curatelist" or "modlist".' },
            createdAt: { type: 'string', description: 'ISO 8601 creation timestamp.' },
          },
          required: ['uri', 'cid', 'name', 'purpose', 'createdAt'],
        },
      },
      required: ['success', 'message', 'list'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'CreateList');
  }

  protected async execute(params: {
    name: string;
    description?: string;
    purpose?: 'modlist' | 'curatelist';
  }): Promise<{
    success: boolean;
    message: string;
    list: {
      uri: string;
      cid: string;
      name: string;
      description?: string;
      purpose: string;
      createdAt: string;
    };
  }> {
    try {
      this.logger.info('Creating list', {
        name: params.name,
        purpose: params.purpose,
      });

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.app.bsky.graph.list.create(
            { repo: agent.session?.did || '' },
            {
              name: params.name,
              description: params.description,
              purpose:
                params.purpose === 'modlist'
                  ? 'app.bsky.graph.defs#modlist'
                  : 'app.bsky.graph.defs#curatelist',
              createdAt: new Date().toISOString(),
            }
          );
        },
        'createList',
        { name: params.name, purpose: params.purpose }
      );

      this.logger.info('List created successfully', {
        uri: response.uri,
        name: params.name,
      });

      return {
        success: true,
        message: `List "${params.name}" created successfully`,
        list: {
          uri: response.uri,
          cid: response.cid,
          name: params.name,
          description: params.description,
          purpose: params.purpose || 'curatelist',
          createdAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Failed to create list', error);
      this.formatError(error);
    }
  }
}

export class AddToListTool extends BaseTool {
  public readonly schema = {
    method: 'add_to_list',
    description:
      "Add a user to an existing list. Requires authentication (app password). Creates a listitem record in the authenticated user's repository; the actor's handle is resolved to a DID before insertion. Use remove_from_list to undo the addition and get_list to verify membership. Subject to per-tool rate limiting.",
    params: AddToListSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the user was added successfully.' },
        message: { type: 'string', description: 'Human-readable result message.' },
        listItem: {
          type: 'object',
          description: 'Details of the newly created list-item record.',
          properties: {
            uri: { type: 'string', description: 'AT-URI of the new listitem record.' },
            listUri: { type: 'string', description: 'AT-URI of the parent list.' },
            actor: { type: 'string', description: 'Handle or DID of the user that was added.' },
          },
          required: ['uri', 'listUri', 'actor'],
        },
      },
      required: ['success', 'message', 'listItem'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'AddToList');
  }

  protected async execute(params: { listUri: string; actor: string }): Promise<{
    success: boolean;
    message: string;
    listItem: {
      uri: string;
      listUri: string;
      actor: string;
    };
  }> {
    try {
      this.logger.info('Adding user to list', {
        listUri: params.listUri,
        actor: params.actor,
      });

      this.validateAtUri(params.listUri);
      this.validateActor(params.actor);

      // A list item's subject must be a DID, not a handle.
      const subjectDid = await this.resolveDid(params.actor);

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.app.bsky.graph.listitem.create(
            { repo: agent.session?.did || '' },
            {
              subject: subjectDid,
              list: params.listUri,
              createdAt: new Date().toISOString(),
            }
          );
        },
        'addToList',
        { listUri: params.listUri, actor: params.actor }
      );

      this.logger.info('User added to list successfully', {
        uri: response.uri,
        listUri: params.listUri,
        actor: params.actor,
      });

      return {
        success: true,
        message: `User ${params.actor} added to list successfully`,
        listItem: {
          uri: response.uri,
          listUri: params.listUri,
          actor: params.actor,
        },
      };
    } catch (error) {
      this.logger.error('Failed to add user to list', error);
      this.formatError(error);
    }
  }
}

export class RemoveFromListTool extends BaseTool {
  public readonly schema = {
    method: 'remove_from_list',
    description:
      "Remove a user from an existing list. Requires authentication (app password). Deletes the listitem record from the authenticated user's repository; the actor's handle is resolved to a DID and the full list is paged through to locate the record. Use add_to_list to re-add a member or get_list to inspect current members. Subject to per-tool rate limiting.",
    params: RemoveFromListSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description:
            'Whether the user was removed. False when the user was not in the list, or when the list was too large to scan fully (see message).',
        },
        message: { type: 'string', description: 'Human-readable result message.' },
        removedFrom: {
          type: 'object',
          description: 'Identifies the list and actor involved in the operation.',
          properties: {
            listUri: { type: 'string', description: 'AT-URI of the list.' },
            actor: { type: 'string', description: 'Handle or DID of the user that was removed.' },
          },
          required: ['listUri', 'actor'],
        },
      },
      required: ['success', 'message', 'removedFrom'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'RemoveFromList');
  }

  protected async execute(params: { listUri: string; actor: string }): Promise<{
    success: boolean;
    message: string;
    removedFrom: {
      listUri: string;
      actor: string;
    };
  }> {
    try {
      this.logger.info('Removing user from list', {
        listUri: params.listUri,
        actor: params.actor,
      });

      this.validateAtUri(params.listUri);
      this.validateActor(params.actor);

      // List items reference their subject by DID. Resolve the actor to a DID and
      // page through the whole list so members beyond the first 100 are found and
      // a handle/DID mismatch does not cause a false "not in list".
      const agent = this.atpClient.getAgent();
      const resolvedDid = await this.resolveDid(params.actor);

      let listItem: { uri: string } | undefined;
      let cursor: string | undefined;
      const MAX_PAGES = 50;
      for (let page = 0; page < MAX_PAGES; page++) {
        const listResponse = await this.executeAtpOperation(
          async () =>
            await agent.app.bsky.graph.getList({
              list: params.listUri,
              limit: 100,
              ...(cursor ? { cursor } : {}),
            }),
          'getList',
          { listUri: params.listUri }
        );

        const match = listResponse.data.items.find(
          (item: { subject?: { did?: string }; uri: string }) => item.subject?.did === resolvedDid
        );
        if (match) {
          listItem = match;
          break;
        }

        cursor = listResponse.data.cursor;
        if (!cursor) {
          break;
        }
      }

      if (!listItem) {
        // A cursor left over after the page cap means the list was NOT fully
        // scanned — report that distinctly instead of a false "not in list".
        if (cursor) {
          return {
            success: false,
            message: `List too large to scan: user ${params.actor} was not found within the first ${MAX_PAGES * 100} entries`,
            removedFrom: {
              listUri: params.listUri,
              actor: params.actor,
            },
          };
        }
        return {
          success: false,
          message: `User ${params.actor} is not in the specified list`,
          removedFrom: {
            listUri: params.listUri,
            actor: params.actor,
          },
        };
      }

      const rkey = listItem.uri.split('/').pop();
      if (!rkey) {
        return {
          success: false,
          message: `Could not determine the list-item record for ${params.actor}`,
          removedFrom: {
            listUri: params.listUri,
            actor: params.actor,
          },
        };
      }

      // The listitem record lives in the list owner's (authenticated user's) repo.
      await this.executeAtpOperation(
        async () =>
          await agent.app.bsky.graph.listitem.delete({
            repo: agent.session?.did ?? '',
            rkey,
          }),
        'removeFromList',
        { listUri: params.listUri, actor: params.actor }
      );

      this.logger.info('User removed from list successfully', {
        listUri: params.listUri,
        actor: params.actor,
      });

      return {
        success: true,
        message: `User ${params.actor} removed from list successfully`,
        removedFrom: {
          listUri: params.listUri,
          actor: params.actor,
        },
      };
    } catch (error) {
      this.logger.error('Failed to remove user from list', error);
      this.formatError(error);
    }
  }
}

export class GetListTool extends BaseTool {
  public readonly schema = {
    method: 'get_list',
    description:
      'Get the contents of a list, including all users in the list. Works without authentication; richer with auth. Returns list metadata plus a paginated array of member profiles; use the returned cursor to fetch subsequent pages. Use add_to_list / remove_from_list to modify membership. Subject to per-tool rate limiting.',
    params: GetListSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the list was retrieved successfully.' },
        list: {
          type: 'object',
          description: 'Metadata about the list.',
          properties: {
            uri: { type: 'string', description: 'AT-URI of the list.' },
            name: { type: 'string', description: 'Display name of the list.' },
            description: { type: 'string', description: 'Optional plain-text description.' },
            purpose: { type: 'string', description: 'List purpose: "curatelist" or "modlist".' },
            creator: {
              type: 'object',
              description: 'Profile of the list creator.',
              properties: {
                did: { type: 'string', description: 'DID of the creator.' },
                handle: { type: 'string', description: 'Handle of the creator.' },
                displayName: {
                  type: 'string',
                  description: 'Optional display name of the creator.',
                },
              },
              required: ['did', 'handle'],
            },
            itemCount: { type: 'number', description: 'Total number of members in the list.' },
          },
          required: ['uri', 'name', 'purpose', 'creator', 'itemCount'],
        },
        items: {
          type: 'array',
          description: 'Paginated list of member entries.',
          items: {
            type: 'object',
            properties: {
              uri: { type: 'string', description: 'AT-URI of the listitem record.' },
              subject: {
                type: 'object',
                description: 'Profile of the list member.',
                properties: {
                  did: { type: 'string', description: 'DID of the member.' },
                  handle: { type: 'string', description: 'Handle of the member.' },
                  displayName: { type: 'string', description: 'Optional display name.' },
                  avatar: { type: 'string', description: 'Optional avatar image URL.' },
                },
                required: ['did', 'handle'],
              },
            },
            required: ['uri', 'subject'],
          },
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor for the next page; absent when no more pages.',
        },
      },
      required: ['success', 'list', 'items'],
    },
  };

  constructor(atpClient: AtpClient) {
    // Reading a list works against the public AppView; it just returns richer
    // viewer state when authenticated.
    super(atpClient, 'GetList', ToolAuthMode.ENHANCED);
  }

  protected async execute(params: { listUri: string; limit?: number; cursor?: string }): Promise<{
    success: boolean;
    list: {
      uri: string;
      name: string;
      description?: string;
      purpose: string;
      creator: {
        did: string;
        handle: string;
        displayName?: string;
      };
      itemCount: number;
    };
    items: Array<{
      uri: string;
      subject: {
        did: string;
        handle: string;
        displayName?: string;
        avatar?: string;
      };
    }>;
    cursor?: string;
  }> {
    try {
      this.logger.info('Getting list contents', {
        listUri: params.listUri,
        limit: params.limit,
      });

      this.validateAtUri(params.listUri);

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.app.bsky.graph.getList({
            list: params.listUri,
            limit: params.limit || 50,
            cursor: params.cursor,
          });
        },
        'getList',
        { listUri: params.listUri }
      );

      this.logger.info('List contents retrieved successfully', {
        listUri: params.listUri,
        itemCount: response.data.items.length,
      });

      return {
        success: true,
        list: {
          uri: response.data.list.uri,
          name: response.data.list.name,
          description: response.data.list.description,
          purpose: response.data.list.purpose,
          creator: {
            did: response.data.list.creator.did,
            handle: response.data.list.creator.handle,
            displayName: response.data.list.creator.displayName,
          },
          // The list view carries the true member count; items.length is only the
          // current page, so prefer listItemCount and fall back when it is absent.
          itemCount: response.data.list.listItemCount ?? response.data.items.length,
        },
        items: response.data.items.map((item: any) => ({
          uri: item.uri,
          subject: {
            did: item.subject.did,
            handle: item.subject.handle,
            displayName: item.subject.displayName,
            avatar: item.subject.avatar,
          },
        })),
        cursor: response.data.cursor,
      };
    } catch (error) {
      this.logger.error('Failed to get list contents', error);
      this.formatError(error);
    }
  }
}

export class GetCustomFeedTool extends BaseTool {
  public readonly schema = {
    method: 'get_custom_feed',
    description:
      "Get posts from a custom algorithm feed. Works without authentication; richer with auth. Returns feed generator metadata and a paginated list of posts; use the returned cursor to fetch subsequent pages. Use get_timeline for the authenticated user's home feed instead. Subject to per-tool rate limiting.",
    params: GetCustomFeedSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the feed was retrieved successfully.' },
        feed: {
          type: 'object',
          description: 'Metadata about the feed generator.',
          properties: {
            uri: { type: 'string', description: 'AT-URI of the feed generator.' },
            displayName: { type: 'string', description: 'Optional display name of the feed.' },
            description: { type: 'string', description: 'Optional description of the feed.' },
            creator: {
              type: 'object',
              description:
                'Optional profile of the feed creator (present when generator metadata is available).',
              properties: {
                did: { type: 'string', description: 'DID of the creator.' },
                handle: { type: 'string', description: 'Handle of the creator.' },
                displayName: {
                  type: 'string',
                  description: 'Optional display name of the creator.',
                },
              },
              required: ['did', 'handle'],
            },
          },
          required: ['uri'],
        },
        posts: {
          type: 'array',
          description: 'Paginated posts from the feed.',
          items: {
            type: 'object',
            properties: {
              uri: { type: 'string', description: 'AT-URI of the post.' },
              cid: { type: 'string', description: 'CID of the post.' },
              author: {
                type: 'object',
                description: 'Author of the post.',
                properties: {
                  did: { type: 'string', description: 'DID of the author.' },
                  handle: { type: 'string', description: 'Handle of the author.' },
                  displayName: { type: 'string', description: 'Optional display name.' },
                  avatar: { type: 'string', description: 'Optional avatar image URL.' },
                },
                required: ['did', 'handle'],
              },
              text: { type: 'string', description: 'Plain text content of the post.' },
              createdAt: {
                type: 'string',
                description: 'ISO 8601 timestamp when the post was created.',
              },
              replyCount: { type: 'number', description: 'Number of replies.' },
              repostCount: { type: 'number', description: 'Number of reposts.' },
              likeCount: { type: 'number', description: 'Number of likes.' },
              isLiked: {
                type: 'boolean',
                description: 'Whether the authenticated user has liked this post.',
              },
              isReposted: {
                type: 'boolean',
                description: 'Whether the authenticated user has reposted this post.',
              },
            },
            required: [
              'uri',
              'cid',
              'author',
              'text',
              'createdAt',
              'replyCount',
              'repostCount',
              'likeCount',
              'isLiked',
              'isReposted',
            ],
          },
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor for the next page; absent when no more pages.',
        },
      },
      required: ['success', 'feed', 'posts'],
    },
  };

  constructor(atpClient: AtpClient) {
    // Public custom feeds are readable without authentication.
    super(atpClient, 'GetCustomFeed', ToolAuthMode.ENHANCED);
  }

  protected async execute(params: { feedUri: string; limit?: number; cursor?: string }): Promise<{
    success: boolean;
    feed: {
      uri: string;
      displayName?: string;
      description?: string;
      // Optional: only present when the feed-generator metadata could be fetched
      // (app.bsky.feed.getFeed does not return it; getFeedGenerator does).
      creator?: {
        did: string;
        handle: string;
        displayName?: string;
      };
    };
    posts: Array<{
      uri: string;
      cid: string;
      author: {
        did: string;
        handle: string;
        displayName?: string;
        avatar?: string;
      };
      text: string;
      createdAt: string;
      replyCount: number;
      repostCount: number;
      likeCount: number;
      isLiked: boolean;
      isReposted: boolean;
    }>;
    cursor?: string;
  }> {
    try {
      this.logger.info('Getting custom feed', {
        feedUri: params.feedUri,
        limit: params.limit,
      });

      this.validateAtUri(params.feedUri);

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.app.bsky.feed.getFeed({
            feed: params.feedUri,
            limit: params.limit || 50,
            cursor: params.cursor,
          });
        },
        'getCustomFeed',
        { feedUri: params.feedUri }
      );

      this.logger.info('Custom feed retrieved successfully', {
        feedUri: params.feedUri,
        postCount: response.data.feed.length,
      });

      // app.bsky.feed.getFeed returns only { feed, cursor } — it carries no
      // displayName/description/creator. Fetch that metadata separately (best
      // effort) via getFeedGenerator; if it fails (e.g. the URI is not a feed
      // generator, or the generator is offline) we return just the URI rather
      // than fabricating always-undefined fields.
      const feedData = response.data.feed as any[];
      let feedMeta: { displayName?: string; description?: string; creator?: any } = {};
      try {
        const genResponse = await this.executeAtpOperation(
          async () => {
            const agent = this.atpClient.getAgent();
            return await agent.app.bsky.feed.getFeedGenerator({ feed: params.feedUri });
          },
          'getFeedGenerator',
          { feedUri: params.feedUri }
        );
        const view = (genResponse.data as any).view;
        if (view) {
          feedMeta = {
            displayName: view.displayName,
            description: view.description,
            creator: view.creator,
          };
        }
      } catch (metaError) {
        this.logger.debug('Could not fetch feed generator metadata', metaError);
      }

      return {
        success: true,
        feed: {
          uri: params.feedUri,
          ...(feedMeta.displayName != null && { displayName: feedMeta.displayName }),
          ...(feedMeta.description != null && { description: feedMeta.description }),
          ...(feedMeta.creator != null && { creator: feedMeta.creator }),
        },
        posts: feedData.map((item: any) => ({
          uri: item.post.uri,
          cid: item.post.cid,
          author: {
            did: item.post.author.did,
            handle: item.post.author.handle,
            displayName: item.post.author.displayName,
            avatar: item.post.author.avatar,
          },
          text: item.post.record.text,
          createdAt: item.post.record.createdAt,
          replyCount: item.post.replyCount || 0,
          repostCount: item.post.repostCount || 0,
          likeCount: item.post.likeCount || 0,
          isLiked: !!item.post.viewer?.like,
          isReposted: !!item.post.viewer?.repost,
        })),
        cursor: response.data.cursor,
      };
    } catch (error) {
      this.logger.error('Failed to get custom feed', error);
      this.formatError(error);
    }
  }
}
