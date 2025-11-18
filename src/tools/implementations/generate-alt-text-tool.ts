/**
 * Generate Alt Text Tool - Generates descriptive alt text for images
 */

import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';

/**
 * Zod schema for generate alt text parameters
 */
const GenerateAltTextSchema = z
  .object({
    imageUrl: z.string().url().optional(),
    imageData: z.string().optional(),
    context: z.string().optional(),
    maxLength: z.number().int().min(10).max(1000).optional().default(200),
  })
  .refine(data => data.imageUrl || data.imageData, {
    message: 'Either imageUrl or imageData must be provided',
  });

/**
 * Tool for generating descriptive alt text for images
 *
 * This tool helps create accessible content by generating descriptive
 * alt text for images. It can work with:
 * - Image URLs
 * - Base64 encoded image data
 * - Optional context to improve descriptions
 *
 * NOTE: This is a placeholder implementation that provides guidance
 * on writing good alt text. In a production environment, this would
 * integrate with a vision AI service (like GPT-4 Vision, Claude Vision,
 * or Google Cloud Vision API) to automatically analyze images.
 *
 * AUTHENTICATION REQUIREMENT:
 * - Public mode (no authentication required)
 * - Can be used by anyone to generate alt text
 */
export class GenerateAltTextTool extends BaseTool {
  public readonly schema = {
    method: 'generate_alt_text',
    description:
      'Generate descriptive alt text for images to improve accessibility. Provide either an image URL or base64 encoded image data. Optionally include context about the image.',
    params: GenerateAltTextSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'GenerateAltText', ToolAuthMode.PUBLIC);
  }

  protected async execute(params: {
    imageUrl?: string;
    imageData?: string;
    context?: string;
    maxLength?: number;
  }): Promise<{
    success: boolean;
    altText: string;
    suggestions: string[];
    guidelines: {
      dos: string[];
      donts: string[];
    };
  }> {
    try {
      this.logger.info('Generating alt text', {
        hasUrl: !!params.imageUrl,
        hasData: !!params.imageData,
        hasContext: !!params.context,
        maxLength: params.maxLength,
      });

      // In a production implementation, this would:
      // 1. Fetch the image from URL or decode base64 data
      // 2. Send to a vision AI service for analysis
      // 3. Generate descriptive alt text based on the analysis
      // 4. Optionally incorporate the provided context

      // For now, provide a helpful placeholder response
      const altText = this.generatePlaceholderAltText(params);

      const suggestions = [
        'Be specific and descriptive about what the image shows',
        'Include relevant details like colors, actions, emotions, and context',
        'Keep it concise but informative (aim for 1-2 sentences)',
        'Avoid phrases like "image of" or "picture of" - just describe what you see',
        'If the image contains text, include that text in the alt text',
        'For decorative images, use empty alt text (alt="")',
        'For complex images like charts or diagrams, provide a detailed description',
      ];

      if (params.context) {
        suggestions.push(`Consider the context: "${params.context}" when describing the image`);
      }

      const guidelines = {
        dos: [
          'Describe the content and function of the image',
          'Be accurate and specific',
          'Keep it concise (under 125 characters when possible)',
          'Include important text that appears in the image',
          'Describe the mood or emotion if relevant',
          'Use proper punctuation and grammar',
        ],
        donts: [
          'Don\'t start with "image of" or "picture of"',
          "Don't include redundant information",
          "Don't use overly technical jargon unless necessary",
          "Don't describe decorative images (use empty alt instead)",
          "Don't make assumptions about what's not visible",
          "Don't exceed the character limit unnecessarily",
        ],
      };

      this.logger.info('Alt text generation completed', {
        altTextLength: altText.length,
        suggestionsCount: suggestions.length,
      });

      return {
        success: true,
        altText,
        suggestions,
        guidelines,
      };
    } catch (error) {
      this.logger.error('Failed to generate alt text', error);
      this.formatError(error);
    }
  }

  /**
   * Generate placeholder alt text with guidance
   * In production, this would be replaced with actual AI-generated descriptions
   */
  private generatePlaceholderAltText(params: {
    imageUrl?: string;
    imageData?: string;
    context?: string;
    maxLength?: number;
  }): string {
    const maxLength = params.maxLength || 200;

    let altText = '[AI-generated alt text would appear here] ';

    if (params.context) {
      altText += `Context: ${params.context}. `;
    }

    altText +=
      'To implement actual image analysis, integrate with a vision AI service like GPT-4 Vision, Claude Vision, or Google Cloud Vision API.';

    // Truncate to max length
    if (altText.length > maxLength) {
      altText = `${altText.substring(0, maxLength - 3)}...`;
    }

    return altText;
  }
}
