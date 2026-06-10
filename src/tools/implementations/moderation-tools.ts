/**
 * Content moderation tools for AT Protocol
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';

/**
 * Map a short report-reason key (e.g. 'spam') to its AT Protocol moderation
 * reason NSID (e.g. com.atproto.moderation.defs#reasonSpam). Shared by the
 * content and user report tools.
 */
function toReasonNsid(reasonType: string): string {
  return `com.atproto.moderation.defs#reason${reasonType.charAt(0).toUpperCase()}${reasonType.slice(1)}`;
}

const MuteUserSchema = z.object({
  actor: z
    .string()
    .min(1, 'Actor (DID or handle) is required')
    .describe('Handle (e.g. alice.bsky.social) or DID of the account to mute.'),
});

const UnmuteUserSchema = z.object({
  actor: z
    .string()
    .min(1, 'Actor (DID or handle) is required')
    .describe('Handle (e.g. alice.bsky.social) or DID of the account to unmute.'),
});

const BlockUserSchema = z.object({
  actor: z
    .string()
    .min(1, 'Actor (DID or handle) is required')
    .describe('Handle (e.g. alice.bsky.social) or DID of the account to block.'),
});

const UnblockUserSchema = z.object({
  actor: z
    .string()
    .min(1, 'Actor (DID or handle) is required')
    .describe('Handle (e.g. alice.bsky.social) or DID of the account to unblock.'),
});

const ReportContentSchema = z.object({
  subject: z
    .object({
      uri: z
        .string()
        .min(1, 'Content URI is required')
        .describe('AT-URI of the content to report (at://did/collection/rkey).'),
      cid: z
        .string()
        .min(1, 'Content CID is required')
        .describe('CID (Content Identifier) of the specific version of the record to report.'),
    })
    .describe('Strong reference identifying the specific content record to report.'),
  reasonType: z
    .enum(['spam', 'violation', 'misleading', 'sexual', 'rude', 'other'])
    .describe(
      'Category of the violation: "spam" for unsolicited bulk content, "violation" for ToS breach, "misleading" for misinformation, "sexual" for adult content, "rude" for harassment, "other" for anything else.'
    ),
  reason: z
    .string()
    .max(2000, 'Reason cannot exceed 2000 characters')
    .optional()
    .describe(
      'Optional free-text explanation of the violation (max 2000 characters). Providing detail helps moderators act faster.'
    ),
});

const ReportUserSchema = z.object({
  actor: z
    .string()
    .min(1, 'Actor (DID or handle) is required')
    .describe('Handle (e.g. alice.bsky.social) or DID of the account to report.'),
  reasonType: z
    .enum(['spam', 'violation', 'misleading', 'sexual', 'rude', 'other'])
    .describe(
      'Category of the violation: "spam" for unsolicited bulk content, "violation" for ToS breach, "misleading" for misinformation, "sexual" for adult content, "rude" for harassment, "other" for anything else.'
    ),
  reason: z
    .string()
    .max(2000, 'Reason cannot exceed 2000 characters')
    .optional()
    .describe(
      'Optional free-text explanation of the violation (max 2000 characters). Providing detail helps moderators act faster.'
    ),
});

export class MuteUserTool extends BaseTool {
  public readonly schema = {
    method: 'mute_user',
    description:
      'Mute a user to hide their content from your feeds and notifications without them knowing. The muted account is not notified. Requires authentication (app password). Use mute_user for a soft, private suppression; use block_user when you need to prevent the target from seeing your content or interacting with you. Subject to per-tool rate limiting.',
    params: MuteUserSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the mute operation succeeded.',
        },
        message: {
          type: 'string',
          description: 'Human-readable result message.',
        },
        mutedUser: {
          type: 'object',
          description: 'Details of the muted account.',
          properties: {
            actor: {
              type: 'string',
              description: 'Handle or DID supplied in the request.',
            },
            did: {
              type: 'string',
              description: 'Resolved DID of the muted account, if returned by the API.',
            },
          },
          required: ['actor'],
        },
      },
      required: ['success', 'message', 'mutedUser'],
    },
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
    description:
      'Unmute a previously muted user to restore their content in your feeds. Reverses an earlier mute_user action without notifying the target. Requires authentication (app password). Use this instead of unblock_user when the account was suppressed via mute rather than block. Subject to per-tool rate limiting.',
    params: UnmuteUserSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the unmute operation succeeded.',
        },
        message: {
          type: 'string',
          description: 'Human-readable result message.',
        },
        unmutedUser: {
          type: 'object',
          description: 'Details of the unmuted account.',
          properties: {
            actor: {
              type: 'string',
              description: 'Handle or DID supplied in the request.',
            },
            did: {
              type: 'string',
              description: 'Resolved DID of the unmuted account, if returned by the API.',
            },
          },
          required: ['actor'],
        },
      },
      required: ['success', 'message', 'unmutedUser'],
    },
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
    description:
      'Block a user to prevent them from seeing your content and interacting with you. Creates a block record in your repo; the action cannot be undone without calling unblock_user. Requires authentication (app password). Use block_user for mutual visibility restriction; use mute_user for a private, one-sided feed suppression that does not affect the target. Subject to per-tool rate limiting.',
    params: BlockUserSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the block operation succeeded.',
        },
        message: {
          type: 'string',
          description: 'Human-readable result message.',
        },
        blockedUser: {
          type: 'object',
          description: 'Details of the blocked account.',
          properties: {
            actor: {
              type: 'string',
              description: 'Handle or DID supplied in the request.',
            },
            did: {
              type: 'string',
              description: 'Resolved DID of the blocked account.',
            },
            uri: {
              type: 'string',
              description: 'AT-URI of the newly created block record in your repo.',
            },
          },
          required: ['actor'],
        },
      },
      required: ['success', 'message', 'blockedUser'],
    },
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

      // A block record's subject must be a DID, not a handle.
      const subjectDid = await this.resolveDid(params.actor);

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.app.bsky.graph.block.create(
            { repo: agent.session?.did || '' },
            {
              subject: subjectDid,
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
    description:
      'Unblock a previously blocked user to restore normal interactions. Deletes the block record from your repo; if the user was not blocked, the operation returns success=false without error. Requires authentication (app password). Use this instead of unmute_user when the account was restricted via block rather than mute. Subject to per-tool rate limiting.',
    params: UnblockUserSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'True if the block was removed; false if the account was not blocked.',
        },
        message: {
          type: 'string',
          description: 'Human-readable result message.',
        },
        unblockedUser: {
          type: 'object',
          description: 'Details of the targeted account.',
          properties: {
            actor: {
              type: 'string',
              description: 'Handle or DID supplied in the request.',
            },
          },
          required: ['actor'],
        },
      },
      required: ['success', 'message', 'unblockedUser'],
    },
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

      // getProfile returns viewer.blocking — the AT-URI of the block record —
      // in a single call when the authenticated user is blocking the subject.
      // This is O(1) and (unlike paging getBlocks) has no upper bound on how
      // many accounts the user blocks.
      const agent = this.atpClient.getAgent();
      const resolvedDid = await this.resolveDid(params.actor);

      const profileResponse = await this.executeAtpOperation(
        async () => agent.getProfile({ actor: resolvedDid }),
        'getProfile',
        { actor: params.actor }
      );
      const blockUri = profileResponse.data.viewer?.blocking;

      if (!blockUri) {
        return {
          success: false,
          message: `User ${params.actor} is not currently blocked.`,
          unblockedUser: {
            actor: params.actor,
          },
        };
      }

      const rkey = blockUri.split('/').pop();
      if (!rkey) {
        return {
          success: false,
          message: `Could not determine the block record for ${params.actor}.`,
          unblockedUser: {
            actor: params.actor,
          },
        };
      }

      // The block record lives in the authenticated user's repo.
      await this.executeAtpOperation(
        async () =>
          await agent.app.bsky.graph.block.delete({
            repo: agent.session?.did ?? resolvedDid,
            rkey,
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
    description:
      'Report content that violates community guidelines or terms of service. Submits a moderation report to the network; moderators review it asynchronously and the report cannot be withdrawn once submitted. Requires authentication (app password). Use report_content when you have the AT-URI and CID of the specific post or record; use report_user when reporting an entire account rather than a single piece of content. Subject to per-tool rate limiting.',
    params: ReportContentSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the report was submitted successfully.',
        },
        message: {
          type: 'string',
          description: 'Human-readable result message.',
        },
        reportId: {
          type: 'string',
          description: 'Numeric identifier of the newly created moderation report (as a string).',
        },
        reportDetails: {
          type: 'object',
          description: 'Echo of the submitted report parameters.',
          properties: {
            subject: {
              type: 'string',
              description: 'AT-URI of the reported content.',
            },
            reasonType: {
              type: 'string',
              description: 'The short reason category supplied in the request.',
            },
            reason: {
              type: 'string',
              description: 'Optional free-text explanation supplied in the request.',
            },
          },
          required: ['subject', 'reasonType'],
        },
      },
      required: ['success', 'message', 'reportId', 'reportDetails'],
    },
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
            reasonType: toReasonNsid(params.reasonType),
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
    description:
      'Report a user account that violates community guidelines or terms of service. Submits a moderation report targeting the entire account; moderators review it asynchronously and the report cannot be withdrawn once submitted. Requires authentication (app password). Use report_user to flag an account; use report_content when the violation is limited to a specific post or record identified by AT-URI and CID. Subject to per-tool rate limiting.',
    params: ReportUserSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the report was submitted successfully.',
        },
        message: {
          type: 'string',
          description: 'Human-readable result message.',
        },
        reportId: {
          type: 'string',
          description: 'Numeric identifier of the newly created moderation report (as a string).',
        },
        reportDetails: {
          type: 'object',
          description: 'Echo of the submitted report parameters.',
          properties: {
            actor: {
              type: 'string',
              description: 'Handle or DID of the reported account.',
            },
            reasonType: {
              type: 'string',
              description: 'The short reason category supplied in the request.',
            },
            reason: {
              type: 'string',
              description: 'Optional free-text explanation supplied in the request.',
            },
          },
          required: ['actor', 'reasonType'],
        },
      },
      required: ['success', 'message', 'reportId', 'reportDetails'],
    },
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

      // A repoRef moderation subject must be a DID, not a handle.
      const subjectDid = await this.resolveDid(params.actor);

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.com.atproto.moderation.createReport({
            reasonType: toReasonNsid(params.reasonType),
            reason: params.reason,
            subject: {
              $type: 'com.atproto.admin.defs#repoRef',
              did: subjectDid,
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

/**
 * Zod schema for analyze moderation status parameters
 */
const AnalyzeModerationStatusSchema = z.object({
  subject: z
    .string()
    .min(1, 'Subject (DID or AT-URI) is required')
    .describe(
      'DID of a user account (e.g. did:plc:abc123) or AT-URI of a post (at://did/app.bsky.feed.post/rkey) to analyze.'
    ),
  includeLabels: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'Whether to fetch and include content labels in the response (default true). Set to false to skip label fetching for a faster call.'
    ),
});

/**
 * Analyze Moderation Status Tool - Check moderation status of posts and users
 *
 * This tool analyzes the moderation status of content including:
 * - Content labels (NSFW, violence, spam, etc.)
 * - Moderation decisions
 * - User blocks and mutes
 *
 * AUTHENTICATION REQUIREMENT:
 * - Enhanced mode (works better with authentication)
 * - Public labels available without auth
 * - Personal moderation state requires auth
 */
export class AnalyzeModerationStatusTool extends BaseTool {
  public readonly schema = {
    method: 'analyze_moderation_status',
    description:
      'Analyze moderation status of a post or user. Returns content labels, moderation decisions, and personal moderation state (blocks, mutes). Subject can be a DID (for users) or AT-URI (for posts). Works without authentication; richer with auth. Use this tool to evaluate safety before rendering content; use block_user or mute_user to act on the results. Subject to per-tool rate limiting.',
    params: AnalyzeModerationStatusSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the analysis completed successfully.',
        },
        subject: {
          type: 'string',
          description: 'The DID or AT-URI that was analyzed.',
        },
        subjectType: {
          type: 'string',
          enum: ['user', 'post'],
          description: '"user" when subject is a DID; "post" when subject is an AT-URI.',
        },
        moderation: {
          type: 'object',
          description: 'Raw moderation state for the subject.',
          properties: {
            labels: {
              type: 'array',
              description:
                'Content labels attached to the subject (present when includeLabels=true and labels exist).',
              items: {
                type: 'object',
                properties: {
                  src: {
                    type: 'string',
                    description: 'DID of the labeler that issued this label.',
                  },
                  uri: { type: 'string', description: 'AT-URI of the labeled record.' },
                  val: { type: 'string', description: 'Label value (e.g. "nsfw", "spam").' },
                  cts: {
                    type: 'string',
                    description: 'ISO-8601 timestamp when the label was created.',
                  },
                },
                required: ['src', 'uri', 'val', 'cts'],
              },
            },
            blocked: {
              type: 'boolean',
              description: 'True if you are blocking this account (user subjects only).',
            },
            muted: {
              type: 'boolean',
              description: 'True if you have muted this account (user subjects only).',
            },
            blockedBy: {
              type: 'boolean',
              description: 'True if this account is blocking you (user subjects only).',
            },
            blocking: {
              type: 'string',
              description: 'AT-URI of your block record for this account, if any.',
            },
            mutedByList: {
              type: 'object',
              description: 'Moderation list that caused the mute, if applicable.',
              properties: {
                uri: { type: 'string', description: 'AT-URI of the list.' },
                name: { type: 'string', description: 'Display name of the list.' },
              },
              required: ['uri'],
            },
            blockingByList: {
              type: 'object',
              description: 'Moderation list that caused the block, if applicable.',
              properties: {
                uri: { type: 'string', description: 'AT-URI of the list.' },
                name: { type: 'string', description: 'Display name of the list.' },
              },
              required: ['uri'],
            },
          },
        },
        analysis: {
          type: 'object',
          description: 'Derived safety analysis based on labels and moderation state.',
          properties: {
            hasContentWarnings: {
              type: 'boolean',
              description: 'True if any content warnings were detected.',
            },
            isNSFW: { type: 'boolean', description: 'True if NSFW-related labels were found.' },
            isSpam: { type: 'boolean', description: 'True if spam labels were found.' },
            requiresWarning: {
              type: 'boolean',
              description: 'True if a warning should be shown before displaying content.',
            },
            safetyLevel: {
              type: 'string',
              enum: ['safe', 'warning', 'restricted', 'blocked'],
              description:
                '"safe" = no issues; "warning" = minor labels or muted; "restricted" = spam/hate; "blocked" = mutual or list block.',
            },
          },
          required: ['hasContentWarnings', 'isNSFW', 'isSpam', 'requiresWarning', 'safetyLevel'],
        },
      },
      required: ['success', 'subject', 'subjectType', 'moderation', 'analysis'],
    },
  };

  constructor(atpClient: AtpClient) {
    // Public content labels are readable without auth; personal moderation state
    // (blocks/mutes) is added when authenticated. Hence ENHANCED, not PRIVATE.
    super(atpClient, 'AnalyzeModerationStatus', ToolAuthMode.ENHANCED);
  }

  protected async execute(params: { subject: string; includeLabels?: boolean }): Promise<{
    success: boolean;
    subject: string;
    subjectType: 'user' | 'post';
    moderation: {
      labels?: Array<{
        src: string;
        uri: string;
        val: string;
        cts: string;
      }>;
      blocked?: boolean;
      muted?: boolean;
      blockedBy?: boolean;
      // `blocking` is the AT-URI of your block record (a string), not a boolean.
      blocking?: string;
      // mutedByList/blockingByList are list-view objects from ViewerState, not
      // booleans. AT Protocol's ViewerState has no `blockedByList` field.
      mutedByList?: { uri: string; name?: string };
      blockingByList?: { uri: string; name?: string };
    };
    analysis: {
      hasContentWarnings: boolean;
      isNSFW: boolean;
      isSpam: boolean;
      requiresWarning: boolean;
      safetyLevel: 'safe' | 'warning' | 'restricted' | 'blocked';
    };
  }> {
    try {
      this.logger.info('Analyzing moderation status', {
        subject: params.subject,
        includeLabels: params.includeLabels,
      });

      const subjectType = params.subject.startsWith('at://') ? 'post' : 'user';

      let moderation: any = {};
      let labels: any[] = [];

      if (subjectType === 'user') {
        // Get user profile which includes moderation info
        const profileResponse = await this.executeAtpOperation(
          async () => {
            const agent = this.atpClient.getAgent();
            return await agent.getProfile({ actor: params.subject });
          },
          'getProfile',
          { actor: params.subject }
        );

        const profile = profileResponse.data;

        moderation = {
          // `blocking` is the AT-URI of your block record (you block them);
          // `blockedBy` (bool) means they block you; `blockingByList` is a
          // list-based block you apply. AT Protocol's ViewerState has no
          // `blockedByList`, so we do not invent one.
          blocked: !!profile.viewer?.blocking,
          muted: profile.viewer?.muted,
          blockedBy: profile.viewer?.blockedBy,
          blocking: profile.viewer?.blocking,
          mutedByList: profile.viewer?.mutedByList,
          blockingByList: profile.viewer?.blockingByList,
        };

        if (params.includeLabels && profile.labels) {
          labels = profile.labels;
        }
      } else {
        // Get post thread which includes moderation info
        const threadResponse = await this.executeAtpOperation(
          async () => {
            const agent = this.atpClient.getAgent();
            return await agent.getPostThread({ uri: params.subject });
          },
          'getPostThread',
          { uri: params.subject }
        );

        const threadData = threadResponse.data.thread as any;

        if (!threadData.post) {
          throw new Error('Post not found or blocked');
        }

        const post = threadData.post;

        moderation = {
          blocked: post.author?.viewer?.blocking,
          muted: post.author?.viewer?.muted,
          blockedBy: post.author?.viewer?.blockedBy,
        };

        if (params.includeLabels && post.labels) {
          labels = post.labels;
        }
      }

      // Analyze the labels to determine safety level
      const analysis = this.analyzeSafetyLevel(labels, moderation);

      if (params.includeLabels && labels.length > 0) {
        moderation.labels = labels;
      }

      this.logger.info('Moderation analysis completed', {
        subject: params.subject,
        subjectType,
        safetyLevel: analysis.safetyLevel,
        labelsCount: labels.length,
      });

      return {
        success: true,
        subject: params.subject,
        subjectType,
        moderation,
        analysis,
      };
    } catch (error) {
      this.logger.error('Failed to analyze moderation status', error);
      this.formatError(error);
    }
  }

  /**
   * Analyze safety level based on labels and moderation state
   */
  private analyzeSafetyLevel(
    labels: any[],
    moderation: any
  ): {
    hasContentWarnings: boolean;
    isNSFW: boolean;
    isSpam: boolean;
    requiresWarning: boolean;
    safetyLevel: 'safe' | 'warning' | 'restricted' | 'blocked';
  } {
    let hasContentWarnings = false;
    let isNSFW = false;
    let isSpam = false;
    let safetyLevel: 'safe' | 'warning' | 'restricted' | 'blocked' = 'safe';

    // Check if blocked (you block them directly or via a list, or they block you)
    if (moderation.blocked || moderation.blockedBy || moderation.blockingByList) {
      safetyLevel = 'blocked';
      return { hasContentWarnings: true, isNSFW, isSpam, requiresWarning: true, safetyLevel };
    }

    // Analyze labels
    for (const label of labels) {
      const val = label.val?.toLowerCase() || '';

      // NSFW content
      if (val.includes('nsfw') || val.includes('porn') || val.includes('sexual')) {
        isNSFW = true;
        hasContentWarnings = true;
        if (safetyLevel === 'safe') safetyLevel = 'warning';
      }

      // Spam
      if (val.includes('spam')) {
        isSpam = true;
        hasContentWarnings = true;
        safetyLevel = 'restricted';
      }

      // Violence or graphic content
      if (val.includes('violence') || val.includes('gore') || val.includes('graphic')) {
        hasContentWarnings = true;
        if (safetyLevel === 'safe') safetyLevel = 'warning';
      }

      // Hate speech or harassment
      if (val.includes('hate') || val.includes('harassment') || val.includes('threat')) {
        hasContentWarnings = true;
        safetyLevel = 'restricted';
      }
    }

    // Check if muted
    if (moderation.muted || moderation.mutedByList) {
      if (safetyLevel === 'safe') safetyLevel = 'warning';
    }

    const requiresWarning = hasContentWarnings || safetyLevel !== 'safe';

    return {
      hasContentWarnings,
      isNSFW,
      isSpam,
      requiresWarning,
      safetyLevel,
    };
  }
}
