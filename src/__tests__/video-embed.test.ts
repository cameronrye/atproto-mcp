/**
 * create_post app.bsky.embed.video tests.
 *
 * upload_video returns the processed video blob descriptor ({ type: 'blob',
 * ref: '<cid>', mimeType, size }) plus caption descriptors. These tests lock
 * the contract that create_post accepts that descriptor verbatim under
 * embed.video, reshapes it into the lexicon blob form (via blobDescriptorToLex)
 * inside an app.bsky.embed.video record — including alt, aspectRatio and
 * caption tracks — and enforces the post-embed union (a video cannot be
 * combined with images, an external card, or a quote).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreatePostTool } from '../tools/implementations/create-post-tool.js';
import { ValidationError } from '../types/index.js';
import type { AtpClient } from '../utils/atp-client.js';

const SELF = 'did:plc:self';

// The descriptor shape upload_video returns (video.blob in its output).
const VIDEO_BLOB = {
  type: 'blob',
  ref: 'bafkreiprocessedvid',
  mimeType: 'video/mp4',
  size: 4321,
};

// The lexicon blob form that must end up inside the record.
const LEX_VIDEO_BLOB = {
  $type: 'blob',
  ref: { $link: 'bafkreiprocessedvid' },
  mimeType: 'video/mp4',
  size: 4321,
};

// A caption descriptor as upload_video returns it (video.captions[].file).
const CAPTION_BLOB = {
  type: 'blob',
  ref: 'bafkreicaption01',
  mimeType: 'text/vtt',
  size: 6,
};

const LEX_CAPTION_BLOB = {
  $type: 'blob',
  ref: { $link: 'bafkreicaption01' },
  mimeType: 'text/vtt',
  size: 6,
};

// An image descriptor, for the mutual-exclusion cases.
const IMAGE_BLOB = {
  type: 'blob',
  ref: 'bafkreiimage01',
  mimeType: 'image/jpeg',
  size: 100,
};

const wrap = async (op: () => unknown) => {
  try {
    return { success: true, data: await op() };
  } catch (error) {
    return { success: false, error };
  }
};

function createPostMockClient() {
  const post = vi.fn().mockResolvedValue({
    uri: `at://${SELF}/app.bsky.feed.post/created`,
    cid: 'bafycreated01',
  });
  const uploadBlob = vi.fn();

  const agent = {
    post,
    uploadBlob,
    session: { did: SELF },
  };

  const client = {
    getAgent: vi.fn().mockReturnValue(agent),
    isAuthenticated: vi.fn().mockReturnValue(true),
    hasCredentials: vi.fn().mockReturnValue(true),
    executeAuthenticatedRequest: vi.fn().mockImplementation(wrap),
    executePublicRequest: vi.fn().mockImplementation(wrap),
  } as unknown as AtpClient;

  return { client, post, uploadBlob };
}

describe('create_post with an embed.video descriptor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('embeds the descriptor as an app.bsky.embed.video lexicon record without re-uploading', async () => {
    const { client, post, uploadBlob } = createPostMockClient();
    const tool = new CreatePostTool(client);

    const result = await tool.handler({
      text: 'watch this',
      embed: { video: { video: VIDEO_BLOB } },
    });

    expect(result.success).toBe(true);
    // The processed blob already lives on the PDS — never re-upload it.
    expect(uploadBlob).not.toHaveBeenCalled();

    expect(post).toHaveBeenCalledTimes(1);
    const record = post.mock.calls[0]![0];
    // Optional fields that were not provided must be absent, not fabricated.
    expect(record.embed).toEqual({
      $type: 'app.bsky.embed.video',
      video: LEX_VIDEO_BLOB,
    });
  });

  it('wires alt, aspectRatio, and caption descriptors into the lexicon record', async () => {
    const { client, post } = createPostMockClient();
    const tool = new CreatePostTool(client);

    await tool.handler({
      text: 'captioned clip',
      embed: {
        video: {
          video: VIDEO_BLOB,
          alt: 'a demo clip',
          aspectRatio: { width: 16, height: 9 },
          captions: [{ lang: 'en', file: CAPTION_BLOB }],
        },
      },
    });

    const record = post.mock.calls[0]![0];
    expect(record.embed).toEqual({
      $type: 'app.bsky.embed.video',
      video: LEX_VIDEO_BLOB,
      alt: 'a demo clip',
      aspectRatio: { width: 16, height: 9 },
      captions: [{ lang: 'en', file: LEX_CAPTION_BLOB }],
    });
  });

  it('also accepts the lexicon { $link } ref form for the video blob', async () => {
    const { client, post } = createPostMockClient();
    const tool = new CreatePostTool(client);

    await tool.handler({
      text: 'lex form',
      embed: {
        video: {
          video: { ref: { $link: 'bafkreiprocessedvid' }, mimeType: 'video/mp4', size: 4321 },
        },
      },
    });

    const record = post.mock.calls[0]![0];
    expect(record.embed.video).toEqual(LEX_VIDEO_BLOB);
  });

  it('rejects a video combined with images (the post embed is a union)', async () => {
    const { client, post } = createPostMockClient();
    const tool = new CreatePostTool(client);

    await expect(
      tool.handler({
        text: 'both',
        embed: {
          video: { video: VIDEO_BLOB },
          images: [{ alt: 'pic', image: IMAGE_BLOB }],
        },
      })
    ).rejects.toThrow(/only one embed/);
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects a video combined with an external link card', async () => {
    const { client, post } = createPostMockClient();
    const tool = new CreatePostTool(client);

    await expect(
      tool.handler({
        text: 'both',
        embed: {
          video: { video: VIDEO_BLOB },
          external: { uri: 'https://example.com', title: 't', description: 'd' },
        },
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects a video combined with a quote', async () => {
    const { client, post } = createPostMockClient();
    const tool = new CreatePostTool(client);

    await expect(
      tool.handler({
        text: 'both',
        embed: { video: { video: VIDEO_BLOB } },
        quote: { uri: `at://${SELF}/app.bsky.feed.post/q`, cid: 'bafyquote01' },
      })
    ).rejects.toThrow(/only one embed/);
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects an embed.video without a video blob descriptor at the schema layer', async () => {
    const { client, post } = createPostMockClient();
    const tool = new CreatePostTool(client);

    await expect(
      tool.handler({ text: 'no blob', embed: { video: { alt: 'missing' } } })
    ).rejects.toThrow(/Invalid parameters/);
    expect(post).not.toHaveBeenCalled();
  });

  it('rejects more than 20 caption tracks (lexicon maxLength)', async () => {
    const { client, post } = createPostMockClient();
    const tool = new CreatePostTool(client);

    const captions = Array.from({ length: 21 }, (_, i) => ({
      lang: `l${i}`,
      file: CAPTION_BLOB,
    }));

    await expect(
      tool.handler({ text: 'too many', embed: { video: { video: VIDEO_BLOB, captions } } })
    ).rejects.toThrow(/Invalid parameters/);
    expect(post).not.toHaveBeenCalled();
  });
});
