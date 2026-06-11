/**
 * Unit tests for UploadVideoTool (media-tools.ts).
 *
 * These lock the upload contract: the MIME type is derived from the file
 * extension (.mp4/.mov/.webm only), the 50 MB size cap and the media-dir path
 * guard reject before any upload, the video buffer is uploaded with the
 * derived encoding, and caption tracks are uploaded as text/vtt blobs with
 * per-caption failures tolerated. Mirrors the real-file temp-dir pattern of
 * media-tools.test.ts (ATPROTO_MEDIA_DIR points at a temp dir so readFile and
 * assertSafePath behave genuinely).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UploadVideoTool } from '../tools/implementations/media-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

const wrap = async (op: () => unknown) => {
  try {
    return { success: true, data: await op() };
  } catch (error) {
    return { success: false, error };
  }
};

function makeClient(agent: any, opts: { authenticated?: boolean } = {}): AtpClient {
  return {
    getAgent: vi.fn().mockReturnValue(agent),
    isAuthenticated: vi.fn().mockReturnValue(opts.authenticated ?? true),
    hasCredentials: vi.fn().mockReturnValue(true),
    executeAuthenticatedRequest: vi.fn().mockImplementation(wrap),
    executePublicRequest: vi.fn().mockImplementation(wrap),
  } as unknown as AtpClient;
}

const blobResponse = (ref: string, mimeType: string, size: number) => ({
  data: { blob: { ref: { toString: () => ref }, mimeType, size } },
});

describe('UploadVideoTool', () => {
  let baseDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    baseDir = mkdtempSync(join(tmpdir(), 'atproto-video-'));
    process.env['ATPROTO_MEDIA_DIR'] = baseDir;
  });

  afterEach(() => {
    delete process.env['ATPROTO_MEDIA_DIR'];
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('derives video/mp4 from a .mp4 extension and uploads the file buffer with that encoding', async () => {
    writeFileSync(join(baseDir, 'clip.mp4'), Buffer.from('fake-mp4-bytes'));

    const uploadBlob = vi.fn().mockResolvedValue(blobResponse('bafkreivid', 'video/mp4', 14));
    const tool = new UploadVideoTool(makeClient({ uploadBlob }));

    const result = await tool.handler({ filePath: 'clip.mp4', altText: 'a clip' });

    expect(uploadBlob).toHaveBeenCalledTimes(1);
    const [blobArg, optsArg] = uploadBlob.mock.calls[0]!;
    expect(Buffer.isBuffer(blobArg)).toBe(true);
    expect(blobArg.toString()).toBe('fake-mp4-bytes');
    expect(optsArg).toEqual({ encoding: 'video/mp4' });

    expect(result.success).toBe(true);
    expect(result.video.blob).toEqual({
      type: 'blob',
      ref: 'bafkreivid',
      mimeType: 'video/mp4',
      size: 14,
    });
    expect(result.video.alt).toBe('a clip');
    // No aspect ratio is fabricated (the video is never decoded).
    expect(result.video).not.toHaveProperty('aspectRatio');
  });

  it('maps .mov to video/quicktime and .webm to video/webm', async () => {
    writeFileSync(join(baseDir, 'clip.mov'), Buffer.from('mov'));
    writeFileSync(join(baseDir, 'clip.webm'), Buffer.from('webm'));

    const uploadBlob = vi
      .fn()
      .mockResolvedValueOnce(blobResponse('bafkreimov', 'video/quicktime', 3))
      .mockResolvedValueOnce(blobResponse('bafkreiwebm', 'video/webm', 4));
    const tool = new UploadVideoTool(makeClient({ uploadBlob }));

    await tool.handler({ filePath: 'clip.mov' });
    await tool.handler({ filePath: 'clip.webm' });

    expect(uploadBlob.mock.calls[0]![1]).toEqual({ encoding: 'video/quicktime' });
    expect(uploadBlob.mock.calls[1]![1]).toEqual({ encoding: 'video/webm' });
  });

  it('defaults alt to an empty string when no altText is provided', async () => {
    writeFileSync(join(baseDir, 'clip.mp4'), Buffer.from('bytes'));
    const uploadBlob = vi.fn().mockResolvedValue(blobResponse('bafkreivid', 'video/mp4', 5));
    const tool = new UploadVideoTool(makeClient({ uploadBlob }));

    const result = await tool.handler({ filePath: 'clip.mp4' });

    expect(result.video.alt).toBe('');
  });

  it('rejects an unsupported video extension without uploading', async () => {
    writeFileSync(join(baseDir, 'clip.avi'), Buffer.from('avi-bytes'));
    const uploadBlob = vi.fn();
    const tool = new UploadVideoTool(makeClient({ uploadBlob }));

    await expect(tool.handler({ filePath: 'clip.avi' })).rejects.toThrow(
      /Unsupported video format/
    );
    expect(uploadBlob).not.toHaveBeenCalled();
  });

  it('rejects a video larger than 50MB without uploading', async () => {
    writeFileSync(join(baseDir, 'big.mp4'), Buffer.alloc(50 * 1024 * 1024 + 1));
    const uploadBlob = vi.fn();
    const tool = new UploadVideoTool(makeClient({ uploadBlob }));

    await expect(tool.handler({ filePath: 'big.mp4' })).rejects.toThrow(/cannot exceed 50MB/);
    expect(uploadBlob).not.toHaveBeenCalled();
  });

  it('refuses a path that escapes the media base dir (path traversal) and never uploads', async () => {
    const uploadBlob = vi.fn();
    const tool = new UploadVideoTool(makeClient({ uploadBlob }));

    await expect(tool.handler({ filePath: '../../etc/secret.mp4' })).rejects.toThrow(
      /outside the allowed directory/
    );
    expect(uploadBlob).not.toHaveBeenCalled();
  });

  it('uploads caption tracks as text/vtt blobs and returns their CIDs paired with the language', async () => {
    writeFileSync(join(baseDir, 'clip.mp4'), Buffer.from('video-bytes'));
    writeFileSync(join(baseDir, 'subs.vtt'), Buffer.from('WEBVTT'));

    const uploadBlob = vi
      .fn()
      .mockResolvedValueOnce(blobResponse('bafkreivid', 'video/mp4', 11))
      .mockResolvedValueOnce(blobResponse('bafkreicap', 'text/vtt', 6));
    const tool = new UploadVideoTool(makeClient({ uploadBlob }));

    const result = await tool.handler({
      filePath: 'clip.mp4',
      captions: [{ lang: 'en', file: 'subs.vtt' }],
    });

    expect(uploadBlob).toHaveBeenCalledTimes(2);
    const [captionBuffer, captionOpts] = uploadBlob.mock.calls[1]!;
    expect(captionBuffer.toString()).toBe('WEBVTT');
    expect(captionOpts).toEqual({ encoding: 'text/vtt' });

    expect(result.success).toBe(true);
    expect(result.video.captions).toEqual([{ lang: 'en', file: 'bafkreicap' }]);
  });

  it('tolerates a failed caption upload: the video still succeeds with that caption skipped', async () => {
    writeFileSync(join(baseDir, 'clip.mp4'), Buffer.from('video-bytes'));
    // 'missing.vtt' is never written, so the caption readFile fails.

    const uploadBlob = vi.fn().mockResolvedValue(blobResponse('bafkreivid', 'video/mp4', 11));
    const tool = new UploadVideoTool(makeClient({ uploadBlob }));

    const result = await tool.handler({
      filePath: 'clip.mp4',
      captions: [{ lang: 'en', file: 'missing.vtt' }],
    });

    // Only the video blob was uploaded; the failed caption is skipped, not fatal.
    expect(uploadBlob).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.video.captions).toEqual([]);
  });
});
