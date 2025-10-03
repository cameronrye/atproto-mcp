/**
 * Tests for BaseTool class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { BaseTool, ToolAuthMode } from '../base-tool.js';
import { AtpClient } from '../../../utils/atp-client.js';
import { ValidationError, AuthenticationError, AtpError } from '../../../types/index.js';

// Mock AtpClient
vi.mock('../../../utils/atp-client.js');

// Concrete implementation of BaseTool for testing
class TestTool extends BaseTool {
  public readonly schema = {
    method: 'test_tool',
    description: 'A test tool',
    params: z.object({
      testParam: z.string(),
    }),
  };

  protected async execute(params: any): Promise<any> {
    return { success: true, data: params };
  }
}

// Test tool without params schema
class TestToolNoParams extends BaseTool {
  public readonly schema = {
    method: 'test_tool_no_params',
    description: 'A test tool without params',
  };

  protected async execute(params: any): Promise<any> {
    return { success: true };
  }
}

// Test tool that throws error
class TestToolWithError extends BaseTool {
  public readonly schema = {
    method: 'test_tool_error',
    description: 'A test tool that throws error',
  };

  protected async execute(params: any): Promise<any> {
    throw new Error('Test error');
  }
}

describe('BaseTool', () => {
  let mockAtpClient: any;

  beforeEach(() => {
    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn(),
    };
  });

  describe('Constructor', () => {
    it('should create a tool with default PRIVATE auth mode', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(tool).toBeDefined();
      expect(tool.schema.method).toBe('test_tool');
    });

    it('should create a tool with PUBLIC auth mode', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool', ToolAuthMode.PUBLIC);
      expect(tool.isAvailable()).toBe(true);
    });

    it('should create a tool with ENHANCED auth mode', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool', ToolAuthMode.ENHANCED);
      expect(tool.isAvailable()).toBe(true);
    });
  });

  describe('handler', () => {
    it('should validate and execute with valid params', async () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      const result = await tool.handler({ testParam: 'value' });
      expect(result).toEqual({ success: true, data: { testParam: 'value' } });
    });

    it('should throw ValidationError for invalid params', async () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      await expect(tool.handler({ invalidParam: 'value' })).rejects.toThrow(ValidationError);
    });

    it('should execute without validation when no params schema', async () => {
      const tool = new TestToolNoParams(mockAtpClient, 'TestTool');
      const result = await tool.handler({ anyParam: 'value' });
      expect(result).toEqual({ success: true });
    });

    it('should handle ZodError and convert to ValidationError', async () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      await expect(tool.handler({})).rejects.toThrow(ValidationError);
    });

    it('should propagate errors from execute method', async () => {
      const tool = new TestToolWithError(mockAtpClient, 'TestTool');
      await expect(tool.handler({})).rejects.toThrow('Test error');
    });

    it('should sanitize sensitive params in logs', async () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      // This test verifies that the handler doesn't crash with sensitive params
      await tool.handler({ testParam: 'value', password: 'secret' });
    });
  });

  describe('isAvailable', () => {
    it('should return true for PUBLIC tools regardless of auth', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      const tool = new TestTool(mockAtpClient, 'TestTool', ToolAuthMode.PUBLIC);
      expect(tool.isAvailable()).toBe(true);
    });

    it('should return true for ENHANCED tools regardless of auth', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      const tool = new TestTool(mockAtpClient, 'TestTool', ToolAuthMode.ENHANCED);
      expect(tool.isAvailable()).toBe(true);
    });

    it('should return true for PRIVATE tools when authenticated', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(true);
      const tool = new TestTool(mockAtpClient, 'TestTool', ToolAuthMode.PRIVATE);
      expect(tool.isAvailable()).toBe(true);
    });

    it('should return false for PRIVATE tools when not authenticated', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      const tool = new TestTool(mockAtpClient, 'TestTool', ToolAuthMode.PRIVATE);
      expect(tool.isAvailable()).toBe(false);
    });
  });

  describe('getAvailabilityMessage', () => {
    it('should return "Available" when tool is available', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool', ToolAuthMode.PUBLIC);
      expect(tool.getAvailabilityMessage()).toBe('Available');
    });

    it('should return credentials message when no credentials', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      mockAtpClient.hasCredentials.mockReturnValue(false);
      const tool = new TestTool(mockAtpClient, 'TestTool', ToolAuthMode.PRIVATE);
      expect(tool.getAvailabilityMessage()).toBe(
        'Requires authentication - please provide credentials'
      );
    });

    it('should return authentication message when has credentials but not authenticated', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      mockAtpClient.hasCredentials.mockReturnValue(true);
      const tool = new TestTool(mockAtpClient, 'TestTool', ToolAuthMode.PRIVATE);
      expect(tool.getAvailabilityMessage()).toBe(
        'Authentication credentials provided but not authenticated - please authenticate'
      );
    });

    it('should return "Not available" for unknown state', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      const tool = new TestTool(mockAtpClient, 'TestTool', ToolAuthMode.ENHANCED);
      // Force isAvailable to return false by mocking
      vi.spyOn(tool, 'isAvailable').mockReturnValue(false);
      expect(tool.getAvailabilityMessage()).toBe('Not available');
    });
  });

  describe('executeAtpOperation', () => {
    it('should execute PUBLIC operation successfully', async () => {
      const tool = new TestTool(mockAtpClient, 'TestTool', ToolAuthMode.PUBLIC);
      mockAtpClient.executePublicRequest.mockResolvedValue({ success: true, data: 'result' });

      const result = await (tool as any).executeAtpOperation(async () => 'result', 'testOperation');

      expect(result).toBe('result');
      expect(mockAtpClient.executePublicRequest).toHaveBeenCalled();
    });

    it('should execute PRIVATE operation successfully', async () => {
      const tool = new TestTool(mockAtpClient, 'TestTool', ToolAuthMode.PRIVATE);
      mockAtpClient.executeAuthenticatedRequest.mockResolvedValue({
        success: true,
        data: 'result',
      });

      const result = await (tool as any).executeAtpOperation(async () => 'result', 'testOperation');

      expect(result).toBe('result');
      expect(mockAtpClient.executeAuthenticatedRequest).toHaveBeenCalled();
    });

    it('should execute ENHANCED operation with auth when authenticated', async () => {
      const tool = new TestTool(mockAtpClient, 'TestTool', ToolAuthMode.ENHANCED);
      mockAtpClient.isAuthenticated.mockReturnValue(true);
      mockAtpClient.executeAuthenticatedRequest.mockResolvedValue({
        success: true,
        data: 'result',
      });

      const result = await (tool as any).executeAtpOperation(async () => 'result', 'testOperation');

      expect(result).toBe('result');
      expect(mockAtpClient.executeAuthenticatedRequest).toHaveBeenCalled();
    });

    it('should execute ENHANCED operation without auth when not authenticated', async () => {
      const tool = new TestTool(mockAtpClient, 'TestTool', ToolAuthMode.ENHANCED);
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      mockAtpClient.executePublicRequest.mockResolvedValue({ success: true, data: 'result' });

      const result = await (tool as any).executeAtpOperation(async () => 'result', 'testOperation');

      expect(result).toBe('result');
      expect(mockAtpClient.executePublicRequest).toHaveBeenCalled();
    });

    it('should throw AuthenticationError for PRIVATE tool when not authenticated', async () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      const tool = new TestTool(mockAtpClient, 'TestTool', ToolAuthMode.PRIVATE);

      await expect(
        (tool as any).executeAtpOperation(async () => 'result', 'testOperation')
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw error when operation fails', async () => {
      const tool = new TestTool(mockAtpClient, 'TestTool', ToolAuthMode.PUBLIC);
      const error = new Error('Operation failed');
      mockAtpClient.executePublicRequest.mockResolvedValue({ success: false, error });

      await expect(
        (tool as any).executeAtpOperation(async () => 'result', 'testOperation')
      ).rejects.toThrow('Operation failed');
    });
  });

  describe('validateActor', () => {
    it('should accept valid DID', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateActor('did:plc:abc123')).not.toThrow();
    });

    it('should accept valid handle', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateActor('user.bsky.social')).not.toThrow();
    });

    it('should reject empty string', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateActor('')).toThrow(ValidationError);
    });

    it('should reject non-string', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateActor(123)).toThrow(ValidationError);
    });

    it('should reject invalid format', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateActor('invalid')).toThrow(ValidationError);
    });

    it('should reject URL as actor', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateActor('https://example.com')).toThrow(ValidationError);
    });
  });

  describe('validateAtUri', () => {
    it('should accept valid AT URI', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() =>
        (tool as any).validateAtUri('at://did:plc:abc123/app.bsky.feed.post/123')
      ).not.toThrow();
    });

    it('should reject empty string', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateAtUri('')).toThrow(ValidationError);
    });

    it('should reject non-string', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateAtUri(123)).toThrow(ValidationError);
    });

    it('should reject URI without at:// prefix', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateAtUri('did:plc:abc123')).toThrow(ValidationError);
    });
  });

  describe('validateCid', () => {
    it('should accept valid CID', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateCid('bafyreiabc123')).not.toThrow();
    });

    it('should accept alphanumeric CID', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateCid('abc123XYZ')).not.toThrow();
    });

    it('should reject empty string', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateCid('')).toThrow(ValidationError);
    });

    it('should reject non-string', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateCid(123)).toThrow(ValidationError);
    });

    it('should reject CID with special characters', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateCid('bafy@123')).toThrow(ValidationError);
    });
  });

  describe('validateISO8601Date', () => {
    it('should accept valid ISO 8601 date with Z', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateISO8601Date('2024-01-15T10:30:00Z')).not.toThrow();
    });

    it('should accept valid ISO 8601 date with milliseconds', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateISO8601Date('2024-01-15T10:30:00.000Z')).not.toThrow();
    });

    it('should accept valid ISO 8601 date with timezone offset', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateISO8601Date('2024-01-15T10:30:00+00:00')).not.toThrow();
    });

    it('should reject empty string', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateISO8601Date('')).toThrow(ValidationError);
    });

    it('should reject non-string', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateISO8601Date(123)).toThrow(ValidationError);
    });

    it('should reject invalid date', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateISO8601Date('invalid-date')).toThrow(ValidationError);
    });

    it('should reject date without time', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).validateISO8601Date('2024-01-15')).toThrow(ValidationError);
    });

    it('should use custom field name in error message', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      try {
        (tool as any).validateISO8601Date('invalid', 'customField');
      } catch (error: any) {
        expect(error.message).toContain('customField');
      }
    });
  });

  describe('formatError', () => {
    it('should re-throw AtpError as-is', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      const error = new AtpError('Test error', 'TEST_ERROR');
      expect(() => (tool as any).formatError(error)).toThrow(AtpError);
    });

    it('should re-throw ValidationError as-is', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      const error = new ValidationError('Test error');
      expect(() => (tool as any).formatError(error)).toThrow(ValidationError);
    });

    it('should wrap Error in AtpError', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      const error = new Error('Test error');
      expect(() => (tool as any).formatError(error)).toThrow(AtpError);
    });

    it('should wrap unknown error in AtpError', () => {
      const tool = new TestTool(mockAtpClient, 'TestTool');
      expect(() => (tool as any).formatError('string error')).toThrow(AtpError);
    });
  });
});
