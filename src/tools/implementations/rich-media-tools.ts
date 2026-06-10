import { z } from 'zod';
import { BaseTool, ToolAuthMode } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';

/**
 * Zod schema for analyze image parameters
 */
const AnalyzeImageSchema = z.object({
  blob: z.object({
    ref: z.object({
      $link: z.string(),
    }),
    mimeType: z.string(),
    size: z.number(),
  }),
  includeOptimizationSuggestions: z.boolean().optional().default(true),
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
      "Analyze an image blob's metadata (file size, format/MIME type) and provide optimization " +
      'and accessibility suggestions. Does not decode the image, so it does not report pixel ' +
      'dimensions or aspect ratio.',
    params: AnalyzeImageSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'AnalyzeImage', ToolAuthMode.PUBLIC);
  }

  protected async execute(params: {
    blob: {
      ref: { $link: string };
      mimeType: string;
      size: number;
    };
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
