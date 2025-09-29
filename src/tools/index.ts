/**
 * MCP Tools for AT Protocol operations
 *
 * Comprehensive tools that enable LLMs to interact directly with the AT Protocol ecosystem
 */

import type { z } from 'zod';
import type { AtpClient } from '../utils/atp-client.js';
import { Logger } from '../utils/logger.js';
import {
  AddToListTool,
  BlockUserTool,
  CreateListTool,
  CreatePostTool,
  CreateRichTextPostTool,
  DeletePostTool,
  FollowUserTool,
  GenerateLinkPreviewTool,
  GetCustomFeedTool,
  GetFollowersTool,
  GetFollowsTool,
  GetListTool,
  GetNotificationsTool,
  GetRecentEventsTool,
  GetStreamingStatusTool,
  GetThreadTool,
  GetTimelineTool,
  GetUserProfileTool,
  HandleOAuthCallbackTool,
  LikePostTool,
  MuteUserTool,
  RefreshOAuthTokensTool,
  RemoveFromListTool,
  ReplyToPostTool,
  ReportContentTool,
  ReportUserTool,
  RepostTool,
  RevokeOAuthTokensTool,
  SearchPostsTool,
  StartOAuthFlowTool,
  StartStreamingTool,
  StopStreamingTool,
  UnblockUserTool,
  UnfollowUserTool,
  UnlikePostTool,
  UnmuteUserTool,
  UnrepostTool,
  UpdateProfileTool,
  UploadImageTool,
  UploadVideoTool,
} from './implementations/index.js';

/**
 * Tool interface for MCP tools
 */
export interface IMcpTool {
  schema: {
    method: string;
    description: string;
    params?: z.ZodSchema;
  };
  handler: (params: any) => Promise<any>;
}

/**
 * Create all MCP tools for AT Protocol operations
 */
export function createTools(atpClient: AtpClient): IMcpTool[] {
  const logger = new Logger('ToolsFactory');

  try {
    const tools = [
      // Core social operations
      new CreatePostTool(atpClient),
      new ReplyToPostTool(atpClient),
      new LikePostTool(atpClient),
      new UnlikePostTool(atpClient),
      new RepostTool(atpClient),
      new UnrepostTool(atpClient),

      // User operations
      new FollowUserTool(atpClient),
      new UnfollowUserTool(atpClient),
      new GetUserProfileTool(atpClient),

      // Data retrieval
      new SearchPostsTool(atpClient),
      new GetTimelineTool(atpClient),
      new GetFollowersTool(atpClient),
      new GetFollowsTool(atpClient),
      new GetNotificationsTool(atpClient),

      // Content management
      new DeletePostTool(atpClient),
      new UpdateProfileTool(atpClient),

      // OAuth authentication
      new StartOAuthFlowTool(atpClient),
      new HandleOAuthCallbackTool(atpClient),
      new RefreshOAuthTokensTool(atpClient),
      new RevokeOAuthTokensTool(atpClient),

      // Content moderation
      new MuteUserTool(atpClient),
      new UnmuteUserTool(atpClient),
      new BlockUserTool(atpClient),
      new UnblockUserTool(atpClient),
      new ReportContentTool(atpClient),
      new ReportUserTool(atpClient),

      // Real-time streaming
      new StartStreamingTool(atpClient),
      new StopStreamingTool(atpClient),
      new GetStreamingStatusTool(atpClient),
      new GetRecentEventsTool(atpClient),

      // Advanced social features
      new CreateListTool(atpClient),
      new AddToListTool(atpClient),
      new RemoveFromListTool(atpClient),
      new GetListTool(atpClient),
      new GetThreadTool(atpClient),
      new GetCustomFeedTool(atpClient),

      // Enhanced media support
      new UploadImageTool(atpClient),
      new UploadVideoTool(atpClient),
      new CreateRichTextPostTool(atpClient),
      new GenerateLinkPreviewTool(atpClient),
    ];

    logger.info(`Created ${tools.length} AT Protocol MCP tools`);
    return tools;
  } catch (error) {
    logger.error('Failed to create MCP tools', error);
    return [];
  }
}


