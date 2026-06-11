/**
 * End-to-end blob-descriptor handoff tests.
 *
 * upload_image returns a JSON blob descriptor ({ type: 'blob', ref: '<cid>',
 * mimeType, size }) — MCP params arrive as JSON, so a binary JS Blob can never
 * be transported. These tests lock the contract that create_post,
 * update_profile, and analyze_image accept that descriptor verbatim and
 * reference the ALREADY-uploaded blob (lexicon form
 * { $type: 'blob', ref: { $link: <cid> }, mimeType, size }) instead of calling
 * agent.uploadBlob again with garbage.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreatePostTool } from '../tools/implementations/create-post-tool.js';
import { UpdateProfileTool } from '../tools/implementations/content-management-tools.js';
import { AnalyzeImageTool } from '../tools/implementations/rich-media-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

// The descriptor shape upload_image actually returns (image.blob in its output).
const UPLOADED_BLOB = {
  type: 'blob',
  ref: 'bafkreiuploadedimg01',
  mimeType: 'image/jpeg',
  size: 4321,
};

// The lexicon blob form that must end up inside the record.
const LEX_BLOB = {
  $type: 'blob',
  ref: { $link: 'bafkreiuploadedimg01' },
  mimeType: 'image/jpeg',
  size: 4321,
};

// Wrap an operation the way AtpClient.executeAuthenticatedRequest does.
const wrap = async (op: () => unknown) => {
  try {
    return { success: true, data: await op() };
  } catch (error) {
    return { success: false, error };
  }
};

function createPostMockClient() {
  const post = vi.fn().mockResolvedValue({
    uri: 'at://did:plc:self/app.bsky.feed.post/created',
    cid: 'bafycreated01',
  });
  const uploadBlob = vi.fn();

  const agent = {
    post,
    uploadBlob,
    session: { did: 'did:plc:self' },
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

function createProfileMockClient() {
  const getRecord = vi
    .fn()
    .mockResolvedValue({ data: { value: { displayName: 'Old' }, cid: 'cidA' } });
  const putRecord = vi.fn().mockResolvedValue({ data: { uri: 'at://x', cid: 'cidB' } });
  const uploadBlob = vi.fn();

  const agent = {
    session: { did: 'did:plc:self' },
    uploadBlob,
    com: { atproto: { repo: { getRecord, putRecord } } },
  };

  const client = {
    getAgent: vi.fn().mockReturnValue(agent),
    isAuthenticated: vi.fn().mockReturnValue(true),
    hasCredentials: vi.fn().mockReturnValue(true),
    executeAuthenticatedRequest: vi.fn().mockImplementation(wrap),
    executePublicRequest: vi.fn().mockImplementation(wrap),
  } as unknown as AtpClient;

  return { client, putRecord, uploadBlob };
}

describe('create_post with a pre-uploaded blob descriptor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('embeds the descriptor (flat string ref) as a lexicon blob without calling agent.uploadBlob', async () => {
    const { client, post, uploadBlob } = createPostMockClient();
    const tool = new CreatePostTool(client);

    const result = await tool.handler({
      text: 'look at this photo',
      embed: { images: [{ alt: 'a photo', image: UPLOADED_BLOB }] },
    });

    expect(result.success).toBe(true);
    // The blob is already on the PDS — it must NOT be uploaded again.
    expect(uploadBlob).not.toHaveBeenCalled();

    expect(post).toHaveBeenCalledTimes(1);
    const record = post.mock.calls[0]![0];
    expect(record.embed).toEqual({
      $type: 'app.bsky.embed.images',
      images: [{ alt: 'a photo', image: LEX_BLOB }],
    });
  });

  it('also accepts the lexicon { $link } ref form', async () => {
    const { client, post, uploadBlob } = createPostMockClient();
    const tool = new CreatePostTool(client);

    await tool.handler({
      text: 'photo again',
      embed: {
        images: [
          {
            alt: 'same photo',
            image: { ref: { $link: 'bafkreiuploadedimg01' }, mimeType: 'image/jpeg', size: 4321 },
          },
        ],
      },
    });

    expect(uploadBlob).not.toHaveBeenCalled();
    const record = post.mock.calls[0]![0];
    expect(record.embed.images[0]!.image).toEqual(LEX_BLOB);
  });
});

describe('update_profile with pre-uploaded blob descriptors', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets avatar and banner to lexicon blobs without calling agent.uploadBlob', async () => {
    const { client, putRecord, uploadBlob } = createProfileMockClient();
    const tool = new UpdateProfileTool(client);

    const banner = {
      type: 'blob',
      ref: 'bafkreibannerblob01',
      mimeType: 'image/png',
      size: 999,
    };

    const result = await tool.handler({ avatar: UPLOADED_BLOB, banner });

    expect(result.success).toBe(true);
    expect(result.updatedFields).toEqual(expect.arrayContaining(['avatar', 'banner']));
    expect(uploadBlob).not.toHaveBeenCalled();

    expect(putRecord).toHaveBeenCalledTimes(1);
    const record = putRecord.mock.calls[0]![0].record;
    expect(record.avatar).toEqual(LEX_BLOB);
    expect(record.banner).toEqual({
      $type: 'blob',
      ref: { $link: 'bafkreibannerblob01' },
      mimeType: 'image/png',
      size: 999,
    });
  });
});

describe('analyze_image with the upload_image output descriptor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts a flat string ref (upload_image output verbatim)', async () => {
    const tool = new AnalyzeImageTool({} as unknown as AtpClient);

    const result = await tool.handler({
      blob: { type: 'blob', ref: 'bafkreiuploadedimg01', mimeType: 'image/png', size: 2048 },
      includeOptimizationSuggestions: false,
    });

    expect(result.success).toBe(true);
    expect(result.analysis).toMatchObject({ mimeType: 'image/png', size: 2048, format: 'png' });
  });

  it('still accepts the lexicon { $link } ref form', async () => {
    const tool = new AnalyzeImageTool({} as unknown as AtpClient);

    const result = await tool.handler({
      blob: { ref: { $link: 'bafkreiuploadedimg01' }, mimeType: 'image/webp', size: 1024 },
      includeOptimizationSuggestions: false,
    });

    expect(result.success).toBe(true);
    expect(result.analysis.format).toBe('webp');
  });
});
