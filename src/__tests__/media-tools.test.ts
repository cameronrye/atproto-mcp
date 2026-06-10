/**
 * Unit tests for the media tools.
 *
 * These lock the on-the-wire shapes produced by:
 * - UploadImageTool       (src/tools/implementations/media-tools.ts)
 * - ExtractMediaFromPostTool (src/tools/implementations/rich-media-tools.ts)
 *
 * The path-based tools read real files under mediaBaseDir() (ATPROTO_MEDIA_DIR
 * or cwd), guarded by assertSafePath. Each test that exercises a path creates a
 * real temp dir + file and points ATPROTO_MEDIA_DIR at it, so readFile succeeds
 * and traversal can be genuinely refused. generate_link_preview is intentionally
 * NOT tested here because it performs a real network fetch via safeFetch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UploadImageTool } from '../tools/implementations/media-tools.js';
import { ExtractMediaFromPostTool } from '../tools/implementations/rich-media-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

// Routes an operation the way the real AtpClient does: success -> { success,
// data }, throw -> { success: false, error } (BaseTool re-throws error).
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

describe('UploadImageTool', () => {
  let baseDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    baseDir = mkdtempSync(join(tmpdir(), 'atproto-media-'));
    process.env['ATPROTO_MEDIA_DIR'] = baseDir;
  });

  afterEach(() => {
    delete process.env['ATPROTO_MEDIA_DIR'];
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('derives image/jpeg from a .jpg extension and uploads the file buffer with that encoding', async () => {
    writeFileSync(join(baseDir, 'photo.jpg'), Buffer.from('fake-jpeg-bytes'));

    const uploadBlob = vi.fn().mockResolvedValue({
      data: { blob: { ref: { toString: () => 'bafkreijpg' }, mimeType: 'image/jpeg', size: 15 } },
    });
    const client = makeClient({ uploadBlob });
    const tool = new UploadImageTool(client);

    const result = await tool.handler({ filePath: 'photo.jpg', altText: 'a photo' });

    // The blob is uploaded with the MIME derived from the extension, and the
    // payload is the real file's bytes (not a string path).
    expect(uploadBlob).toHaveBeenCalledTimes(1);
    const [blobArg, optsArg] = uploadBlob.mock.calls[0];
    expect(Buffer.isBuffer(blobArg)).toBe(true);
    expect(blobArg.toString()).toBe('fake-jpeg-bytes');
    expect(optsArg).toEqual({ encoding: 'image/jpeg' });

    expect(result.success).toBe(true);
    expect(result.image.blob).toEqual(
      expect.objectContaining({ type: 'blob', ref: 'bafkreijpg', mimeType: 'image/jpeg', size: 15 })
    );
    expect(result.image.alt).toBe('a photo');
  });

  it('derives image/png from a .png extension', async () => {
    writeFileSync(join(baseDir, 'pic.png'), Buffer.from('fake-png'));

    const uploadBlob = vi.fn().mockResolvedValue({
      data: { blob: { ref: { toString: () => 'bafkreipng' }, mimeType: 'image/png', size: 8 } },
    });
    const client = makeClient({ uploadBlob });
    const tool = new UploadImageTool(client);

    const result = await tool.handler({ filePath: 'pic.png' });

    expect(uploadBlob.mock.calls[0][1]).toEqual({ encoding: 'image/png' });
    expect(result.image.blob.mimeType).toBe('image/png');
    // No altText provided -> empty string, never undefined.
    expect(result.image.alt).toBe('');
  });

  it('refuses a path that escapes the media base dir (path traversal) and never uploads', async () => {
    const uploadBlob = vi.fn();
    const client = makeClient({ uploadBlob });
    const tool = new UploadImageTool(client);

    // '../../etc/hosts' resolves outside baseDir; assertSafePath throws and the
    // error is surfaced (formatError wraps it but preserves the message).
    await expect(tool.handler({ filePath: '../../etc/hosts.jpg' })).rejects.toThrow(
      /outside the allowed directory/
    );
    expect(uploadBlob).not.toHaveBeenCalled();
  });

  it('rejects an unsupported file extension without uploading', async () => {
    writeFileSync(join(baseDir, 'doc.txt'), Buffer.from('not an image'));
    const uploadBlob = vi.fn();
    const client = makeClient({ uploadBlob });
    const tool = new UploadImageTool(client);

    await expect(tool.handler({ filePath: 'doc.txt' })).rejects.toThrow(/Unsupported image format/);
    expect(uploadBlob).not.toHaveBeenCalled();
  });
});

describe('ExtractMediaFromPostTool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the post embed via agent.getPostThread and extracts images with alt text', async () => {
    const uri = 'at://did:plc:author/app.bsky.feed.post/p1';
    const getPostThread = vi.fn().mockResolvedValue({
      data: {
        thread: {
          post: {
            uri,
            embed: {
              $type: 'app.bsky.embed.images#view',
              images: [
                {
                  fullsize: 'https://cdn.example.com/full.jpg',
                  thumb: 'https://cdn.example.com/thumb.jpg',
                  alt: 'a sunset',
                  aspectRatio: { width: 1200, height: 800 },
                },
              ],
            },
          },
        },
      },
    });
    // ENHANCED tool with an authenticated client uses executeAuthenticatedRequest.
    const client = makeClient({ getPostThread });
    const tool = new ExtractMediaFromPostTool(client);

    const result = await tool.handler({ uri });

    expect(getPostThread).toHaveBeenCalledWith(expect.objectContaining({ uri }));
    expect(result.success).toBe(true);
    expect(result.media.images).toHaveLength(1);
    expect(result.media.images[0]).toEqual(
      expect.objectContaining({
        uri: 'https://cdn.example.com/full.jpg',
        alt: 'a sunset',
        aspectRatio: { width: 1200, height: 800 },
      })
    );
    expect(result.media.videos).toHaveLength(0);
    expect(result.media.externalLinks).toHaveLength(0);
  });

  it('extracts an external link embed and works for an unauthenticated (public) caller', async () => {
    const uri = 'at://did:plc:author/app.bsky.feed.post/p2';
    const getPostThread = vi.fn().mockResolvedValue({
      data: {
        thread: {
          post: {
            uri,
            embed: {
              $type: 'app.bsky.embed.external#view',
              external: {
                uri: 'https://news.example.com/story',
                title: 'Headline',
                description: 'A description',
                thumb: 'https://news.example.com/thumb.jpg',
              },
            },
          },
        },
      },
    });
    const client = makeClient({ getPostThread }, { authenticated: false });
    const tool = new ExtractMediaFromPostTool(client);

    const result = await tool.handler({ uri });

    // Unauthenticated ENHANCED mode routes through executePublicRequest.
    expect(client.executePublicRequest as any).toHaveBeenCalled();
    expect(result.media.externalLinks).toHaveLength(1);
    expect(result.media.externalLinks[0]).toEqual(
      expect.objectContaining({
        uri: 'https://news.example.com/story',
        title: 'Headline',
        description: 'A description',
      })
    );
    expect(result.media.images).toHaveLength(0);
  });

  it('rejects a non-AT-URI before calling getPostThread', async () => {
    const getPostThread = vi.fn();
    const client = makeClient({ getPostThread });
    const tool = new ExtractMediaFromPostTool(client);

    await expect(tool.handler({ uri: 'https://example.com/not-at-uri' })).rejects.toThrow(
      /AT Protocol URI/
    );
    expect(getPostThread).not.toHaveBeenCalled();
  });
});
