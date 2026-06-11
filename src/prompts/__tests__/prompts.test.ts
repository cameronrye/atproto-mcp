/**
 * Tests for MCP Prompts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentCompositionPrompt, ReplyTemplatePrompt } from '../index.js';
import type { AtpClient } from '../../utils/atp-client.js';

// Mock AtpClient
const createMockAtpClient = (authenticated = true) => {
  return {
    isAuthenticated: vi.fn().mockReturnValue(authenticated),
  } as unknown as AtpClient;
};

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
    it('should be available when authenticated', () => {
      expect(prompt.isAvailable()).toBe(true);
    });

    it('should not be available when not authenticated', () => {
      const unauthClient = createMockAtpClient(false);
      const unauthPrompt = new ContentCompositionPrompt(unauthClient);
      expect(unauthPrompt.isAvailable()).toBe(false);
    });

    it('should handle errors gracefully', () => {
      const errorClient = {
        isAuthenticated: vi.fn().mockImplementation(() => {
          throw new Error('Test error');
        }),
      } as unknown as AtpClient;
      const errorPrompt = new ContentCompositionPrompt(errorClient);
      expect(errorPrompt.isAvailable()).toBe(false);
    });
  });

  describe('Content Generation', () => {
    it('should generate prompt with default values', async () => {
      const content = await prompt.get();
      expect(content).toHaveLength(1);
      expect(content[0]!.role).toBe('user');
      expect(content[0]!.content.type).toBe('text');
      expect(content[0]!.content.text).toContain('general topic');
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

  describe('Content Generation', () => {
    it('should generate reply prompt', async () => {
      const content = await prompt.get({ original_post: 'Test post' });
      expect(content).toHaveLength(1);
      expect(content[0]!.role).toBe('user');
      expect(content[0]!.content.type).toBe('text');
    });
  });
});
