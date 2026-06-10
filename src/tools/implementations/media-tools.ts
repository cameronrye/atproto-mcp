/**
 * Enhanced media support tools for AT Protocol
 */

import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import { readFile } from 'fs/promises';
import { extname } from 'path';
import { assertSafePath, safeFetch } from '../../utils/url-safety.js';

/**
 * Directory that tool-supplied media file paths must stay within. Defaults to
 * the process working directory; override with ATPROTO_MEDIA_DIR. This prevents
 * an MCP caller from reading arbitrary local files (e.g. /etc/passwd, SSH keys)
 * and uploading them as blobs.
 */
function mediaBaseDir(): string {
  return process.env['ATPROTO_MEDIA_DIR'] ?? process.cwd();
}

/** MIME types accepted for remotely-fetched link-preview thumbnails. */
const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
]);

/**
 * Normalize and validate an image Content-Type for upload. The value comes from a
 * remote server (the link-preview target), so it is untrusted: only known image
 * types are accepted, and parameters (e.g. `; charset=...`) are stripped. Returns
 * the normalized MIME, or null if it is missing or not an allowed image type.
 */
export function safeImageMime(contentType: string | null | undefined): string | null {
  if (!contentType) {
    return null;
  }
  const mime = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return ALLOWED_IMAGE_MIME.has(mime) ? mime : null;
}

const UploadImageSchema = z.object({
  filePath: z.string().min(1, 'File path is required'),
  altText: z.string().max(1000, 'Alt text cannot exceed 1000 characters').optional(),
});

const UploadVideoSchema = z.object({
  filePath: z.string().min(1, 'File path is required'),
  altText: z.string().max(1000, 'Alt text cannot exceed 1000 characters').optional(),
  captions: z
    .array(
      z.object({
        lang: z.string().min(2, 'Language code must be at least 2 characters'),
        file: z.string().min(1, 'Caption file path is required'),
      })
    )
    .optional(),
});

const GenerateLinkPreviewSchema = z.object({
  url: z.string().url('Must be a valid URL'),
});

export class UploadImageTool extends BaseTool {
  public readonly schema = {
    method: 'upload_image',
    description:
      'Upload an image file to AT Protocol for use in posts. Supports JPEG, PNG, GIF, WebP, and AVIF formats.',
    params: UploadImageSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'UploadImage');
  }

  protected async execute(params: { filePath: string; altText?: string }): Promise<{
    success: boolean;
    message: string;
    image: {
      blob: {
        type: string;
        ref: string;
        mimeType: string;
        size: number;
      };
      alt: string;
      aspectRatio?: {
        width: number;
        height: number;
      };
    };
  }> {
    try {
      this.logger.info('Uploading image', {
        filePath: params.filePath,
        hasAltText: !!params.altText,
      });

      // Read the image file (restricted to the allowed media directory)
      const safePath = assertSafePath(params.filePath, mediaBaseDir());
      const imageData = await readFile(safePath);
      const fileExtension = extname(safePath).toLowerCase();

      // Determine MIME type
      const mimeTypeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.avif': 'image/avif',
      };

      const mimeType = mimeTypeMap[fileExtension];
      if (!mimeType) {
        throw new Error(`Unsupported image format: ${fileExtension}`);
      }

      // Check file size (max 1MB for images)
      if (imageData.length > 1024 * 1024) {
        throw new Error('Image file size cannot exceed 1MB');
      }

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.uploadBlob(imageData, {
            encoding: mimeType,
          });
        },
        'uploadImage',
        { filePath: params.filePath, size: imageData.length }
      );

      this.logger.info('Image uploaded successfully', {
        filePath: params.filePath,
        blobRef: response.data.blob.ref.toString(),
        size: response.data.blob.size,
      });

      return {
        success: true,
        message: `Image uploaded successfully from ${params.filePath}`,
        image: {
          blob: {
            type: 'blob',
            // blob.ref is a multiformats CID object; stringify it to the human/
            // AT-readable `bafkrei...` form. Returning the object would serialize
            // to a useless byte dump and break downstream embed/analysis tools.
            ref: response.data?.blob?.ref?.toString() ?? '',
            mimeType: response.data?.blob?.mimeType || mimeType,
            size: response.data?.blob?.size || imageData.length,
          },
          alt: params.altText || '',
          // NOTE: aspect ratio is intentionally omitted — the image is not
          // decoded here, so reporting a fixed 1:1 ratio would be fabricated.
        },
      };
    } catch (error) {
      this.logger.error('Failed to upload image', error);
      this.formatError(error);
    }
  }
}

export class UploadVideoTool extends BaseTool {
  public readonly schema = {
    method: 'upload_video',
    description:
      'Upload a video file to AT Protocol for use in posts. Supports MP4, MOV, and WebM formats.',
    params: UploadVideoSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'UploadVideo');
  }

  protected async execute(params: {
    filePath: string;
    altText?: string;
    captions?: Array<{ lang: string; file: string }>;
  }): Promise<{
    success: boolean;
    message: string;
    video: {
      blob: {
        type: string;
        ref: string;
        mimeType: string;
        size: number;
      };
      alt: string;
      aspectRatio?: {
        width: number;
        height: number;
      };
      captions?: Array<{
        lang: string;
        file: string;
      }>;
    };
  }> {
    try {
      this.logger.info('Uploading video', {
        filePath: params.filePath,
        hasAltText: !!params.altText,
        captionCount: params.captions?.length || 0,
      });

      // Read the video file (restricted to the allowed media directory)
      const safePath = assertSafePath(params.filePath, mediaBaseDir());
      const videoData = await readFile(safePath);
      const fileExtension = extname(safePath).toLowerCase();

      // Determine MIME type
      const mimeTypeMap: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.webm': 'video/webm',
      };

      const mimeType = mimeTypeMap[fileExtension];
      if (!mimeType) {
        throw new Error(`Unsupported video format: ${fileExtension}`);
      }

      // Check file size (max 50MB for videos)
      if (videoData.length > 50 * 1024 * 1024) {
        throw new Error('Video file size cannot exceed 50MB');
      }

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.uploadBlob(videoData, {
            encoding: mimeType,
          });
        },
        'uploadVideo',
        { filePath: params.filePath, size: videoData.length }
      );

      // Upload captions if provided
      let processedCaptions: Array<{ lang: string; file: string }> | undefined;
      if (params.captions && params.captions.length > 0) {
        processedCaptions = [];
        for (const caption of params.captions) {
          try {
            const captionData = await readFile(assertSafePath(caption.file, mediaBaseDir()));
            const captionResponse = await this.executeAtpOperation(
              async () => {
                const agent = this.atpClient.getAgent();
                return await agent.uploadBlob(captionData, {
                  encoding: 'text/vtt',
                });
              },
              'uploadCaption',
              { file: caption.file, lang: caption.lang }
            );

            processedCaptions.push({
              lang: caption.lang,
              file: captionResponse.data?.blob?.ref?.toString() ?? '',
            });
          } catch (captionError) {
            this.logger.warn('Failed to upload caption', captionError as Error);
          }
        }
      }

      this.logger.info('Video uploaded successfully', {
        filePath: params.filePath,
        blobRef: response.data.blob.ref.toString(),
        size: response.data.blob.size,
        captionCount: processedCaptions?.length || 0,
      });

      return {
        success: true,
        message: `Video uploaded successfully from ${params.filePath}`,
        video: {
          blob: {
            type: 'blob',
            // Stringify the multiformats CID to its `bafkrei...` form (see UploadImageTool).
            ref: response.data?.blob?.ref?.toString() ?? '',
            mimeType: response.data?.blob?.mimeType || mimeType,
            size: response.data?.blob?.size || videoData.length,
          },
          alt: params.altText || '',
          // NOTE: aspect ratio is intentionally omitted — the video is not
          // decoded here, so reporting a fixed 16:9 ratio would be fabricated.
          captions: processedCaptions,
        },
      };
    } catch (error) {
      this.logger.error('Failed to upload video', error);
      this.formatError(error);
    }
  }
}

export class GenerateLinkPreviewTool extends BaseTool {
  public readonly schema = {
    method: 'generate_link_preview',
    description: 'Generate a link preview with title, description, and thumbnail for a given URL.',
    params: GenerateLinkPreviewSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'GenerateLinkPreview');
  }

  protected async execute(params: { url: string }): Promise<{
    success: boolean;
    message: string;
    preview: {
      uri: string;
      title: string;
      description: string;
      thumb?: {
        blob: {
          type: string;
          ref: string;
          mimeType: string;
          size: number;
        };
      };
    };
  }> {
    try {
      this.logger.info('Generating link preview', {
        url: params.url,
      });

      // Fetch the webpage content with SSRF protection: http(s) only, DNS
      // resolution checked against private/internal ranges, redirects
      // re-validated, and response size/time capped.
      const response = await safeFetch(params.url, {
        headers: { 'User-Agent': 'AT Protocol MCP Server/1.0' },
        maxBytes: 2 * 1024 * 1024,
        timeoutMs: 10_000,
      });

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Failed to fetch URL: ${response.status}`);
      }

      const html = response.body.toString('utf8');

      // Extract metadata using simple regex patterns
      // In production, use a proper HTML parser like cheerio
      const titleMatch =
        html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
        html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i);
      const descriptionMatch =
        html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i) ||
        html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i);
      const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);

      const title = titleMatch?.[1]?.trim() || new URL(params.url).hostname;
      const description = descriptionMatch?.[1]?.trim() || '';
      const imageUrl = imageMatch?.[1]?.trim() || null;

      let thumbBlob;
      if (imageUrl) {
        try {
          // Resolve a possibly-relative og:image against the page URL, then
          // download it through the same SSRF-safe fetch (size-capped to 1MB).
          const resolvedImageUrl = new URL(imageUrl, response.url).toString();
          const imageResponse = await safeFetch(resolvedImageUrl, {
            headers: { 'User-Agent': 'AT Protocol MCP Server/1.0' },
            maxBytes: 1024 * 1024,
            timeoutMs: 10_000,
          });

          // Only upload the thumbnail when the remote response is actually a
          // known image type — never store an arbitrary (e.g. text/html or
          // octet-stream) payload as a blob just because the page advertised it
          // as og:image. Also enforce the 1MB size cap.
          const contentType = safeImageMime(imageResponse.contentType);
          if (
            imageResponse.status >= 200 &&
            imageResponse.status < 300 &&
            contentType &&
            imageResponse.body.length <= 1024 * 1024
          ) {
            const imageBuffer = imageResponse.body;

            const uploadResponse = await this.executeAtpOperation(
              async () => {
                const agent = this.atpClient.getAgent();
                return await agent.uploadBlob(imageBuffer, {
                  encoding: contentType,
                });
              },
              'uploadThumbnail',
              { imageUrl, size: imageBuffer.length }
            );

            thumbBlob = {
              blob: {
                type: 'blob',
                // Stringify the multiformats CID (see UploadImageTool).
                ref: uploadResponse.data?.blob?.ref?.toString() ?? '',
                mimeType: uploadResponse.data?.blob?.mimeType || contentType,
                size: uploadResponse.data?.blob?.size || imageBuffer.length,
              },
            };
          }
        } catch (imageError) {
          this.logger.warn('Failed to download thumbnail image', imageError as Error);
        }
      }

      this.logger.info('Link preview generated successfully', {
        url: params.url,
        title: `${title.substring(0, 50)}...`,
        hasDescription: !!description,
        hasThumb: !!thumbBlob,
      });

      return {
        success: true,
        message: `Link preview generated for ${params.url}`,
        preview: {
          uri: params.url,
          title: title.substring(0, 300), // Limit title length
          description: description.substring(0, 1000), // Limit description length
          thumb: thumbBlob,
        },
      };
    } catch (error) {
      this.logger.error('Failed to generate link preview', error);
      this.formatError(error);
    }
  }
}
