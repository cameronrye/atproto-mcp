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
  AnalyzeAccountTool,
  AnalyzeImageTool,
  AnalyzeModerationStatusTool,
  BatchActionTool,
  BlockUserTool,
  CreateListTool,
  CreatePostTool,
  CreateThreadTool,
  DeletePostTool,
  DiscoverCommunitiesTool,
  DiscoverTool,
  FindInfluentialUsersTool,
  FindSimilarUsersTool,
  FollowUserTool,
  GenerateLinkPreviewTool,
  GetAuthorFeedTool,
  GetCustomFeedTool,
  GetListTool,
  GetNotificationsTool,
  GetPostContextTool,
  GetTimelineTool,
  GetUserConnectionsTool,
  GetUserProfileTool,
  GetUserSummaryTool,
  LikePostTool,
  MarkNotificationsSeenTool,
  MuteUserTool,
  RemoveFromListTool,
  ReplyToPostTool,
  ReportContentTool,
  ReportUserTool,
  RepostTool,
  SearchActorsTool,
  SearchPostsTool,
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
    annotations?: IToolAnnotations;
    // Optional JSON Schema describing the tool's result, advertised in tools/list.
    // Purely descriptive: the server builds tools/call responses manually (it does
    // not use the SDK's high-level registerTool), so this does NOT trigger any SDK
    // structuredContent validation.
    outputSchema?: Record<string, unknown>;
  };
  handler: (params: any) => Promise<any>;
}

/**
 * MCP tool annotations (advisory hints, per the MCP spec). Clients MUST NOT trust
 * these for security, but use them to gate auto-approval and confirmation UI.
 */
export interface IToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

/**
 * Create all MCP tools for AT Protocol operations
 */
export function createTools(atpClient: AtpClient): IMcpTool[] {
  const logger = new Logger('ToolsFactory');

  const toolFactories: Array<() => IMcpTool> = [
    // Core social operations
    () => new CreatePostTool(atpClient),
    () => new CreateThreadTool(atpClient),
    () => new ReplyToPostTool(atpClient),
    () => new LikePostTool(atpClient),
    () => new UnlikePostTool(atpClient),
    () => new RepostTool(atpClient),
    () => new UnrepostTool(atpClient),

    // User operations
    () => new FollowUserTool(atpClient),
    () => new UnfollowUserTool(atpClient),
    () => new GetUserProfileTool(atpClient),

    // Data retrieval
    () => new SearchPostsTool(atpClient),
    () => new SearchActorsTool(atpClient),
    () => new GetAuthorFeedTool(atpClient),
    () => new GetTimelineTool(atpClient),
    () => new GetUserConnectionsTool(atpClient),
    () => new GetNotificationsTool(atpClient),
    () => new MarkNotificationsSeenTool(atpClient),

    // Content management
    () => new DeletePostTool(atpClient),
    () => new UpdateProfileTool(atpClient),

    // Content moderation
    () => new MuteUserTool(atpClient),
    () => new UnmuteUserTool(atpClient),
    () => new BlockUserTool(atpClient),
    () => new UnblockUserTool(atpClient),
    () => new ReportContentTool(atpClient),
    () => new ReportUserTool(atpClient),
    () => new AnalyzeModerationStatusTool(atpClient),

    // Advanced social features
    () => new CreateListTool(atpClient),
    () => new AddToListTool(atpClient),
    () => new RemoveFromListTool(atpClient),
    () => new GetListTool(atpClient),
    () => new GetCustomFeedTool(atpClient),

    // Enhanced media support
    () => new UploadImageTool(atpClient),
    () => new UploadVideoTool(atpClient),
    () => new GenerateLinkPreviewTool(atpClient),

    // Analytics and insights
    () => new AnalyzeAccountTool(atpClient),
    () => new FindInfluentialUsersTool(atpClient),

    // Content discovery
    () => new DiscoverTool(atpClient),
    () => new FindSimilarUsersTool(atpClient),
    () => new DiscoverCommunitiesTool(atpClient),

    // Batch operations
    () => new BatchActionTool(atpClient),

    // Composite operations
    () => new GetUserSummaryTool(atpClient),
    () => new GetPostContextTool(atpClient),

    // Rich media
    () => new AnalyzeImageTool(atpClient),
  ];

  // Construct each tool defensively: a single failing constructor must not wipe
  // out the entire toolset (the previous single try/catch returned []). Skip and
  // log any tool that throws so the rest remain available.
  const tools: IMcpTool[] = [];
  for (const make of toolFactories) {
    try {
      tools.push(make());
    } catch (error) {
      logger.error('Failed to construct an MCP tool; skipping it', error);
    }
  }

  logger.info(`Created ${tools.length} AT Protocol MCP tools`);
  return tools;
}
