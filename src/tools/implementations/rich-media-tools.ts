import { z } from 'zod';
import { BaseTool, type BlobDescriptor, BlobDescriptorSchema, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';

/**
 * Zod schema for analyze image parameters
 */
const AnalyzeImageSchema = z.object({
  blob: BlobDescriptorSchema.describe(
    'Blob descriptor as returned by upload_image (the `image.blob` object in its output): ref (flat CID string or { "$link": "<cid>" } object), mimeType, and size.'
  ),
  includeOptimizationSuggestions: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'When true (default), the response includes a list of human-readable optimization and accessibility suggestions based on the blob size and MIME type.'
    ),
});

/**
 * Analyze Image Tool - Analyze image metadata and provide optimization suggestions
 *
 * This tool analyzes an uploaded image's blob metadata to provide:
 * - File size and format / MIME type information
 * - Optimization suggestions for better performance
 * - Accessibility recommendations
 *
 * Note: it does NOT decode the image, so it cannot report pixel dimensions or
 * aspect ratio — only the blob's declared size and MIME type.
 *
 * AUTHENTICATION REQUIREMENT:
 * - Public mode (no authentication required)
 * - Works with any blob reference
 */
export class AnalyzeImageTool extends BaseTool {
  public readonly schema = {
    method: 'analyze_image',
    description:
      "Analyze an image blob's metadata (MIME type, file size in bytes/KB/MB, derived format, and " +
      'whether it is within optimized-size thresholds) and optionally return human-readable ' +
      'optimization and accessibility suggestions. Does not decode the image, so it cannot report ' +
      'pixel dimensions or aspect ratio. No authentication required. ' +
      'Use upload_image to obtain the blob reference first, then pass it here; ' +
      'prefer this tool over upload_image for pre-flight size checks before actually posting. ' +
      'Subject to per-tool rate limiting.',
    params: AnalyzeImageSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'True when the analysis completed without errors.',
        },
        analysis: {
          type: 'object',
          description: 'Metadata derived from the blob.',
          properties: {
            mimeType: {
              type: 'string',
              description: 'MIME type of the image as declared in the blob (e.g. "image/jpeg").',
            },
            size: {
              type: 'number',
              description: 'Raw blob size in bytes.',
            },
            sizeKB: {
              type: 'number',
              description: 'Blob size converted to kilobytes, rounded to two decimal places.',
            },
            sizeMB: {
              type: 'number',
              description: 'Blob size converted to megabytes, rounded to two decimal places.',
            },
            format: {
              type: 'string',
              description:
                'Format string derived from the MIME type subtype (e.g. "jpeg", "png", "webp").',
            },
            isOptimized: {
              type: 'boolean',
              description:
                'True when the blob is within the format-specific size threshold considered optimized for web use.',
            },
          },
          required: ['mimeType', 'size', 'sizeKB', 'sizeMB', 'format', 'isOptimized'],
        },
        suggestions: {
          type: 'array',
          description:
            'List of human-readable optimization and accessibility suggestions. Present only when includeOptimizationSuggestions is true.',
          items: {
            type: 'string',
            description: 'A single optimization or accessibility recommendation.',
          },
        },
      },
      required: ['success', 'analysis'],
    },
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'AnalyzeImage', ToolAuthMode.PUBLIC);
  }

  protected async execute(params: {
    blob: BlobDescriptor;
    includeOptimizationSuggestions?: boolean;
  }): Promise<{
    success: boolean;
    analysis: {
      mimeType: string;
      size: number;
      sizeKB: number;
      sizeMB: number;
      format: string;
      isOptimized: boolean;
    };
    suggestions?: string[];
  }> {
    try {
      this.logger.info('Analyzing image', {
        mimeType: params.blob.mimeType,
        size: params.blob.size,
      });

      const sizeKB = params.blob.size / 1024;
      const sizeMB = sizeKB / 1024;
      const format = params.blob.mimeType.split('/')[1] || 'unknown';

      // Determine if image is optimized
      const isOptimized = this.isImageOptimized(params.blob.mimeType, params.blob.size);

      const analysis = {
        mimeType: params.blob.mimeType,
        size: params.blob.size,
        sizeKB: Math.round(sizeKB * 100) / 100,
        sizeMB: Math.round(sizeMB * 100) / 100,
        format,
        isOptimized,
      };

      let suggestions: string[] | undefined;
      if (params.includeOptimizationSuggestions) {
        suggestions = this.generateOptimizationSuggestions(params.blob.mimeType, params.blob.size);
      }

      this.logger.info('Image analysis completed', {
        format,
        sizeKB: analysis.sizeKB,
        isOptimized,
        suggestionsCount: suggestions?.length || 0,
      });

      return {
        success: true,
        analysis,
        ...(suggestions && { suggestions }),
      };
    } catch (error) {
      this.logger.error('Failed to analyze image', error);
      this.formatError(error);
    }
  }

  /**
   * Check if image is optimized based on format and size
   */
  private isImageOptimized(mimeType: string, size: number): boolean {
    const sizeKB = size / 1024;

    // Modern formats are generally well-optimized
    if (mimeType === 'image/webp' || mimeType === 'image/avif') {
      return sizeKB < 500; // 500KB threshold for modern formats
    }

    // JPEG should be reasonably compressed
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      return sizeKB < 300; // 300KB threshold for JPEG
    }

    // PNG can be larger but should still be reasonable
    if (mimeType === 'image/png') {
      return sizeKB < 500; // 500KB threshold for PNG
    }

    // Other formats - conservative threshold
    return sizeKB < 200;
  }

  /**
   * Generate optimization suggestions based on image properties
   */
  private generateOptimizationSuggestions(mimeType: string, size: number): string[] {
    const suggestions: string[] = [];
    const sizeKB = size / 1024;
    const sizeMB = sizeKB / 1024;

    // Size-based suggestions
    if (sizeMB > 1) {
      suggestions.push(
        `Image is ${Math.round(sizeMB * 100) / 100}MB - consider compressing to under 1MB for faster loading`
      );
    } else if (sizeKB > 500) {
      suggestions.push(
        `Image is ${Math.round(sizeKB)}KB - consider compressing to under 500KB for better performance`
      );
    }

    // Format-based suggestions
    if (mimeType === 'image/png' && sizeKB > 200) {
      suggestions.push(
        'PNG format detected - consider converting to WebP or JPEG for better compression'
      );
    }

    if (mimeType === 'image/bmp' || mimeType === 'image/tiff') {
      suggestions.push(
        'Uncompressed format detected - convert to JPEG, PNG, or WebP for much smaller file size'
      );
    }

    if (mimeType === 'image/gif' && sizeKB > 100) {
      suggestions.push(
        'Large GIF detected - consider converting to video format (MP4) for animations'
      );
    }

    // Modern format recommendations
    if (
      (mimeType === 'image/jpeg' || mimeType === 'image/png') &&
      sizeKB > 100 &&
      !suggestions.some(s => s.includes('WebP'))
    ) {
      suggestions.push(
        'Consider using WebP format for 25-35% better compression with same quality'
      );
    }

    // Accessibility suggestions
    suggestions.push('Always include alt text for accessibility when uploading images');

    // General best practices
    if (suggestions.length === 1) {
      // Only accessibility suggestion
      suggestions.push('Image appears well-optimized for web use');
    }

    return suggestions;
  }
}
