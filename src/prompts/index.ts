/**
 * MCP Prompts for AT Protocol content creation assistance
 */

import type { AtpClient } from '../utils/atp-client.js';
import { Logger } from '../utils/logger.js';

export interface IMcpPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

export interface IPromptContent {
  role: 'user' | 'assistant';
  content: {
    type: 'text';
    text: string;
  };
}

/**
 * Base class for MCP prompts
 */
export abstract class BasePrompt implements IMcpPrompt {
  public abstract readonly name: string;
  public abstract readonly description: string;
  public abstract readonly arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;

  protected logger: Logger;

  constructor(
    protected atpClient: AtpClient,
    loggerName: string
  ) {
    this.logger = new Logger(loggerName);
  }

  /**
   * Check if the prompt is available
   */
  isAvailable(): boolean {
    try {
      return this.atpClient.isAuthenticated();
    } catch {
      return false;
    }
  }

  /**
   * Generate the prompt content
   */
  abstract get(args?: Record<string, unknown>): Promise<IPromptContent[]>;
}

/**
 * Content composition prompt for creating engaging posts
 */
export class ContentCompositionPrompt extends BasePrompt {
  public readonly name = 'content_composition';
  public readonly description =
    'Generate engaging social media post content with proper formatting and hashtags';
  public readonly arguments = [
    {
      name: 'topic',
      description: 'The main topic or subject for the post',
      required: true,
    },
    {
      name: 'tone',
      description: 'The desired tone (casual, professional, humorous, informative)',
      required: false,
    },
    {
      name: 'length',
      description: 'Desired length (short, medium, long)',
      required: false,
    },
    {
      name: 'include_hashtags',
      description: 'Whether to include relevant hashtags',
      required: false,
    },
  ];

  constructor(atpClient: AtpClient) {
    super(atpClient, 'ContentCompositionPrompt');
  }

  async get(args?: Record<string, unknown>): Promise<IPromptContent[]> {
    const topic = (args?.['topic'] as string | undefined) ?? 'general topic';
    const tone = (args?.['tone'] as string | undefined) ?? 'casual';
    const length = (args?.['length'] as string | undefined) ?? 'medium';
    const includeHashtags = (args?.['include_hashtags'] as boolean | undefined) !== false;

    const lengthGuidance = {
      short: 'Keep it under 100 characters, punchy and direct.',
      medium: 'Aim for 150-250 characters, engaging but concise.',
      long: 'Use up to 300 characters, provide more detail and context.',
    };

    const toneGuidance = {
      casual: 'Use a friendly, conversational tone that feels natural and approachable.',
      professional: 'Maintain a polished, business-appropriate tone while staying engaging.',
      humorous: 'Add wit and humor where appropriate, but keep it tasteful.',
      informative: 'Focus on providing valuable information in an accessible way.',
    };

    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Create an engaging social media post about "${topic}" for AT Protocol/Bluesky.

Requirements:
- Topic: ${topic}
- Tone: ${tone} (${toneGuidance[tone as keyof typeof toneGuidance] || toneGuidance.casual})
- Length: ${length} (${lengthGuidance[length as keyof typeof lengthGuidance] || lengthGuidance.medium})
- Include hashtags: ${includeHashtags ? 'Yes' : 'No'}
- Platform: AT Protocol/Bluesky (consider the community culture)

Guidelines:
1. Make it authentic and engaging
2. Use clear, accessible language
3. Consider adding a call-to-action or question to encourage engagement
4. If including hashtags, use 2-4 relevant ones
5. Ensure it fits within AT Protocol's 300-character limit
6. Consider the decentralized, open-source nature of the platform

Please provide the post text ready to publish.`,
        },
      },
    ];
  }
}

/**
 * Reply template prompt for generating thoughtful responses
 */
export class ReplyTemplatePrompt extends BasePrompt {
  public readonly name = 'reply_template';
  public readonly description = 'Generate thoughtful reply templates for different types of posts';
  public readonly arguments = [
    {
      name: 'original_post',
      description: 'The original post content to reply to',
      required: true,
    },
    {
      name: 'reply_type',
      description: 'Type of reply (supportive, questioning, informative, humorous)',
      required: false,
    },
    {
      name: 'relationship',
      description: 'Relationship to the original poster (friend, colleague, stranger)',
      required: false,
    },
  ];

  constructor(atpClient: AtpClient) {
    super(atpClient, 'ReplyTemplatePrompt');
  }

  async get(args?: Record<string, unknown>): Promise<IPromptContent[]> {
    const originalPost = (args?.['original_post'] as string | undefined) ?? 'the original post';
    const replyType = (args?.['reply_type'] as string | undefined) ?? 'supportive';
    const relationship = (args?.['relationship'] as string | undefined) ?? 'stranger';

    const replyTypeGuidance = {
      supportive: 'Show encouragement, agreement, or positive reinforcement.',
      questioning: 'Ask thoughtful questions to deepen the conversation.',
      informative: 'Add helpful information or resources related to the topic.',
      humorous: 'Add appropriate humor while being respectful.',
    };

    const relationshipGuidance = {
      friend: 'Use a familiar, warm tone as you would with a close friend.',
      colleague: 'Maintain professional courtesy while being personable.',
      stranger: 'Be polite, respectful, and considerate in your approach.',
    };

    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Generate a thoughtful reply to this AT Protocol/Bluesky post:

Original Post: "${originalPost}"

Reply Parameters:
- Type: ${replyType} (${replyTypeGuidance[replyType as keyof typeof replyTypeGuidance] || replyTypeGuidance.supportive})
- Relationship: ${relationship} (${relationshipGuidance[relationship as keyof typeof relationshipGuidance] || relationshipGuidance.stranger})

Guidelines:
1. Keep it under 300 characters (AT Protocol limit)
2. Be authentic and add value to the conversation
3. Match the tone and energy of the original post
4. Avoid controversial topics unless directly relevant
5. Consider the decentralized, community-focused nature of AT Protocol
6. Be respectful and constructive
7. If appropriate, ask a follow-up question to continue the conversation

Please provide a ready-to-post reply that feels natural and engaging.`,
        },
      },
    ];
  }
}

/**
 * Create all MCP prompts for AT Protocol content assistance
 */
export function createPrompts(atpClient: AtpClient): BasePrompt[] {
  const logger = new Logger('PromptsFactory');

  try {
    const prompts = [new ContentCompositionPrompt(atpClient), new ReplyTemplatePrompt(atpClient)];

    logger.info(`Created ${prompts.length} AT Protocol MCP prompts`);
    return prompts;
  } catch (error) {
    logger.error('Failed to create MCP prompts', error);
    return [];
  }
}
