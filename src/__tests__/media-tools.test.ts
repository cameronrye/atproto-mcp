/**
 * Unit tests for the media tools.
 *
 * These lock the on-the-wire shapes produced by:
 * - UploadImageTool       (src/tools/implementations/media-tools.ts)
 * - CreateRichTextPostTool(src/tools/implementations/media-tools.ts)
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
import { CreateRichTextPostTool, UploadImageTool } from '../tools/implementations/media-tools.js';
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

describe('CreateRichTextPostTool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts the text and maps a link facet to the on-the-wire app.bsky.richtext.facet#link shape', async () => {
    const post = vi.fn().mockResolvedValue({
      uri: 'at://did:plc:self/app.bsky.feed.post/abc',
      cid: 'cidpost',
    });
    const client = makeClient({ post });
    const tool = new CreateRichTextPostTool(client);

    const text = 'see https://example.com';
    const result = await tool.handler({
      text,
      facets: [
        {
          index: { byteStart: 4, byteEnd: 23 },
          features: [{ type: 'link', value: 'https://example.com' }],
        },
      ],
    });

    expect(post).toHaveBeenCalledTimes(1);
    const record = post.mock.calls[0][0];
    expect(record.text).toBe(text);
    expect(typeof record.createdAt).toBe('string');
    // The facets array is non-empty and the feature was mapped to the AT facet $type.
    expect(Array.isArray(record.facets)).toBe(true);
    expect(record.facets).toHaveLength(1);
    expect(record.facets[0].features[0]).toEqual({
      $type: 'app.bsky.richtext.facet#link',
      uri: 'https://example.com',
    });
    expect(record.facets[0].index).toEqual({ byteStart: 4, byteEnd: 23 });

    expect(result.success).toBe(true);
    expect(result.post).toEqual(
      expect.objectContaining({ uri: 'at://did:plc:self/app.bsky.feed.post/abc', cid: 'cidpost' })
    );
  });

  it('posts plain text with no facets when none are supplied', async () => {
    const post = vi.fn().mockResolvedValue({
      uri: 'at://did:plc:self/app.bsky.feed.post/plain',
      cid: 'cidplain',
    });
    const client = makeClient({ post });
    const tool = new CreateRichTextPostTool(client);

    await tool.handler({ text: 'just words' });

    const record = post.mock.calls[0][0];
    expect(record.text).toBe('just words');
    // facets is only attached when facets were provided; bare text -> undefined.
    expect(record.facets).toBeUndefined();
    expect(record.embed).toBeUndefined();
  });

  it('builds an app.bsky.embed.record embed from a record reference', async () => {
    const post = vi.fn().mockResolvedValue({
      uri: 'at://did:plc:self/app.bsky.feed.post/q',
      cid: 'cidq',
    });
    const client = makeClient({ post });
    const tool = new CreateRichTextPostTool(client);

    await tool.handler({
      text: 'quoting this',
      embed: {
        type: 'record',
        record: { uri: 'at://did:plc:other/app.bsky.feed.post/x', cid: 'cidx' },
      },
    });

    const record = post.mock.calls[0][0];
    expect(record.embed).toEqual({
      $type: 'app.bsky.embed.record',
      record: { uri: 'at://did:plc:other/app.bsky.feed.post/x', cid: 'cidx' },
    });
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
