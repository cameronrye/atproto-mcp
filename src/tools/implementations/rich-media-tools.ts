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

/**
 * Zod schema for extract media from post parameters
 */
const ExtractMediaFromPostSchema = z.object({
  uri: z.string().min(1, 'Post URI is required'),
  includeThread: z.boolean().optional().default(false),
  includeEmbeds: z.boolean().optional().default(true),
  includeExternalLinks: z.boolean().optional().default(true),
});

/**
 * Extract Media From Post Tool - Extract all media from a post or thread
 *
 * This tool extracts all media content from a post including:
 * - Images with metadata
 * - Videos with metadata
 * - External links and previews
 * - Quote posts
 * - Thread media (if requested)
 *
 * AUTHENTICATION REQUIREMENT:
 * - Enhanced mode (works better with authentication)
 * - Public data available without auth
 */
export class ExtractMediaFromPostTool extends BaseTool {
  public readonly schema = {
    method: 'extract_media_from_post',
    description:
      'Extract all media content from a post or thread. Returns images, videos, external links, and quote posts. Optionally includes media from entire thread.',
    params: ExtractMediaFromPostSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'ExtractMediaFromPost', ToolAuthMode.ENHANCED);
  }

  protected async execute(params: {
    uri: string;
    includeThread?: boolean;
    includeEmbeds?: boolean;
    includeExternalLinks?: boolean;
  }): Promise<{
    success: boolean;
    media: {
      images: Array<{
        uri: string;
        alt?: string;
        aspectRatio?: { width: number; height: number };
        blob?: any;
      }>;
      videos: Array<{
        uri: string;
        alt?: string;
        aspectRatio?: { width: number; height: number };
        blob?: any;
      }>;
      externalLinks: Array<{
        uri: string;
        title?: string;
        description?: string;
        thumb?: string;
      }>;
      quotePosts: Array<{
        uri: string;
        cid: string;
      }>;
    };
    threadMedia?: any[];
  }> {
    try {
      this.logger.info('Extracting media from post', {
        uri: params.uri,
        includeThread: params.includeThread,
      });

      // Validate the URI
      this.validateAtUri(params.uri);

      // Get the post
      const threadResponse = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.getPostThread({ uri: params.uri });
        },
        'getPostThread',
        { uri: params.uri }
      );

      const threadData = threadResponse.data.thread as any;

      if (!threadData.post) {
        throw new Error('Post not found or blocked');
      }

      // Extract media from the main post
      const media = this.extractMediaFromPost(threadData.post, params);

      // Extract media from thread if requested
      let threadMedia: any[] | undefined;
      if (params.includeThread && threadData.replies) {
        threadMedia = threadData.replies
          .filter((r: any) => r.post)
          .map((r: any) => ({
            uri: r.post.uri,
            media: this.extractMediaFromPost(r.post, params),
          }));
      }

      this.logger.info('Media extraction completed', {
        uri: params.uri,
        imagesCount: media.images.length,
        videosCount: media.videos.length,
        externalLinksCount: media.externalLinks.length,
        quotePostsCount: media.quotePosts.length,
        threadPostsCount: threadMedia?.length || 0,
      });

      return {
        success: true,
        media,
        ...(threadMedia && { threadMedia }),
      };
    } catch (error) {
      this.logger.error('Failed to extract media from post', error);
      this.formatError(error);
    }
  }

  /**
   * Extract media from a single post
   */
  private extractMediaFromPost(
    post: any,
    params: {
      includeEmbeds?: boolean;
      includeExternalLinks?: boolean;
    }
  ): {
    images: any[];
    videos: any[];
    externalLinks: any[];
    quotePosts: any[];
  } {
    const images: any[] = [];
    const videos: any[] = [];
    const externalLinks: any[] = [];
    const quotePosts: any[] = [];

    if (!params.includeEmbeds && !params.includeExternalLinks) {
      return { images, videos, externalLinks, quotePosts };
    }

    const embed = post.embed;
    if (!embed) {
      return { images, videos, externalLinks, quotePosts };
    }

    // Handle different embed types
    const embedType = embed.$type;

    // Images embed
    if (embedType === 'app.bsky.embed.images#view' && params.includeEmbeds) {
      for (const image of embed.images || []) {
        images.push({
          uri: image.fullsize,
          alt: image.alt,
          aspectRatio: image.aspectRatio,
          thumb: image.thumb,
        });
      }
    }

    // Video embed
    if (embedType === 'app.bsky.embed.video#view' && params.includeEmbeds) {
      videos.push({
        uri: embed.playlist,
        alt: embed.alt,
        aspectRatio: embed.aspectRatio,
        thumbnail: embed.thumbnail,
      });
    }

    // External link embed
    if (embedType === 'app.bsky.embed.external#view' && params.includeExternalLinks) {
      externalLinks.push({
        uri: embed.external.uri,
        title: embed.external.title,
        description: embed.external.description,
        thumb: embed.external.thumb,
      });
    }

    // Quote post embed
    if (embedType === 'app.bsky.embed.record#view' && params.includeEmbeds) {
      if (embed.record?.uri && embed.record?.cid) {
        quotePosts.push({
          uri: embed.record.uri,
          cid: embed.record.cid,
        });
      }
    }

    // Record with media (quote post with images)
    if (embedType === 'app.bsky.embed.recordWithMedia#view' && params.includeEmbeds) {
      // Extract the quote post
      if (embed.record?.record?.uri && embed.record?.record?.cid) {
        quotePosts.push({
          uri: embed.record.record.uri,
          cid: embed.record.record.cid,
        });
      }

      // Extract the media
      if (embed.media) {
        const mediaType = embed.media.$type;

        if (mediaType === 'app.bsky.embed.images#view') {
          for (const image of embed.media.images || []) {
            images.push({
              uri: image.fullsize,
              alt: image.alt,
              aspectRatio: image.aspectRatio,
              thumb: image.thumb,
            });
          }
        }

        if (mediaType === 'app.bsky.embed.video#view') {
          videos.push({
            uri: embed.media.playlist,
            alt: embed.media.alt,
            aspectRatio: embed.media.aspectRatio,
            thumbnail: embed.media.thumbnail,
          });
        }

        if (mediaType === 'app.bsky.embed.external#view') {
          externalLinks.push({
            uri: embed.media.external.uri,
            title: embed.media.external.title,
            description: embed.media.external.description,
            thumb: embed.media.external.thumb,
          });
        }
      }
    }

    return { images, videos, externalLinks, quotePosts };
  }
}
