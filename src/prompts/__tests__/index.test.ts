/**
 * Tests for MCP Prompts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BasePrompt,
  ContentCompositionPrompt,
  ReplyTemplatePrompt,
  createPrompts,
} from '../index.js';
import { AtpClient } from '../../utils/atp-client.js';

// Mock AtpClient
vi.mock('../../utils/atp-client.js');

describe('BasePrompt', () => {
  let mockAtpClient: any;

  beforeEach(() => {
    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
    };
  });

  it('should check availability based on authentication', () => {
    class TestPrompt extends BasePrompt {
      name = 'test';
      description = 'Test prompt';
      async get() {
        return [];
      }
    }

    const prompt = new TestPrompt(mockAtpClient, 'TestPrompt');
    expect(prompt.isAvailable()).toBe(true);
  });

  it('should return false when authentication check throws', () => {
    mockAtpClient.isAuthenticated.mockImplementation(() => {
      throw new Error('Auth check failed');
    });

    class TestPrompt extends BasePrompt {
      name = 'test';
      description = 'Test prompt';
      async get() {
        return [];
      }
    }

    const prompt = new TestPrompt(mockAtpClient, 'TestPrompt');
    expect(prompt.isAvailable()).toBe(false);
  });
});

describe('ContentCompositionPrompt', () => {
  let mockAtpClient: any;
  let prompt: ContentCompositionPrompt;

  beforeEach(() => {
    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
    };

    prompt = new ContentCompositionPrompt(mockAtpClient);
  });

  describe('Schema', () => {
    it('should have correct name', () => {
      expect(prompt.name).toBe('content_composition');
    });

    it('should have description', () => {
      expect(prompt.description).toBeDefined();
      expect(prompt.description).toContain('engaging');
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

    it('should have optional arguments', () => {
      const toneArg = prompt.arguments?.find(arg => arg.name === 'tone');
      expect(toneArg).toBeDefined();
      expect(toneArg?.required).toBe(false);
    });
  });

  describe('Content Generation', () => {
    it('should generate content with default values', async () => {
      const content = await prompt.get();

      expect(content).toHaveLength(1);
      expect(content[0].role).toBe('user');
      expect(content[0].content.type).toBe('text');
      expect(content[0].content.text).toContain('general topic');
      expect(content[0].content.text).toContain('casual');
      expect(content[0].content.text).toContain('medium');
    });

    it('should generate content with custom topic', async () => {
      const content = await prompt.get({ topic: 'AI and decentralization' });

      expect(content[0].content.text).toContain('AI and decentralization');
    });

    it('should generate content with custom tone', async () => {
      const content = await prompt.get({ topic: 'test', tone: 'professional' });

      expect(content[0].content.text).toContain('professional');
      expect(content[0].content.text).toContain('polished');
    });

    it('should generate content with custom length', async () => {
      const content = await prompt.get({ topic: 'test', length: 'short' });

      expect(content[0].content.text).toContain('short');
      expect(content[0].content.text).toContain('under 100 characters');
    });

    it('should handle long length option', async () => {
      const content = await prompt.get({ topic: 'test', length: 'long' });

      expect(content[0].content.text).toContain('long');
      expect(content[0].content.text).toContain('up to 300 characters');
    });

    it('should handle include_hashtags option', async () => {
      const content = await prompt.get({ topic: 'test', include_hashtags: true });

      expect(content[0].content.text).toContain('Include hashtags: Yes');
    });

    it('should handle exclude hashtags option', async () => {
      const content = await prompt.get({ topic: 'test', include_hashtags: false });

      expect(content[0].content.text).toContain('Include hashtags: No');
    });

    it('should default to including hashtags', async () => {
      const content = await prompt.get({ topic: 'test' });

      expect(content[0].content.text).toContain('Include hashtags: Yes');
    });

    it('should handle humorous tone', async () => {
      const content = await prompt.get({ topic: 'test', tone: 'humorous' });

      expect(content[0].content.text).toContain('humorous');
      expect(content[0].content.text).toContain('wit');
    });

    it('should handle informative tone', async () => {
      const content = await prompt.get({ topic: 'test', tone: 'informative' });

      expect(content[0].content.text).toContain('informative');
      expect(content[0].content.text).toContain('valuable information');
    });

    it('should fall back to default tone for unknown tone', async () => {
      const content = await prompt.get({ topic: 'test', tone: 'unknown' });

      expect(content[0].content.text).toContain('unknown');
      expect(content[0].content.text).toContain('friendly, conversational');
    });

    it('should fall back to default length for unknown length', async () => {
      const content = await prompt.get({ topic: 'test', length: 'unknown' });

      expect(content[0].content.text).toContain('unknown');
      expect(content[0].content.text).toContain('150-250 characters');
    });

    it('should include AT Protocol guidelines', async () => {
      const content = await prompt.get({ topic: 'test' });

      expect(content[0].content.text).toContain('AT Protocol');
      expect(content[0].content.text).toContain('300-character limit');
    });
  });
});

describe('ReplyTemplatePrompt', () => {
  let mockAtpClient: any;
  let prompt: ReplyTemplatePrompt;

  beforeEach(() => {
    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
    };

    prompt = new ReplyTemplatePrompt(mockAtpClient);
  });

  describe('Schema', () => {
    it('should have correct name', () => {
      expect(prompt.name).toBe('reply_template');
    });

    it('should have description', () => {
      expect(prompt.description).toBeDefined();
      expect(prompt.description).toContain('reply');
    });

    it('should have arguments defined', () => {
      expect(prompt.arguments).toBeDefined();
      expect(prompt.arguments?.length).toBeGreaterThan(0);
    });

    it('should have original_post as required argument', () => {
      const postArg = prompt.arguments?.find(arg => arg.name === 'original_post');
      expect(postArg).toBeDefined();
      expect(postArg?.required).toBe(true);
    });

    it('should have optional arguments', () => {
      const replyTypeArg = prompt.arguments?.find(arg => arg.name === 'reply_type');
      expect(replyTypeArg).toBeDefined();
      expect(replyTypeArg?.required).toBe(false);
    });
  });

  describe('Content Generation', () => {
    it('should generate content with default values', async () => {
      const content = await prompt.get();

      expect(content).toHaveLength(1);
      expect(content[0].role).toBe('user');
      expect(content[0].content.type).toBe('text');
      expect(content[0].content.text).toContain('the original post');
      expect(content[0].content.text).toContain('supportive');
      expect(content[0].content.text).toContain('stranger');
    });

    it('should generate content with custom original post', async () => {
      const content = await prompt.get({ original_post: 'Just launched my new project!' });

      expect(content[0].content.text).toContain('Just launched my new project!');
    });

    it('should generate content with custom reply type', async () => {
      const content = await prompt.get({ original_post: 'test', reply_type: 'questioning' });

      expect(content[0].content.text).toContain('questioning');
      expect(content[0].content.text).toContain('thoughtful questions');
    });

    it('should handle informative reply type', async () => {
      const content = await prompt.get({ original_post: 'test', reply_type: 'informative' });

      expect(content[0].content.text).toContain('informative');
      expect(content[0].content.text).toContain('helpful information');
    });

    it('should handle humorous reply type', async () => {
      const content = await prompt.get({ original_post: 'test', reply_type: 'humorous' });

      expect(content[0].content.text).toContain('humorous');
      expect(content[0].content.text).toContain('humor');
    });

    it('should generate content with custom relationship', async () => {
      const content = await prompt.get({ original_post: 'test', relationship: 'friend' });

      expect(content[0].content.text).toContain('friend');
      expect(content[0].content.text).toContain('familiar');
    });

    it('should handle colleague relationship', async () => {
      const content = await prompt.get({ original_post: 'test', relationship: 'colleague' });

      expect(content[0].content.text).toContain('colleague');
      expect(content[0].content.text).toContain('professional');
    });

    it('should fall back to default reply type for unknown type', async () => {
      const content = await prompt.get({ original_post: 'test', reply_type: 'unknown' });

      expect(content[0].content.text).toContain('unknown');
      expect(content[0].content.text).toContain('encouragement');
    });

    it('should fall back to default relationship for unknown relationship', async () => {
      const content = await prompt.get({ original_post: 'test', relationship: 'unknown' });

      expect(content[0].content.text).toContain('unknown');
      expect(content[0].content.text).toContain('polite, respectful');
    });

    it('should include AT Protocol guidelines', async () => {
      const content = await prompt.get({ original_post: 'test' });

      expect(content[0].content.text).toContain('AT Protocol');
      expect(content[0].content.text).toContain('300 characters');
    });
  });
});

describe('createPrompts', () => {
  let mockAtpClient: any;

  beforeEach(() => {
    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
    };
  });

  it('should create all prompts', () => {
    const prompts = createPrompts(mockAtpClient);

    expect(prompts).toHaveLength(2);
    expect(prompts[0]).toBeInstanceOf(ContentCompositionPrompt);
    expect(prompts[1]).toBeInstanceOf(ReplyTemplatePrompt);
  });

  it('should handle errors during prompt creation', () => {
    // Create a client that throws during construction
    const badClient = {
      isAuthenticated: () => {
        throw new Error('Test error');
      },
    } as any;

    // The factory catches errors and returns empty array
    const prompts = createPrompts(badClient);

    // Even with errors, prompts are created (error handling is in isAvailable)
    expect(prompts).toHaveLength(2);
  });
});
