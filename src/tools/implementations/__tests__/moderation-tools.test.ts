/**
 * Tests for Moderation Tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MuteUserTool,
  UnmuteUserTool,
  BlockUserTool,
  UnblockUserTool,
  ReportContentTool,
  ReportUserTool,
} from '../moderation-tools.js';
import { AtpClient } from '../../../utils/atp-client.js';
import { ValidationError } from '../../../types/index.js';

// Mock AtpClient
vi.mock('../../../utils/atp-client.js');

describe('MuteUserTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: MuteUserTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      mute: vi.fn(),
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    tool = new MuteUserTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('mute_user');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Mute');
    });

    it('should require authentication', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      expect(tool.isAvailable()).toBe(false);
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty actor', async () => {
      await expect(tool.handler({ actor: '' })).rejects.toThrow(ValidationError);
    });

    it('should validate actor format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      await expect(tool.handler({ actor: 'invalid' })).rejects.toThrow();
    });
  });

  describe('Mute User', () => {
    it('should mute a user successfully', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.mute.mockResolvedValue({
        data: { did: 'did:plc:user123' },
      });

      const result = await tool.handler({ actor: 'user.bsky.social' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('muted');
      expect(result.mutedUser.actor).toBe('user.bsky.social');
      expect(result.mutedUser.did).toBe('did:plc:user123');
      expect(mockAgent.mute).toHaveBeenCalledWith('user.bsky.social');
    });

    it('should handle mute failure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.mute.mockRejectedValue(new Error('Failed to mute'));

      await expect(tool.handler({ actor: 'user.bsky.social' })).rejects.toThrow();
    });
  });
});

describe('UnmuteUserTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: UnmuteUserTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      unmute: vi.fn(),
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    tool = new UnmuteUserTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('unmute_user');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Unmute');
    });
  });

  describe('Unmute User', () => {
    it('should unmute a user successfully', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.unmute.mockResolvedValue({
        data: { did: 'did:plc:user123' },
      });

      const result = await tool.handler({ actor: 'user.bsky.social' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('unmuted');
      expect(result.unmutedUser.actor).toBe('user.bsky.social');
      expect(mockAgent.unmute).toHaveBeenCalledWith('user.bsky.social');
    });
  });
});

describe('BlockUserTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: BlockUserTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      app: {
        bsky: {
          graph: {
            block: {
              create: vi.fn(),
            },
          },
        },
      },
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    tool = new BlockUserTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('block_user');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Block');
    });
  });

  describe('Block User', () => {
    it('should block a user successfully', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.graph.block.create.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.graph.block/abc123',
        did: 'did:plc:user123',
      });

      const result = await tool.handler({ actor: 'user.bsky.social' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('blocked');
      expect(result.blockedUser.actor).toBe('user.bsky.social');
      expect(result.blockedUser.uri).toBe('at://did:plc:test123/app.bsky.graph.block/abc123');
    });

    it('should create block record with correct structure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.graph.block.create.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.graph.block/abc123',
      });

      await tool.handler({ actor: 'user.bsky.social' });

      expect(mockAgent.app.bsky.graph.block.create).toHaveBeenCalledWith(
        { repo: 'did:plc:test123' },
        expect.objectContaining({
          subject: 'user.bsky.social',
          createdAt: expect.any(String),
        })
      );
    });
  });
});

describe('UnblockUserTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: UnblockUserTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      app: {
        bsky: {
          graph: {
            getBlocks: vi.fn(),
            block: {
              delete: vi.fn(),
            },
          },
        },
      },
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    tool = new UnblockUserTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('unblock_user');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Unblock');
    });
  });

  describe('Unblock User', () => {
    it('should unblock a user successfully', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.graph.getBlocks.mockResolvedValue({
        data: {
          blocks: [
            {
              subject: { did: 'did:plc:user123', handle: 'user.bsky.social' },
              uri: 'at://did:plc:test123/app.bsky.graph.block/abc123',
            },
          ],
        },
      });

      mockAgent.app.bsky.graph.block.delete.mockResolvedValue({});

      const result = await tool.handler({ actor: 'user.bsky.social' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('unblocked');
      expect(result.unblockedUser.actor).toBe('user.bsky.social');
    });

    it('should handle user not blocked', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.graph.getBlocks.mockResolvedValue({
        data: { blocks: [] },
      });

      const result = await tool.handler({ actor: 'user.bsky.social' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not currently blocked');
    });
  });
});

describe('ReportContentTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: ReportContentTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      com: {
        atproto: {
          moderation: {
            createReport: vi.fn(),
          },
        },
      },
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    tool = new ReportContentTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('report_content');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Report');
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty URI', async () => {
      await expect(
        tool.handler({
          subject: { uri: '', cid: 'bafytest' },
          reasonType: 'spam',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject empty CID', async () => {
      await expect(
        tool.handler({
          subject: { uri: 'at://did:plc:user123/app.bsky.feed.post/abc123', cid: '' },
          reasonType: 'spam',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject invalid reason type', async () => {
      await expect(
        tool.handler({
          subject: { uri: 'at://did:plc:user123/app.bsky.feed.post/abc123', cid: 'bafytest' },
          reasonType: 'invalid' as any,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject reason over 2000 characters', async () => {
      const longReason = 'a'.repeat(2001);
      await expect(
        tool.handler({
          subject: { uri: 'at://did:plc:user123/app.bsky.feed.post/abc123', cid: 'bafytest' },
          reasonType: 'spam',
          reason: longReason,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Report Content', () => {
    it('should report content successfully', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.moderation.createReport.mockResolvedValue({
        data: {
          id: 'report123',
          reasonType: 'spam',
          createdAt: '2024-01-01T00:00:00Z',
        },
      });

      const result = await tool.handler({
        subject: { uri: 'at://did:plc:user123/app.bsky.feed.post/abc123', cid: 'bafytest' },
        reasonType: 'spam',
        reason: 'This is spam content',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('reported');
      expect(result.reportId).toBe('report123');
      expect(result.reportDetails.reasonType).toBe('spam');
    });

    it('should accept all valid reason types', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.moderation.createReport.mockResolvedValue({
        data: { id: 'report123' },
      });

      const reasonTypes = ['spam', 'violation', 'misleading', 'sexual', 'rude', 'other'];

      for (const reasonType of reasonTypes) {
        const result = await tool.handler({
          subject: { uri: 'at://did:plc:user123/app.bsky.feed.post/abc123', cid: 'bafytest' },
          reasonType: reasonType as any,
        });

        expect(result.success).toBe(true);
      }
    });
  });
});

describe('ReportUserTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: ReportUserTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      com: {
        atproto: {
          moderation: {
            createReport: vi.fn(),
          },
        },
      },
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    tool = new ReportUserTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('report_user');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Report');
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty actor', async () => {
      await expect(
        tool.handler({
          actor: '',
          reasonType: 'spam',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should validate actor format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      await expect(
        tool.handler({
          actor: 'invalid',
          reasonType: 'spam',
        })
      ).rejects.toThrow();
    });
  });

  describe('Report User', () => {
    it('should report user successfully', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.com.atproto.moderation.createReport.mockResolvedValue({
        data: {
          id: 'report123',
          reasonType: 'spam',
          createdAt: '2024-01-01T00:00:00Z',
        },
      });

      const result = await tool.handler({
        actor: 'user.bsky.social',
        reasonType: 'spam',
        reason: 'This user is spamming',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('reported');
      expect(result.reportId).toBe('report123');
      expect(result.reportDetails.actor).toBe('user.bsky.social');
    });
  });
});
