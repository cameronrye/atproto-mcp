/**
 * Advanced social features for AT Protocol
 */

import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';

const CreateListSchema = z.object({
  name: z.string().min(1, 'List name is required').max(64, 'List name cannot exceed 64 characters'),
  description: z.string().max(300, 'Description cannot exceed 300 characters').optional(),
  purpose: z.enum(['modlist', 'curatelist']).default('curatelist'),
});

const AddToListSchema = z.object({
  listUri: z.string().min(1, 'List URI is required'),
  actor: z.string().min(1, 'Actor (DID or handle) is required'),
});

const RemoveFromListSchema = z.object({
  listUri: z.string().min(1, 'List URI is required'),
  actor: z.string().min(1, 'Actor (DID or handle) is required'),
});

const GetListSchema = z.object({
  listUri: z.string().min(1, 'List URI is required'),
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

const GetThreadSchema = z.object({
  uri: z.string().min(1, 'Post URI is required'),
  depth: z.number().min(1).max(10).default(6),
  parentHeight: z.number().min(0).max(10).default(80),
});

const GetCustomFeedSchema = z.object({
  feedUri: z.string().min(1, 'Feed URI is required'),
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export class CreateListTool extends BaseTool {
  public readonly schema = {
    method: 'create_list',
    description:
      'Create a new list for organizing users (curate list) or moderation purposes (mod list).',
    params: CreateListSchema,
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
    description: 'Add a user to an existing list.',
    params: AddToListSchema,
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

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.app.bsky.graph.listitem.create(
            { repo: agent.session?.did || '' },
            {
              subject: params.actor,
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
    description: 'Remove a user from an existing list.',
    params: RemoveFromListSchema,
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

      // First, find the list item to delete
      const agent = this.atpClient.getAgent();
      const listResponse = await this.executeAtpOperation(
        async () =>
          await agent.app.bsky.graph.getList({
            list: params.listUri,
            limit: 100,
          }),
        'getList',
        { listUri: params.listUri }
      );

      const listItem = listResponse.data.items.find(
        (item: any) => item.subject.did === params.actor || item.subject.handle === params.actor
      );

      if (!listItem) {
        return {
          success: false,
          message: `User ${params.actor} is not in the specified list`,
          removedFrom: {
            listUri: params.listUri,
            actor: params.actor,
          },
        };
      }

      // Delete the list item
      await this.executeAtpOperation(
        async () =>
          await agent.app.bsky.graph.listitem.delete({
            repo: agent.session?.did || '',
            rkey: listItem.uri.split('/').pop() || '',
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
    description: 'Get the contents of a list, including all users in the list.',
    params: GetListSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'GetList');
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
          itemCount: response.data.items.length,
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

export class GetThreadTool extends BaseTool {
  public readonly schema = {
    method: 'get_thread',
    description:
      'Get a complete thread/conversation starting from a specific post, including replies and parent posts.',
    params: GetThreadSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'GetThread');
  }

  protected async execute(params: { uri: string; depth?: number; parentHeight?: number }): Promise<{
    success: boolean;
    thread: {
      post: {
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
      };
      parent?: any;
      replies?: any[];
    };
  }> {
    try {
      this.logger.info('Getting thread', {
        uri: params.uri,
        depth: params.depth,
        parentHeight: params.parentHeight,
      });

      this.validateAtUri(params.uri);

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getPostThread({
            uri: params.uri,
            depth: params.depth || 6,
            parentHeight: params.parentHeight || 80,
          });
        },
        'getThread',
        { uri: params.uri }
      );

      // Type-safe access to thread data
      const thread = response.data.thread as any;
      const hasParent = thread && 'parent' in thread && !!thread.parent;
      const replyCount = thread && 'replies' in thread ? thread.replies?.length || 0 : 0;

      this.logger.info('Thread retrieved successfully', {
        uri: params.uri,
        hasParent,
        replyCount,
      });

      // Extract post data safely
      const post = thread && 'post' in thread ? thread.post : null;
      if (!post) {
        throw new Error('Thread post data not found');
      }

      return {
        success: true,
        thread: {
          post: {
            uri: post.uri || '',
            cid: post.cid || '',
            author: {
              did: post.author?.did || '',
              handle: post.author?.handle || '',
              displayName: post.author?.displayName,
              avatar: post.author?.avatar,
            },
            text: post.record?.text || '',
            createdAt: post.record?.createdAt || new Date().toISOString(),
            replyCount: post.replyCount || 0,
            repostCount: post.repostCount || 0,
            likeCount: post.likeCount || 0,
          },
          parent: hasParent ? thread.parent : undefined,
          replies: thread && 'replies' in thread ? thread.replies : [],
        },
      };
    } catch (error) {
      this.logger.error('Failed to get thread', error);
      this.formatError(error);
    }
  }
}

export class GetCustomFeedTool extends BaseTool {
  public readonly schema = {
    method: 'get_custom_feed',
    description: 'Get posts from a custom algorithm feed.',
    params: GetCustomFeedSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'GetCustomFeed');
  }

  protected async execute(params: { feedUri: string; limit?: number; cursor?: string }): Promise<{
    success: boolean;
    feed: {
      uri: string;
      displayName?: string;
      description?: string;
      creator: {
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

      // Extract feed metadata safely
      const feedData = response.data.feed as any[];
      const feedMeta = response.data as any;

      return {
        success: true,
        feed: {
          uri: params.feedUri,
          displayName: feedMeta.displayName,
          description: feedMeta.description,
          creator: feedMeta.creator,
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
