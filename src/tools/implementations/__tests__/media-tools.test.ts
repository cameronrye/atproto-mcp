/**
 * Tests for Media Tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  UploadImageTool,
  UploadVideoTool,
  CreateRichTextPostTool,
  GenerateLinkPreviewTool,
} from '../media-tools.js';
import { AtpClient } from '../../../utils/atp-client.js';
import { ValidationError } from '../../../types/index.js';
import { readFile } from 'fs/promises';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

// Mock AtpClient
vi.mock('../../../utils/atp-client.js');

describe('UploadImageTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: UploadImageTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      uploadBlob: vi.fn(),
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    tool = new UploadImageTool(mockAtpClient);
    vi.clearAllMocks();
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('upload_image');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('image');
    });

    it('should require authentication', () => {
      mockAtpClient.isAuthenticated.mockReturnValue(false);
      expect(tool.isAvailable()).toBe(false);
    });
  });

  describe('Parameter Validation', () => {
    it('should reject empty file path', async () => {
      await expect(tool.handler({ filePath: '' })).rejects.toThrow(ValidationError);
    });

    it('should accept alt text up to 1000 characters', async () => {
      const altText = 'a'.repeat(1000);

      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      (readFile as any).mockResolvedValue(Buffer.from('fake-image-data'));

      mockAgent.uploadBlob.mockResolvedValue({
        data: {
          blob: {
            ref: 'bafyimage123',
            mimeType: 'image/jpeg',
            size: 1024,
          },
        },
      });

      const result = await tool.handler({ filePath: '/path/to/image.jpg', altText });
      expect(result.success).toBe(true);
    });

    it('should reject alt text over 1000 characters', async () => {
      const longAltText = 'a'.repeat(1001);
      await expect(
        tool.handler({ filePath: '/path/to/image.jpg', altText: longAltText })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Upload Image', () => {
    it('should upload JPEG image successfully', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      (readFile as any).mockResolvedValue(Buffer.from('fake-jpeg-data'));

      mockAgent.uploadBlob.mockResolvedValue({
        data: {
          blob: {
            ref: 'bafyimage123',
            mimeType: 'image/jpeg',
            size: 1024,
          },
        },
      });

      const result = await tool.handler({
        filePath: '/path/to/image.jpg',
        altText: 'Test image',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('uploaded successfully');
      expect(result.image.blob.ref).toBe('bafyimage123');
      expect(result.image.alt).toBe('Test image');
      expect(mockAgent.uploadBlob).toHaveBeenCalledWith(expect.any(Buffer), {
        encoding: 'image/jpeg',
      });
    });

    it('should support PNG format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      (readFile as any).mockResolvedValue(Buffer.from('fake-png-data'));

      mockAgent.uploadBlob.mockResolvedValue({
        data: {
          blob: {
            ref: 'bafyimage456',
            mimeType: 'image/png',
            size: 2048,
          },
        },
      });

      const result = await tool.handler({ filePath: '/path/to/image.png' });

      expect(result.success).toBe(true);
      expect(mockAgent.uploadBlob).toHaveBeenCalledWith(expect.any(Buffer), {
        encoding: 'image/png',
      });
    });

    it('should support GIF format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      (readFile as any).mockResolvedValue(Buffer.from('fake-gif-data'));

      mockAgent.uploadBlob.mockResolvedValue({
        data: {
          blob: {
            ref: 'bafyimage789',
            mimeType: 'image/gif',
            size: 512,
          },
        },
      });

      const result = await tool.handler({ filePath: '/path/to/image.gif' });

      expect(result.success).toBe(true);
      expect(mockAgent.uploadBlob).toHaveBeenCalledWith(expect.any(Buffer), {
        encoding: 'image/gif',
      });
    });

    it('should support WebP format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      (readFile as any).mockResolvedValue(Buffer.from('fake-webp-data'));

      mockAgent.uploadBlob.mockResolvedValue({
        data: {
          blob: {
            ref: 'bafyimageabc',
            mimeType: 'image/webp',
            size: 768,
          },
        },
      });

      const result = await tool.handler({ filePath: '/path/to/image.webp' });

      expect(result.success).toBe(true);
      expect(mockAgent.uploadBlob).toHaveBeenCalledWith(expect.any(Buffer), {
        encoding: 'image/webp',
      });
    });

    it('should reject unsupported image format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      (readFile as any).mockResolvedValue(Buffer.from('fake-data'));

      await expect(tool.handler({ filePath: '/path/to/image.bmp' })).rejects.toThrow(
        'Unsupported image format'
      );
    });

    it('should reject image over 1MB', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      // Create a buffer larger than 1MB
      const largeBuffer = Buffer.alloc(1024 * 1024 + 1);
      (readFile as any).mockResolvedValue(largeBuffer);

      await expect(tool.handler({ filePath: '/path/to/large-image.jpg' })).rejects.toThrow(
        'Image file size cannot exceed 1MB'
      );
    });

    it('should handle file read error', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      (readFile as any).mockRejectedValue(new Error('File not found'));

      await expect(tool.handler({ filePath: '/nonexistent/image.jpg' })).rejects.toThrow();
    });

    it('should handle upload failure', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      (readFile as any).mockResolvedValue(Buffer.from('fake-data'));

      mockAgent.uploadBlob.mockRejectedValue(new Error('Upload failed'));

      await expect(tool.handler({ filePath: '/path/to/image.jpg' })).rejects.toThrow();
    });
  });
});

describe('UploadVideoTool', () => {
  let mockAtpClient: any;
  let mockAgent: any;
  let tool: UploadVideoTool;

  beforeEach(() => {
    mockAgent = {
      session: { did: 'did:plc:test123' },
      uploadBlob: vi.fn(),
    };

    mockAtpClient = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasCredentials: vi.fn().mockReturnValue(true),
      executePublicRequest: vi.fn(),
      executeAuthenticatedRequest: vi.fn(),
      getAgent: vi.fn().mockReturnValue(mockAgent),
    };

    tool = new UploadVideoTool(mockAtpClient);
    vi.clearAllMocks();
  });

  describe('Schema Validation', () => {
    it('should have correct method name', () => {
      expect(tool.schema.method).toBe('upload_video');
    });

    it('should have description', () => {
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.description).toContain('video');
    });
  });

  describe('Upload Video', () => {
    it('should upload MP4 video successfully', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      (readFile as any).mockResolvedValue(Buffer.from('fake-mp4-data'));

      mockAgent.uploadBlob.mockResolvedValue({
        data: {
          blob: {
            ref: 'bafyvideo123',
            mimeType: 'video/mp4',
            size: 10240,
          },
        },
      });

      const result = await tool.handler({
        filePath: '/path/to/video.mp4',
        altText: 'Test video',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('uploaded successfully');
      expect(result.video.blob.ref).toBe('bafyvideo123');
      expect(result.video.alt).toBe('Test video');
      expect(mockAgent.uploadBlob).toHaveBeenCalledWith(expect.any(Buffer), {
        encoding: 'video/mp4',
      });
    });

    it('should support MOV format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      (readFile as any).mockResolvedValue(Buffer.from('fake-mov-data'));

      mockAgent.uploadBlob.mockResolvedValue({
        data: {
          blob: {
            ref: 'bafyvideo456',
            mimeType: 'video/quicktime',
            size: 20480,
          },
        },
      });

      const result = await tool.handler({ filePath: '/path/to/video.mov' });

      expect(result.success).toBe(true);
      expect(mockAgent.uploadBlob).toHaveBeenCalledWith(expect.any(Buffer), {
        encoding: 'video/quicktime',
      });
    });

    it('should support WebM format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      (readFile as any).mockResolvedValue(Buffer.from('fake-webm-data'));

      mockAgent.uploadBlob.mockResolvedValue({
        data: {
          blob: {
            ref: 'bafyvideo789',
            mimeType: 'video/webm',
            size: 15360,
          },
        },
      });

      const result = await tool.handler({ filePath: '/path/to/video.webm' });

      expect(result.success).toBe(true);
      expect(mockAgent.uploadBlob).toHaveBeenCalledWith(expect.any(Buffer), {
        encoding: 'video/webm',
      });
    });

    it('should reject unsupported video format', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      (readFile as any).mockResolvedValue(Buffer.from('fake-data'));

      await expect(tool.handler({ filePath: '/path/to/video.avi' })).rejects.toThrow(
        'Unsupported video format'
      );
    });

    it('should reject video over 50MB', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      // Create a buffer larger than 50MB
      const largeBuffer = Buffer.alloc(50 * 1024 * 1024 + 1);
      (readFile as any).mockResolvedValue(largeBuffer);

      await expect(tool.handler({ filePath: '/path/to/large-video.mp4' })).rejects.toThrow(
        'Video file size cannot exceed 50MB'
      );
    });

    it('should upload video with captions', async () => {
      mockAtpClient.executeAuthenticatedRequest.mockImplementation(async fn => ({
        success: true,
        data: await fn(),
      }));

      (readFile as any)
        .mockResolvedValueOnce(Buffer.from('fake-video-data'))
        .mockResolvedValueOnce(Buffer.from('fake-caption-data'));

      mockAgent.uploadBlob
        .mockResolvedValueOnce({
          data: {
            blob: {
              ref: 'bafyvideo123',
              mimeType: 'video/mp4',
              size: 10240,
            },
          },
        })
        .mockResolvedValueOnce({
          data: {
            blob: {
              ref: 'bafycaption123',
              mimeType: 'text/vtt',
              size: 512,
            },
          },
        });

      const result = await tool.handler({
        filePath: '/path/to/video.mp4',
        captions: [{ lang: 'en', file: '/path/to/captions.vtt' }],
      });

      expect(result.success).toBe(true);
      expect(result.video.captions).toHaveLength(1);
      expect(result.video.captions?.[0].lang).toBe('en');
      expect(mockAgent.uploadBlob).toHaveBeenCalledTimes(2);
    });
  });
});
