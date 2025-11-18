/**
 * Conversation Context Resource - Tracks conversation state for LLM interactions
 */

import type { AtpClient } from '../utils/atp-client.js';
import { BaseResource, type IResourceContent } from './base.js';

interface IConversationContext {
  recentlyDiscussedPosts: Array<{
    uri: string;
    cid: string;
    text: string;
    author: string;
    discussedAt: string;
    context: string;
  }>;
  activeThreads: Array<{
    rootUri: string;
    rootCid: string;
    topic: string;
    lastInteraction: string;
    participantCount: number;
  }>;
  mentionedUsers: Array<{
    did: string;
    handle: string;
    displayName?: string;
    mentionedAt: string;
    context: string;
  }>;
  searchHistory: Array<{
    query: string;
    timestamp: string;
    resultCount: number;
  }>;
  recentActions: Array<{
    action: string;
    target: string;
    timestamp: string;
    details: Record<string, any>;
  }>;
}

/**
 * Conversation Context Resource
 *
 * This resource maintains state across LLM interactions, tracking:
 * - Posts that have been discussed in the conversation
 * - Active threads being followed
 * - Users that have been mentioned
 * - Search queries performed
 * - Recent actions taken
 *
 * This helps LLMs maintain context and provide more coherent, contextual responses.
 */
export class ConversationContextResource extends BaseResource {
  public readonly uri = 'atproto://conversation-context';
  public readonly name = 'Conversation Context';
  public readonly description =
    'Tracks conversation state including recently discussed posts, active threads, mentioned users, and recent actions. Helps maintain context across interactions.';
  public readonly mimeType = 'application/json';

  private static context: IConversationContext = {
    recentlyDiscussedPosts: [],
    activeThreads: [],
    mentionedUsers: [],
    searchHistory: [],
    recentActions: [],
  };

  private static readonly MAX_ITEMS = 50;

  constructor(atpClient: AtpClient) {
    super(atpClient, 'ConversationContextResource');
  }

  async read(): Promise<IResourceContent> {
    try {
      this.logger.info('Reading conversation context resource');

      const contextData = {
        uri: this.uri,
        timestamp: new Date().toISOString(),
        context: ConversationContextResource.context,
        summary: {
          discussedPostsCount: ConversationContextResource.context.recentlyDiscussedPosts.length,
          activeThreadsCount: ConversationContextResource.context.activeThreads.length,
          mentionedUsersCount: ConversationContextResource.context.mentionedUsers.length,
          searchHistoryCount: ConversationContextResource.context.searchHistory.length,
          recentActionsCount: ConversationContextResource.context.recentActions.length,
        },
      };

      return {
        uri: this.uri,
        mimeType: this.mimeType,
        text: JSON.stringify(contextData, null, 2),
      };
    } catch (error) {
      this.logger.error('Failed to read conversation context resource', error);
      throw error;
    }
  }

  /**
   * Check if the resource is available
   * This resource is always available as it tracks local state
   */
  override async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Add a discussed post to the context
   */
  static addDiscussedPost(post: {
    uri: string;
    cid: string;
    text: string;
    author: string;
    context: string;
  }): void {
    this.context.recentlyDiscussedPosts.unshift({
      ...post,
      discussedAt: new Date().toISOString(),
    });

    // Keep only the most recent items
    if (this.context.recentlyDiscussedPosts.length > this.MAX_ITEMS) {
      this.context.recentlyDiscussedPosts = this.context.recentlyDiscussedPosts.slice(
        0,
        this.MAX_ITEMS
      );
    }
  }

  /**
   * Add an active thread to the context
   */
  static addActiveThread(thread: {
    rootUri: string;
    rootCid: string;
    topic: string;
    participantCount: number;
  }): void {
    // Check if thread already exists
    const existingIndex = this.context.activeThreads.findIndex(t => t.rootUri === thread.rootUri);

    if (existingIndex >= 0) {
      // Update existing thread
      this.context.activeThreads[existingIndex] = {
        ...thread,
        lastInteraction: new Date().toISOString(),
      };
    } else {
      // Add new thread
      this.context.activeThreads.unshift({
        ...thread,
        lastInteraction: new Date().toISOString(),
      });
    }

    // Keep only the most recent items
    if (this.context.activeThreads.length > this.MAX_ITEMS) {
      this.context.activeThreads = this.context.activeThreads.slice(0, this.MAX_ITEMS);
    }
  }

  /**
   * Add a mentioned user to the context
   */
  static addMentionedUser(user: {
    did: string;
    handle: string;
    displayName?: string;
    context: string;
  }): void {
    // Check if user already exists
    const existingIndex = this.context.mentionedUsers.findIndex(u => u.did === user.did);

    if (existingIndex >= 0) {
      // Update existing user
      this.context.mentionedUsers[existingIndex] = {
        ...user,
        mentionedAt: new Date().toISOString(),
      };
    } else {
      // Add new user
      this.context.mentionedUsers.unshift({
        ...user,
        mentionedAt: new Date().toISOString(),
      });
    }

    // Keep only the most recent items
    if (this.context.mentionedUsers.length > this.MAX_ITEMS) {
      this.context.mentionedUsers = this.context.mentionedUsers.slice(0, this.MAX_ITEMS);
    }
  }

  /**
   * Add a search query to the history
   */
  static addSearchQuery(query: string, resultCount: number): void {
    this.context.searchHistory.unshift({
      query,
      timestamp: new Date().toISOString(),
      resultCount,
    });

    // Keep only the most recent items
    if (this.context.searchHistory.length > this.MAX_ITEMS) {
      this.context.searchHistory = this.context.searchHistory.slice(0, this.MAX_ITEMS);
    }
  }

  /**
   * Add a recent action to the context
   */
  static addAction(action: string, target: string, details: Record<string, any> = {}): void {
    this.context.recentActions.unshift({
      action,
      target,
      timestamp: new Date().toISOString(),
      details,
    });

    // Keep only the most recent items
    if (this.context.recentActions.length > this.MAX_ITEMS) {
      this.context.recentActions = this.context.recentActions.slice(0, this.MAX_ITEMS);
    }
  }

  /**
   * Clear all context
   */
  static clearContext(): void {
    this.context = {
      recentlyDiscussedPosts: [],
      activeThreads: [],
      mentionedUsers: [],
      searchHistory: [],
      recentActions: [],
    };
  }

  /**
   * Get the current context
   */
  static getContext(): IConversationContext {
    return this.context;
  }
}
