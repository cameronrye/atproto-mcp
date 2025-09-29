/**
 * Content moderation tools for AT Protocol
 */

import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';

const MuteUserSchema = z.object({
  actor: z.string().min(1, 'Actor (DID or handle) is required'),
});

const UnmuteUserSchema = z.object({
  actor: z.string().min(1, 'Actor (DID or handle) is required'),
});

const BlockUserSchema = z.object({
  actor: z.string().min(1, 'Actor (DID or handle) is required'),
});

const UnblockUserSchema = z.object({
  actor: z.string().min(1, 'Actor (DID or handle) is required'),
});

const ReportContentSchema = z.object({
  subject: z.object({
    uri: z.string().min(1, 'Content URI is required'),
    cid: z.string().min(1, 'Content CID is required'),
  }),
  reasonType: z.enum(['spam', 'violation', 'misleading', 'sexual', 'rude', 'other']),
  reason: z.string().max(2000, 'Reason cannot exceed 2000 characters').optional(),
});

const ReportUserSchema = z.object({
  actor: z.string().min(1, 'Actor (DID or handle) is required'),
  reasonType: z.enum(['spam', 'violation', 'misleading', 'sexual', 'rude', 'other']),
  reason: z.string().max(2000, 'Reason cannot exceed 2000 characters').optional(),
});

export class MuteUserTool extends BaseTool {
  public readonly schema = {
    method: 'mute_user',
    description:
      'Mute a user to hide their content from your feeds and notifications without them knowing.',
    params: MuteUserSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'MuteUser');
  }

  protected async execute(params: { actor: string }): Promise<{
    success: boolean;
    message: string;
    mutedUser: {
      actor: string;
      did?: string;
    };
  }> {
    try {
      this.logger.info('Muting user', { actor: params.actor });

      this.validateActor(params.actor);

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.mute(params.actor);
        },
        'muteUser',
        { actor: params.actor }
      );

      this.logger.info('User muted successfully', { actor: params.actor });

      return {
        success: true,
        message: `User ${params.actor} has been muted. Their content will no longer appear in your feeds.`,
        mutedUser: {
          actor: params.actor,
          did: (response as any)?.data?.did,
        },
      };
    } catch (error) {
      this.logger.error('Failed to mute user', error);
      this.formatError(error);
    }
  }
}

export class UnmuteUserTool extends BaseTool {
  public readonly schema = {
    method: 'unmute_user',
    description: 'Unmute a previously muted user to restore their content in your feeds.',
    params: UnmuteUserSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'UnmuteUser');
  }

  protected async execute(params: { actor: string }): Promise<{
    success: boolean;
    message: string;
    unmutedUser: {
      actor: string;
      did?: string;
    };
  }> {
    try {
      this.logger.info('Unmuting user', { actor: params.actor });

      this.validateActor(params.actor);

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.unmute(params.actor);
        },
        'unmuteUser',
        { actor: params.actor }
      );

      this.logger.info('User unmuted successfully', { actor: params.actor });

      return {
        success: true,
        message: `User ${params.actor} has been unmuted. Their content will now appear in your feeds.`,
        unmutedUser: {
          actor: params.actor,
          did: (response as any)?.data?.did,
        },
      };
    } catch (error) {
      this.logger.error('Failed to unmute user', error);
      this.formatError(error);
    }
  }
}

export class BlockUserTool extends BaseTool {
  public readonly schema = {
    method: 'block_user',
    description: 'Block a user to prevent them from seeing your content and interacting with you.',
    params: BlockUserSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'BlockUser');
  }

  protected async execute(params: { actor: string }): Promise<{
    success: boolean;
    message: string;
    blockedUser: {
      actor: string;
      did?: string;
      uri?: string;
    };
  }> {
    try {
      this.logger.info('Blocking user', { actor: params.actor });

      this.validateActor(params.actor);

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.app.bsky.graph.block.create(
            { repo: agent.session?.did || '' },
            {
              subject: params.actor,
              createdAt: new Date().toISOString(),
            }
          );
        },
        'blockUser',
        { actor: params.actor }
      );

      this.logger.info('User blocked successfully', {
        actor: params.actor,
        uri: response.uri,
      });

      return {
        success: true,
        message: `User ${params.actor} has been blocked. They cannot see your content or interact with you.`,
        blockedUser: {
          actor: params.actor,
          did: (response as any)?.did,
          uri: response.uri,
        },
      };
    } catch (error) {
      this.logger.error('Failed to block user', error);
      this.formatError(error);
    }
  }
}

export class UnblockUserTool extends BaseTool {
  public readonly schema = {
    method: 'unblock_user',
    description: 'Unblock a previously blocked user to restore normal interactions.',
    params: UnblockUserSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'UnblockUser');
  }

  protected async execute(params: { actor: string }): Promise<{
    success: boolean;
    message: string;
    unblockedUser: {
      actor: string;
    };
  }> {
    try {
      this.logger.info('Unblocking user', { actor: params.actor });

      this.validateActor(params.actor);

      // First, find the block record
      const agent = this.atpClient.getAgent();
      const blocksResponse = await this.executeAtpOperation(
        async () =>
          await agent.app.bsky.graph.getBlocks({
            limit: 100,
          }),
        'getBlocks',
        { actor: params.actor }
      );

      const blockRecord = blocksResponse.data.blocks.find(
        (block: any) =>
          block.subject?.did === params.actor || block.subject?.handle === params.actor
      ) as any;

      if (!blockRecord) {
        return {
          success: false,
          message: `User ${params.actor} is not currently blocked.`,
          unblockedUser: {
            actor: params.actor,
          },
        };
      }

      // Delete the block record
      await this.executeAtpOperation(
        async () =>
          await agent.app.bsky.graph.block.delete({
            repo: agent.session?.did || '',
            rkey: blockRecord?.uri?.split('/').pop() || blockRecord?.rkey || '',
          }),
        'unblockUser',
        { actor: params.actor }
      );

      this.logger.info('User unblocked successfully', { actor: params.actor });

      return {
        success: true,
        message: `User ${params.actor} has been unblocked. Normal interactions are now restored.`,
        unblockedUser: {
          actor: params.actor,
        },
      };
    } catch (error) {
      this.logger.error('Failed to unblock user', error);
      this.formatError(error);
    }
  }
}

export class ReportContentTool extends BaseTool {
  public readonly schema = {
    method: 'report_content',
    description: 'Report content that violates community guidelines or terms of service.',
    params: ReportContentSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'ReportContent');
  }

  protected async execute(params: {
    subject: { uri: string; cid: string };
    reasonType: string;
    reason?: string;
  }): Promise<{
    success: boolean;
    message: string;
    reportId: string;
    reportDetails: {
      subject: string;
      reasonType: string;
      reason?: string;
    };
  }> {
    try {
      this.logger.info('Reporting content', {
        uri: params.subject.uri,
        reasonType: params.reasonType,
      });

      this.validateAtUri(params.subject.uri);
      this.validateCid(params.subject.cid);

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.com.atproto.moderation.createReport({
            reasonType: `com.atproto.moderation.defs#reason${params.reasonType.charAt(0).toUpperCase() + params.reasonType.slice(1)}`,
            reason: params.reason,
            subject: {
              $type: 'com.atproto.repo.strongRef',
              uri: params.subject.uri,
              cid: params.subject.cid,
            },
          });
        },
        'reportContent',
        {
          uri: params.subject.uri,
          reasonType: params.reasonType,
        }
      );

      this.logger.info('Content reported successfully', {
        reportId: response.data.id,
        uri: params.subject.uri,
      });

      return {
        success: true,
        message: 'Content has been reported successfully. Moderators will review your report.',
        reportId: response.data.id.toString(),
        reportDetails: {
          subject: params.subject.uri,
          reasonType: params.reasonType,
          reason: params.reason,
        },
      };
    } catch (error) {
      this.logger.error('Failed to report content', error);
      this.formatError(error);
    }
  }
}

export class ReportUserTool extends BaseTool {
  public readonly schema = {
    method: 'report_user',
    description: 'Report a user account that violates community guidelines or terms of service.',
    params: ReportUserSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'ReportUser');
  }

  protected async execute(params: { actor: string; reasonType: string; reason?: string }): Promise<{
    success: boolean;
    message: string;
    reportId: string;
    reportDetails: {
      actor: string;
      reasonType: string;
      reason?: string;
    };
  }> {
    try {
      this.logger.info('Reporting user', {
        actor: params.actor,
        reasonType: params.reasonType,
      });

      this.validateActor(params.actor);

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.com.atproto.moderation.createReport({
            reasonType: `com.atproto.moderation.defs#reason${params.reasonType.charAt(0).toUpperCase() + params.reasonType.slice(1)}`,
            reason: params.reason,
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: params.actor,
            },
          });
        },
        'reportUser',
        {
          actor: params.actor,
          reasonType: params.reasonType,
        }
      );

      this.logger.info('User reported successfully', {
        reportId: response.data.id,
        actor: params.actor,
      });

      return {
        success: true,
        message: 'User has been reported successfully. Moderators will review your report.',
        reportId: response.data.id.toString(),
        reportDetails: {
          actor: params.actor,
          reasonType: params.reasonType,
          reason: params.reason,
        },
      };
    } catch (error) {
      this.logger.error('Failed to report user', error);
      this.formatError(error);
    }
  }
}
