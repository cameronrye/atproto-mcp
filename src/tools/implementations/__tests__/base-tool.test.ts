/**
 * Tests for BaseTool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseTool, ToolAuthMode } from '../base-tool.js';
import type { AtpClient } from '../../../utils/atp-client.js';
import { z } from 'zod';

// Create a concrete implementation for testing
class TestTool extends BaseTool {
  public readonly schema = {
    method: 'test_tool',
    description: 'A test tool',
    params: z.object({
      value: z.string(),
    }),
  };

  constructor(atpClient: AtpClient, authMode: ToolAuthMode = ToolAuthMode.PRIVATE) {
    super(atpClient, 'TestTool', authMode);
  }

  protected async execute(params: any): Promise<any> {
    return { success: true, data: params };
  }
}

// Mock AtpClient
const createMockAtpClient = (authenticated = true, hasCredentials = true) => {
  return {
    isAuthenticated: vi.fn().mockReturnValue(authenticated),
    hasCredentials: vi.fn().mockReturnValue(hasCredentials),
    executePublicRequest: vi.fn().mockResolvedValue({ success: true, data: {} }),
    executeAuthenticatedRequest: vi.fn().mockResolvedValue({ success: true, data: {} }),
  } as unknown as AtpClient;
};

describe('BaseTool', () => {
  describe('Availability', () => {
    it('should be available for PUBLIC tools regardless of auth', () => {
      const unauthClient = createMockAtpClient(false, false);
      const tool = new TestTool(unauthClient, ToolAuthMode.PUBLIC);
      expect(tool.isAvailable()).toBe(true);
    });

    it('should be available for ENHANCED tools regardless of auth', () => {
      const unauthClient = createMockAtpClient(false, false);
      const tool = new TestTool(unauthClient, ToolAuthMode.ENHANCED);
      expect(tool.isAvailable()).toBe(true);
    });

    it('should be available for PRIVATE tools when authenticated', () => {
      const authClient = createMockAtpClient(true, true);
      const tool = new TestTool(authClient, ToolAuthMode.PRIVATE);
      expect(tool.isAvailable()).toBe(true);
    });

    it('should not be available for PRIVATE tools when not authenticated', () => {
      const unauthClient = createMockAtpClient(false, true);
      const tool = new TestTool(unauthClient, ToolAuthMode.PRIVATE);
      expect(tool.isAvailable()).toBe(false);
    });
  });

  describe('Availability Messages', () => {
    it('should return Available when tool is available', () => {
      const authClient = createMockAtpClient(true, true);
      const tool = new TestTool(authClient, ToolAuthMode.PRIVATE);
      expect(tool.getAvailabilityMessage()).toBe('Available');
    });

    it('should return credentials message when no credentials', () => {
      const noCredsClient = createMockAtpClient(false, false);
      const tool = new TestTool(noCredsClient, ToolAuthMode.PRIVATE);
      expect(tool.getAvailabilityMessage()).toContain('provide credentials');
    });

    it('should return authentication message when has credentials but not authenticated', () => {
      const unauthClient = createMockAtpClient(false, true);
      const tool = new TestTool(unauthClient, ToolAuthMode.PRIVATE);
      expect(tool.getAvailabilityMessage()).toContain('not authenticated');
    });
  });

  describe('Handler', () => {
    it('should validate parameters', async () => {
      const client = createMockAtpClient();
      const tool = new TestTool(client);

      await expect(tool.handler({ value: 123 })).rejects.toThrow();
    });

    it('should execute with valid parameters', async () => {
      const client = createMockAtpClient();
      const tool = new TestTool(client);

      const result = await tool.handler({ value: 'test' });
      expect(result.success).toBe(true);
      expect(result.data.value).toBe('test');
    });

    it('should handle execution errors', async () => {
      const client = createMockAtpClient();
      const tool = new TestTool(client);
      
      // Override execute to throw error
      tool['execute'] = vi.fn().mockRejectedValue(new Error('Test error'));

      await expect(tool.handler({ value: 'test' })).rejects.toThrow('Test error');
    });
  });

  describe('Validation Helpers', () => {
    let tool: TestTool;

    beforeEach(() => {
      const client = createMockAtpClient();
      tool = new TestTool(client);
    });

    it('should validate AT URI format', () => {
      expect(() => tool['validateAtUri']('at://did:plc:abc/app.bsky.feed.post/123')).not.toThrow();
      expect(() => tool['validateAtUri']('invalid')).toThrow();
      expect(() => tool['validateAtUri']('')).toThrow();
    });

    it('should validate CID format', () => {
      expect(() => tool['validateCid']('bafyreigbtj4x7ip5legnfznufuopl4sg4knzc2cof6duas4b3q2fy6swua')).not.toThrow();
      expect(() => tool['validateCid']('bafkreiabcd1234')).not.toThrow();
      expect(() => tool['validateCid']('')).toThrow();
    });

    it('should validate actor (DID or handle)', () => {
      expect(() => tool['validateActor']('did:plc:abc123')).not.toThrow();
      expect(() => tool['validateActor']('user.bsky.social')).not.toThrow();
      expect(() => tool['validateActor']('')).toThrow();
    });

    it('should validate ISO8601 date format', () => {
      expect(() => tool['validateISO8601Date']('2024-01-15T10:30:00Z')).not.toThrow();
      expect(() => tool['validateISO8601Date']('2024-01-15T10:30:00.000Z')).not.toThrow();
      expect(() => tool['validateISO8601Date']('invalid')).toThrow();
      expect(() => tool['validateISO8601Date']('')).toThrow();
    });
  });
});

