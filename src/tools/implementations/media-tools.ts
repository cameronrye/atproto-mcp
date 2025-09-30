/**
 * Enhanced media support tools for AT Protocol
 */

import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import { readFile } from 'fs/promises';
import { extname } from 'path';

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

const CreateRichTextPostSchema = z.object({
  text: z.string().min(1, 'Post text is required').max(300, 'Post cannot exceed 300 characters'),
  facets: z
    .array(
      z.object({
        index: z.object({
          byteStart: z.number().min(0),
          byteEnd: z.number().min(0),
        }),
        features: z.array(
          z.object({
            type: z.enum(['mention', 'link', 'hashtag']),
            value: z.string(),
          })
        ),
      })
    )
    .optional(),
  embed: z
    .object({
      type: z.enum(['images', 'external', 'record']),
      images: z
        .array(
          z.object({
            image: z.string(),
            alt: z.string(),
          })
        )
        .optional(),
      external: z
        .object({
          uri: z.string().url(),
          title: z.string(),
          description: z.string(),
          thumb: z.string().optional(),
        })
        .optional(),
      record: z
        .object({
          uri: z.string(),
          cid: z.string(),
        })
        .optional(),
    })
    .optional(),
});

const GenerateLinkPreviewSchema = z.object({
  url: z.string().url('Must be a valid URL'),
});

export class UploadImageTool extends BaseTool {
  public readonly schema = {
    method: 'upload_image',
    description:
      'Upload an image file to AT Protocol for use in posts. Supports JPEG, PNG, GIF, and WebP formats.',
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

      // Read the image file
      const imageData = await readFile(params.filePath);
      const fileExtension = extname(params.filePath).toLowerCase();

      // Determine MIME type
      const mimeTypeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
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
        blobRef: response.data.blob.ref,
        size: response.data.blob.size,
      });

      return {
        success: true,
        message: `Image uploaded successfully from ${params.filePath}`,
        image: {
          blob: {
            type: 'blob',
            ref: response.data?.blob?.ref || '',
            mimeType: response.data?.blob?.mimeType || mimeType,
            size: response.data?.blob?.size || imageData.length,
          },
          alt: params.altText || '',
          aspectRatio: {
            width: 1,
            height: 1, // Default aspect ratio, would need image processing to get actual dimensions
          },
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

      // Read the video file
      const videoData = await readFile(params.filePath);
      const fileExtension = extname(params.filePath).toLowerCase();

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
            const captionData = await readFile(caption.file);
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
              file: captionResponse.data?.blob?.ref || '',
            });
          } catch (captionError) {
            this.logger.warn('Failed to upload caption', captionError as Error);
          }
        }
      }

      this.logger.info('Video uploaded successfully', {
        filePath: params.filePath,
        blobRef: response.data.blob.ref,
        size: response.data.blob.size,
        captionCount: processedCaptions?.length || 0,
      });

      return {
        success: true,
        message: `Video uploaded successfully from ${params.filePath}`,
        video: {
          blob: {
            type: 'blob',
            ref: response.data?.blob?.ref || '',
            mimeType: response.data?.blob?.mimeType || mimeType,
            size: response.data?.blob?.size || videoData.length,
          },
          alt: params.altText || '',
          aspectRatio: {
            width: 16,
            height: 9, // Default aspect ratio, would need video processing to get actual dimensions
          },
          captions: processedCaptions,
        },
      };
    } catch (error) {
      this.logger.error('Failed to upload video', error);
      this.formatError(error);
    }
  }
}

export class CreateRichTextPostTool extends BaseTool {
  public readonly schema = {
    method: 'create_rich_text_post',
    description:
      'Create a post with rich text formatting, including mentions, links, hashtags, and media embeds.',
    params: CreateRichTextPostSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'CreateRichTextPost');
  }

  protected async execute(params: {
    text: string;
    facets?: Array<{
      index: { byteStart: number; byteEnd: number };
      features: Array<{ type: string; value: string }>;
    }>;
    embed?: {
      type: string;
      images?: Array<{ image: string; alt: string }>;
      external?: { uri: string; title: string; description: string; thumb?: string };
      record?: { uri: string; cid: string };
    };
  }): Promise<{
    success: boolean;
    message: string;
    post: {
      uri: string;
      cid: string;
      text: string;
      facets?: any[];
      embed?: any;
      createdAt: string;
    };
  }> {
    try {
      this.logger.info('Creating rich text post', {
        textLength: params.text.length,
        hasFacets: !!params.facets?.length,
        hasEmbed: !!params.embed,
      });

      // Build the post record
      const postRecord: any = {
        text: params.text,
        createdAt: new Date().toISOString(),
      };

      // Add facets if provided
      if (params.facets && params.facets.length > 0) {
        postRecord.facets = params.facets.map(facet => ({
          index: facet.index,
          features: facet.features.map(feature => {
            switch (feature.type) {
              case 'mention':
                return {
                  $type: 'app.bsky.richtext.facet#mention',
                  did: feature.value,
                };
              case 'link':
                return {
                  $type: 'app.bsky.richtext.facet#link',
                  uri: feature.value,
                };
              case 'hashtag':
                return {
                  $type: 'app.bsky.richtext.facet#tag',
                  tag: feature.value,
                };
              default:
                return feature;
            }
          }),
        }));
      }

      // Add embed if provided
      if (params.embed) {
        switch (params.embed.type) {
          case 'images':
            if (params.embed.images) {
              postRecord.embed = {
                $type: 'app.bsky.embed.images',
                images: params.embed.images.map(img => ({
                  image: { $type: 'blob', ref: img.image },
                  alt: img.alt,
                })),
              };
            }
            break;
          case 'external':
            if (params.embed.external) {
              postRecord.embed = {
                $type: 'app.bsky.embed.external',
                external: {
                  uri: params.embed.external.uri,
                  title: params.embed.external.title,
                  description: params.embed.external.description,
                  thumb: params.embed.external.thumb
                    ? { $type: 'blob', ref: params.embed.external.thumb }
                    : undefined,
                },
              };
            }
            break;
          case 'record':
            if (params.embed.record) {
              postRecord.embed = {
                $type: 'app.bsky.embed.record',
                record: {
                  uri: params.embed.record.uri,
                  cid: params.embed.record.cid,
                },
              };
            }
            break;
        }
      }

      const response = await this.executeAtpOperation(
        async () => {
          const agent = this.atpClient.getAgent();
          return await agent.post(postRecord);
        },
        'createRichTextPost',
        { textLength: params.text.length, hasEmbed: !!params.embed }
      );

      this.logger.info('Rich text post created successfully', {
        uri: response.uri,
        cid: response.cid,
      });

      return {
        success: true,
        message: 'Rich text post created successfully',
        post: {
          uri: response.uri,
          cid: response.cid,
          text: params.text,
          facets: postRecord.facets,
          embed: postRecord.embed,
          createdAt: postRecord.createdAt,
        },
      };
    } catch (error) {
      this.logger.error('Failed to create rich text post', error);
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

      // Validate URL
      try {
        new URL(params.url);
      } catch {
        throw new Error('Invalid URL provided');
      }

      // Fetch the webpage content
      const response = await fetch(params.url, {
        headers: {
          'User-Agent': 'AT Protocol MCP Server/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();

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
          // Download and upload the thumbnail image
          const imageResponse = await fetch(imageUrl, {
            headers: {
              'User-Agent': 'AT Protocol MCP Server/1.0',
            },
          });

          if (imageResponse.ok) {
            const imageData = await imageResponse.arrayBuffer();
            const imageBuffer = Buffer.from(imageData);

            // Check image size (max 1MB)
            if (imageBuffer.length <= 1024 * 1024) {
              const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

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
                  ref: uploadResponse.data?.blob?.ref || '',
                  mimeType: uploadResponse.data?.blob?.mimeType || contentType,
                  size: uploadResponse.data?.blob?.size || imageBuffer.length,
                },
              };
            }
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
