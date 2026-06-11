/**
 * Tests for MCP Prompts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { ContentCompositionPrompt, ReplyTemplatePrompt } from '../index.js';
import type { AtpClient } from '../../utils/atp-client.js';

// Mock AtpClient
const createMockAtpClient = (authenticated = true) =>
  ({
    isAuthenticated: vi.fn().mockReturnValue(authenticated),
  }) as unknown as AtpClient;

describe('ContentCompositionPrompt', () => {
  let prompt: ContentCompositionPrompt;
  let mockClient: AtpClient;

  beforeEach(() => {
    mockClient = createMockAtpClient();
    prompt = new ContentCompositionPrompt(mockClient);
  });

  describe('Schema', () => {
    it('should have correct name', () => {
      expect(prompt.name).toBe('content_composition');
    });

    it('should have description', () => {
      expect(prompt.description).toBeTruthy();
      expect(prompt.description).toContain('social media');
    });

    it('should have arguments defined', () => {
      expect(prompt.arguments).toBeDefined();
      expect(prompt.arguments?.length).toBeGreaterThan(0);
    });

    it('should have topic as required argument', () => {
      const topicArg = prompt.arguments?.find(arg => arg.name === 'topic');
      expect(topicArg).toBeDefined();
      expect(topicArg?.required).toBe(true);
    });
  });

  describe('Availability', () => {
    // Prompts are pure text templates that never touch the AT Protocol client,
    // so they are available regardless of authentication state.
    it('should be available when authenticated', () => {
      expect(prompt.isAvailable()).toBe(true);
    });

    it('should be available when not authenticated', () => {
      const unauthClient = createMockAtpClient(false);
      const unauthPrompt = new ContentCompositionPrompt(unauthClient);
      expect(unauthPrompt.isAvailable()).toBe(true);
    });

    it('should be available even when the client errors', () => {
      const errorClient = {
        isAuthenticated: vi.fn().mockImplementation(() => {
          throw new Error('Test error');
        }),
      } as unknown as AtpClient;
      const errorPrompt = new ContentCompositionPrompt(errorClient);
      expect(errorPrompt.isAvailable()).toBe(true);
    });
  });

  describe('Content Generation', () => {
    it('rejects a missing required topic with an invalid-params error', async () => {
      // The declared required argument must be enforced, not silently replaced
      // with a 'general topic' placeholder.
      const error = await prompt.get().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(McpError);
      expect((error as McpError).code).toBe(ErrorCode.InvalidParams);
      expect((error as McpError).message).toContain('topic');
    });

    it('rejects an empty topic with an invalid-params error', async () => {
      const error = await prompt.get({ topic: '   ' }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(McpError);
      expect((error as McpError).code).toBe(ErrorCode.InvalidParams);
    });

    it('should generate prompt with custom topic', async () => {
      const content = await prompt.get({ topic: 'AI and decentralization' });
      expect(content[0]!.content.text).toContain('AI and decentralization');
    });

    it('should generate prompt with custom tone', async () => {
      const content = await prompt.get({ topic: 'test', tone: 'professional' });
      expect(content[0]!.content.text).toContain('professional');
    });

    it('should generate prompt with custom length', async () => {
      const content = await prompt.get({ topic: 'test', length: 'short' });
      expect(content[0]!.content.text).toContain('short');
    });

    it('should handle hashtags preference', async () => {
      const withHashtags = await prompt.get({ topic: 'test', include_hashtags: true });
      expect(withHashtags[0]!.content.text).toContain('Yes');

      const withoutHashtags = await prompt.get({ topic: 'test', include_hashtags: false });
      expect(withoutHashtags[0]!.content.text).toContain('No');
    });

    it('should include AT Protocol context', async () => {
      const content = await prompt.get({ topic: 'test' });
      expect(content[0]!.content.text).toContain('AT Protocol');
      expect(content[0]!.content.text).toContain('300-character');
    });
  });
});

describe('ReplyTemplatePrompt', () => {
  let prompt: ReplyTemplatePrompt;
  let mockClient: AtpClient;

  beforeEach(() => {
    mockClient = createMockAtpClient();
    prompt = new ReplyTemplatePrompt(mockClient);
  });

  describe('Schema', () => {
    it('should have correct name', () => {
      expect(prompt.name).toBe('reply_template');
    });

    it('should have description', () => {
      expect(prompt.description).toBeTruthy();
    });

    it('should have arguments defined', () => {
      expect(prompt.arguments).toBeDefined();
    });
  });

  describe('Availability', () => {
    it('should be available when not authenticated', () => {
      const unauthClient = createMockAtpClient(false);
      const unauthPrompt = new ReplyTemplatePrompt(unauthClient);
      expect(unauthPrompt.isAvailable()).toBe(true);
    });
  });

  describe('Content Generation', () => {
    it('should generate reply prompt', async () => {
      const content = await prompt.get({ original_post: 'Test post' });
      expect(content).toHaveLength(1);
      expect(content[0]!.role).toBe('user');
      expect(content[0]!.content.type).toBe('text');
    });

    it('rejects a missing required original_post with an invalid-params error', async () => {
      const error = await prompt.get({}).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(McpError);
      expect((error as McpError).code).toBe(ErrorCode.InvalidParams);
      expect((error as McpError).message).toContain('original_post');
    });
  });
});
