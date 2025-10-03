/**
 * Tests for Advanced Social Tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CreateListTool,
  AddToListTool,
  RemoveFromListTool,
  GetListTool,
  GetThreadTool,
  GetCustomFeedTool,
} from '../advanced-social-tools.js';
import { AtpClient } from '../../../utils/atp-client.js';
import { ValidationError } from '../../../types/index.js';

// Mock AtpClient
vi.mock('../../../utils/atp-client.js');

describe('CreateListTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: CreateListTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      app: {
        bsky: {
          graph: {
            list: {
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

    tool = new CreateListTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('create_list');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('list');
    });

    it('should require authentication', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      expect(tool.isAvailable()).toBe(false);
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty name', async () => {
      await expect(tool.handler({ name: '' })).rejects.toThrow(ValidationError);
    });

    it('should reject name over 64 characters', async () => {
      const longName = 'a'.repeat(65);
      await expect(tool.handler({ name: longName })).rejects.toThrow(ValidationError);
    });

    it('should accept name at 64 characters', async () => {
      const name = 'a'.repeat(64);

      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.graph.list.create.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.graph.list/abc123',
        cid: 'bafylist123',
      });

      const result = await tool.handler({ name });
      expect(result.success).toBe(true);
    });

    it('should reject description over 300 characters', async () => {
      const longDesc = 'a'.repeat(301);
      await expect(tool.handler({ name: 'Test List', description: longDesc })).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('Create List', () => {
    it('should create a curate list by default', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.graph.list.create.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.graph.list/abc123',
        cid: 'bafylist123',
      });

      const result = await tool.handler({ name: 'My List' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('created successfully');
      expect(result.list.name).toBe('My List');
      expect(result.list.purpose).toBe('curatelist');
      expect(result.list.uri).toBe('at://did:plc:test123/app.bsky.graph.list/abc123');
    });

    it('should create a mod list when specified', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.graph.list.create.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.graph.list/abc123',
        cid: 'bafylist123',
      });

      const result = await tool.handler({ name: 'Mod List', purpose: 'modlist' });

      expect(result.success).toBe(true);
      expect(result.list.purpose).toBe('modlist');
      expect(mockAgent.app.bsky.graph.list.create).toHaveBeenCalledWith(
        { repo: 'did:plc:test123' },
        expect.objectContaining({
          name: 'Mod List',
          purpose: 'app.bsky.graph.defs#modlist',
          createdAt: expect.any(String),
        })
      );
    });

    it('should include description when provided', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.graph.list.create.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.graph.list/abc123',
        cid: 'bafylist123',
      });

      const result = await tool.handler({
        name: 'My List',
        description: 'A test list',
      });

      expect(result.success).toBe(true);
      expect(result.list.description).toBe('A test list');
    });
  });
});

describe('AddToListTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: AddToListTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      app: {
        bsky: {
          graph: {
            listitem: {
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

    tool = new AddToListTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('add_to_list');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Add');
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty list URI', async () => {
      await expect(tool.handler({ listUri: '', actor: 'user.bsky.social' })).rejects.toThrow(
        ValidationError
      );
    });

    it('should reject empty actor', async () => {
      await expect(
        tool.handler({ listUri: 'at://did:plc:test123/app.bsky.graph.list/abc123', actor: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('should validate list URI format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      await expect(
        tool.handler({ listUri: 'invalid-uri', actor: 'user.bsky.social' })
      ).rejects.toThrow();
    });

    it('should validate actor format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      await expect(
        tool.handler({
          listUri: 'at://did:plc:test123/app.bsky.graph.list/abc123',
          actor: 'invalid',
        })
      ).rejects.toThrow();
    });
  });

  describe('Add to List', () => {
    it('should add user to list successfully', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.graph.listitem.create.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.graph.listitem/item123',
      });

      const result = await tool.handler({
        listUri: 'at://did:plc:test123/app.bsky.graph.list/abc123',
        actor: 'user.bsky.social',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('added to list');
      expect(result.listItem.actor).toBe('user.bsky.social');
      expect(result.listItem.listUri).toBe('at://did:plc:test123/app.bsky.graph.list/abc123');
    });

    it('should create list item with correct structure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.graph.listitem.create.mockResolvedValue({
        uri: 'at://did:plc:test123/app.bsky.graph.listitem/item123',
      });

      await tool.handler({
        listUri: 'at://did:plc:test123/app.bsky.graph.list/abc123',
        actor: 'user.bsky.social',
      });

      expect(mockAgent.app.bsky.graph.listitem.create).toHaveBeenCalledWith(
        { repo: 'did:plc:test123' },
        expect.objectContaining({
          subject: 'user.bsky.social',
          list: 'at://did:plc:test123/app.bsky.graph.list/abc123',
          createdAt: expect.any(String),
        })
      );
    });
  });
});

describe('RemoveFromListTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: RemoveFromListTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      app: {
        bsky: {
          graph: {
            getList: vi.fn(),
            listitem: {
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

    tool = new RemoveFromListTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('remove_from_list');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('Remove');
    });
  });

  describe('Remove from List', () => {
    it('should remove user from list successfully', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.graph.getList.mockResolvedValue({
        data: {
          items: [
            {
              uri: 'at://did:plc:test123/app.bsky.graph.listitem/item123',
              subject: { did: 'did:plc:user123', handle: 'user.bsky.social' },
            },
          ],
        },
      });

      mockAgent.app.bsky.graph.listitem.delete.mockResolvedValue({});

      const result = await tool.handler({
        listUri: 'at://did:plc:test123/app.bsky.graph.list/abc123',
        actor: 'user.bsky.social',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('removed from list');
      expect(result.removedFrom.actor).toBe('user.bsky.social');
    });

    it('should handle user not in list', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.graph.getList.mockResolvedValue({
        data: { items: [] },
      });

      const result = await tool.handler({
        listUri: 'at://did:plc:test123/app.bsky.graph.list/abc123',
        actor: 'user.bsky.social',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not in the specified list');
    });
  });
});

describe('GetListTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: GetListTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      app: {
        bsky: {
          graph: {
            getList: vi.fn(),
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

    tool = new GetListTool(mockAtpClient);
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('get_list');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('list');
    });
  });

  describe('Get List', () => {
    it('should retrieve list successfully', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.graph.getList.mockResolvedValue({
        data: {
          list: {
            uri: 'at://did:plc:test123/app.bsky.graph.list/abc123',
            name: 'My List',
            description: 'Test list',
            purpose: 'app.bsky.graph.defs#curatelist',
            creator: {
              did: 'did:plc:test123',
              handle: 'test.bsky.social',
              displayName: 'Test User',
            },
            listItemCount: 2,
          },
          items: [
            {
              uri: 'at://did:plc:test123/app.bsky.graph.listitem/item1',
              subject: {
                did: 'did:plc:user1',
                handle: 'user1.bsky.social',
                displayName: 'User 1',
              },
            },
          ],
          cursor: undefined,
        },
      });

      const result = await tool.handler({
        listUri: 'at://did:plc:test123/app.bsky.graph.list/abc123',
      });

      expect(result.success).toBe(true);
      expect(result.list.name).toBe('My List');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].subject.handle).toBe('user1.bsky.social');
    });

    it('should handle pagination', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      mockAgent.app.bsky.graph.getList.mockResolvedValue({
        data: {
          list: {
            uri: 'at://did:plc:test123/app.bsky.graph.list/abc123',
            name: 'My List',
            purpose: 'app.bsky.graph.defs#curatelist',
            creator: { did: 'did:plc:test123', handle: 'test.bsky.social' },
            listItemCount: 0,
          },
          items: [],
          cursor: 'next-page',
        },
      });

      const result = await tool.handler({
        listUri: 'at://did:plc:test123/app.bsky.graph.list/abc123',
        cursor: 'current-cursor',
      });

      expect(result.cursor).toBe('next-page');
      expect(mockAgent.app.bsky.graph.getList).toHaveBeenCalledWith({
        list: 'at://did:plc:test123/app.bsky.graph.list/abc123',
        limit: 50,
        cursor: 'current-cursor',
      });
    });
  });
});
