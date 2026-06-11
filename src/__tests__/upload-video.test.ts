/**
 * Unit tests for UploadVideoTool (media-tools.ts) — the app.bsky.video flow.
 *
 * Real Bluesky video does NOT go through plain agent.uploadBlob (the PDS blob
 * cap would reject most videos and the raw blob never becomes playable): the
 * official flow is (1) preflight app.bsky.video.getUploadLimits with a
 * service-auth token minted for did:web:video.bsky.app, (2) POST the bytes to
 * https://video.bsky.app/xrpc/app.bsky.video.uploadVideo?did=<did>&name=<file>
 * with a service-auth token minted for the user's own PDS
 * (aud did:web:<pds host>, lxm com.atproto.repo.uploadBlob), then (3) poll
 * app.bsky.video.getJobStatus until JOB_STATE_COMPLETED yields the processed
 * blob. These tests lock that contract, the local guards (extension map,
 * 100 MB service cap, media-dir path guard), the caption blob handling
 * (text/vtt via agent.uploadBlob, 20 kB lexicon cap, per-caption tolerance),
 * and the upload_image-shaped descriptor output that create_post embed.video
 * consumes.
 *
 * Mirrors the real-file temp-dir pattern of media-tools.test.ts; the video
 * service HTTP calls are stubbed via vi.stubGlobal('fetch', …).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UploadVideoTool } from '../tools/implementations/media-tools.js';
import type { AtpClient } from '../utils/atp-client.js';

const SELF = 'did:plc:self';

const wrap = async (op: () => unknown) => {
  try {
    return { success: true, data: await op() };
  } catch (error) {
    return { success: false, error };
  }
};

/** Lexicon form of the processed blob the video service hands back as JSON. */
const LEX_VIDEO_BLOB = {
  $type: 'blob',
  ref: { $link: 'bafkreiprocessed' },
  mimeType: 'video/mp4',
  size: 999,
};

/** The descriptor shape upload_image returns — embed.video consumes the same. */
const PROCESSED_DESCRIPTOR = {
  type: 'blob',
  ref: 'bafkreiprocessed',
  mimeType: 'video/mp4',
  size: 999,
};

function makeAgent(overrides: Record<string, unknown> = {}) {
  const getServiceAuth = vi.fn().mockImplementation(async ({ lxm }: { lxm: string }) => ({
    data: { token: lxm === 'app.bsky.video.getUploadLimits' ? 'limits-token' : 'upload-token' },
  }));
  const uploadBlob = vi.fn();
  const agent = {
    session: { did: SELF },
    dispatchUrl: new URL('https://pds.example.com/'),
    uploadBlob,
    com: { atproto: { server: { getServiceAuth } } },
    ...overrides,
  };
  return { agent, getServiceAuth, uploadBlob };
}

function makeClient(agent: unknown): AtpClient {
  return {
    getAgent: vi.fn().mockReturnValue(agent),
    isAuthenticated: vi.fn().mockReturnValue(true),
    hasCredentials: vi.fn().mockReturnValue(true),
    executeAuthenticatedRequest: vi.fn().mockImplementation(wrap),
    executePublicRequest: vi.fn().mockImplementation(wrap),
  } as unknown as AtpClient;
}

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

interface IRecordedCall {
  url: URL;
  init: { method?: string; headers?: Record<string, string>; body?: Uint8Array } | undefined;
}

/**
 * Stub global fetch with a router for the three video-service endpoints.
 * `jobStatus` is called with the 1-based poll attempt number.
 */
function stubVideoService(handlers: {
  limits?: ReturnType<typeof jsonResponse>;
  upload?: ReturnType<typeof jsonResponse>;
  jobStatus?: (attempt: number) => ReturnType<typeof jsonResponse>;
}) {
  const calls: IRecordedCall[] = [];
  let pollAttempts = 0;
  const fetchMock = vi.fn().mockImplementation(async (input: unknown, init?: unknown) => {
    const url = new URL(String(input));
    calls.push({ url, init: init as IRecordedCall['init'] });
    if (url.pathname.endsWith('app.bsky.video.getUploadLimits')) {
      return (
        handlers.limits ??
        jsonResponse({
          canUpload: true,
          remainingDailyVideos: 10,
          remainingDailyBytes: 10_000_000_000,
        })
      );
    }
    if (url.pathname.endsWith('app.bsky.video.uploadVideo')) {
      if (!handlers.upload) throw new Error('Unexpected uploadVideo call');
      return handlers.upload;
    }
    if (url.pathname.endsWith('app.bsky.video.getJobStatus')) {
      if (!handlers.jobStatus) throw new Error('Unexpected getJobStatus call');
      pollAttempts += 1;
      return handlers.jobStatus(pollAttempts);
    }
    throw new Error(`Unexpected fetch: ${url.toString()}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  const callsTo = (nsid: string) => calls.filter(c => c.url.pathname.endsWith(nsid));
  return { fetchMock, calls, callsTo };
}

/** Build the tool with poll knobs tightened so tests never sleep for real. */
function makeTool(agent: unknown): UploadVideoTool {
  const tool = new UploadVideoTool(makeClient(agent));
  (tool as unknown as { jobPollIntervalMs: number }).jobPollIntervalMs = 0;
  return tool;
}

describe('UploadVideoTool (app.bsky.video service flow)', () => {
  let baseDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    baseDir = mkdtempSync(join(tmpdir(), 'atproto-video-'));
    process.env['ATPROTO_MEDIA_DIR'] = baseDir;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env['ATPROTO_MEDIA_DIR'];
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('runs the full flow: limits preflight, service-auth upload, polling, processed descriptor + jobId', async () => {
    writeFileSync(join(baseDir, 'clip.mp4'), Buffer.from('fake-mp4-bytes'));
    const { agent, getServiceAuth, uploadBlob } = makeAgent();
    const { callsTo } = stubVideoService({
      upload: jsonResponse({
        jobStatus: { jobId: 'job1', did: SELF, state: 'JOB_STATE_ENCODING' },
      }),
      jobStatus: attempt =>
        attempt < 2
          ? jsonResponse({
              jobStatus: { jobId: 'job1', did: SELF, state: 'JOB_STATE_ENCODING', progress: 50 },
            })
          : jsonResponse({
              jobStatus: {
                jobId: 'job1',
                did: SELF,
                state: 'JOB_STATE_COMPLETED',
                blob: LEX_VIDEO_BLOB,
              },
            }),
    });
    const tool = makeTool(agent);

    const result = await tool.handler({ filePath: 'clip.mp4', altText: 'a clip' });

    // Two service-auth tokens, each with the official aud/lxm convention.
    expect(getServiceAuth).toHaveBeenCalledTimes(2);
    expect(getServiceAuth.mock.calls[0]![0]).toEqual({
      aud: 'did:web:video.bsky.app',
      lxm: 'app.bsky.video.getUploadLimits',
    });
    expect(getServiceAuth.mock.calls[1]![0]).toEqual({
      aud: 'did:web:pds.example.com',
      lxm: 'com.atproto.repo.uploadBlob',
      exp: expect.any(Number),
    });

    // Limits preflight hits the video service with its token.
    const [limitsCall] = callsTo('app.bsky.video.getUploadLimits');
    expect(limitsCall!.url.origin).toBe('https://video.bsky.app');
    expect(limitsCall!.init?.headers).toMatchObject({ Authorization: 'Bearer limits-token' });

    // The upload POSTs the raw bytes to video.bsky.app with did+name params.
    const [uploadCall] = callsTo('app.bsky.video.uploadVideo');
    expect(uploadCall!.url.origin).toBe('https://video.bsky.app');
    expect(uploadCall!.url.searchParams.get('did')).toBe(SELF);
    expect(uploadCall!.url.searchParams.get('name')).toBe('clip.mp4');
    expect(uploadCall!.init?.method).toBe('POST');
    expect(uploadCall!.init?.headers).toMatchObject({
      Authorization: 'Bearer upload-token',
      'Content-Type': 'video/mp4',
    });
    expect(uploadCall!.init?.body).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(uploadCall!.init!.body!).toString()).toBe('fake-mp4-bytes');

    // Polling used the returned jobId.
    const polls = callsTo('app.bsky.video.getJobStatus');
    expect(polls).toHaveLength(2);
    expect(polls[0]!.url.searchParams.get('jobId')).toBe('job1');

    // The PROCESSED blob (not the input bytes) comes back in the same
    // descriptor shape upload_image returns, plus the jobId.
    expect(result.success).toBe(true);
    expect(result.video.blob).toEqual(PROCESSED_DESCRIPTOR);
    expect(result.video.jobId).toBe('job1');
    expect(result.video.alt).toBe('a clip');
    // The video must never be uploaded as a plain PDS blob.
    expect(uploadBlob).not.toHaveBeenCalled();
  });

  it('skips polling when the upload response is already JOB_STATE_COMPLETED', async () => {
    writeFileSync(join(baseDir, 'clip.mp4'), Buffer.from('bytes'));
    const { agent } = makeAgent();
    const { callsTo } = stubVideoService({
      upload: jsonResponse({
        jobStatus: { jobId: 'job2', did: SELF, state: 'JOB_STATE_COMPLETED', blob: LEX_VIDEO_BLOB },
      }),
    });
    const tool = makeTool(agent);

    const result = await tool.handler({ filePath: 'clip.mp4' });

    expect(callsTo('app.bsky.video.getJobStatus')).toHaveLength(0);
    expect(result.video.blob).toEqual(PROCESSED_DESCRIPTOR);
    expect(result.video.jobId).toBe('job2');
  });

  it('recovers when the service answers already_exists for previously-uploaded bytes', async () => {
    writeFileSync(join(baseDir, 'clip.mp4'), Buffer.from('bytes'));
    const { agent } = makeAgent();
    stubVideoService({
      // The video service returns HTTP 409 with the existing job's status.
      upload: jsonResponse(
        {
          jobId: 'job9',
          did: SELF,
          state: 'JOB_STATE_COMPLETED',
          blob: LEX_VIDEO_BLOB,
          error: 'already_exists',
          message: 'Video already processed',
        },
        409
      ),
    });
    const tool = makeTool(agent);

    const result = await tool.handler({ filePath: 'clip.mp4' });

    expect(result.success).toBe(true);
    expect(result.video.blob).toEqual(PROCESSED_DESCRIPTOR);
    expect(result.video.jobId).toBe('job9');
  });

  it('fails the preflight clearly when the account cannot upload videos, without uploading', async () => {
    writeFileSync(join(baseDir, 'clip.mp4'), Buffer.from('bytes'));
    const { agent } = makeAgent();
    const { callsTo } = stubVideoService({
      limits: jsonResponse({ canUpload: false, message: 'account does not meet requirements' }),
    });
    const tool = makeTool(agent);

    await expect(tool.handler({ filePath: 'clip.mp4' })).rejects.toThrow(
      /account does not meet requirements/
    );
    expect(callsTo('app.bsky.video.uploadVideo')).toHaveLength(0);
  });

  it('fails the preflight when the remaining daily byte quota is smaller than the file', async () => {
    writeFileSync(join(baseDir, 'clip.mp4'), Buffer.from('fourteen-bytes'));
    const { agent } = makeAgent();
    const { callsTo } = stubVideoService({
      limits: jsonResponse({ canUpload: true, remainingDailyVideos: 5, remainingDailyBytes: 5 }),
    });
    const tool = makeTool(agent);

    await expect(tool.handler({ filePath: 'clip.mp4' })).rejects.toThrow(/only 5 bytes remain/);
    expect(callsTo('app.bsky.video.uploadVideo')).toHaveLength(0);
  });

  it('fails the preflight when no daily videos remain', async () => {
    writeFileSync(join(baseDir, 'clip.mp4'), Buffer.from('bytes'));
    const { agent } = makeAgent();
    const { callsTo } = stubVideoService({
      limits: jsonResponse({
        canUpload: true,
        remainingDailyVideos: 0,
        remainingDailyBytes: 10_000,
      }),
    });
    const tool = makeTool(agent);

    await expect(tool.handler({ filePath: 'clip.mp4' })).rejects.toThrow(/no videos remaining/i);
    expect(callsTo('app.bsky.video.uploadVideo')).toHaveLength(0);
  });

  it('fails with the job error when processing ends in JOB_STATE_FAILED', async () => {
    writeFileSync(join(baseDir, 'clip.mp4'), Buffer.from('bytes'));
    const { agent } = makeAgent();
    stubVideoService({
      upload: jsonResponse({
        jobStatus: { jobId: 'job1', did: SELF, state: 'JOB_STATE_ENCODING' },
      }),
      jobStatus: () =>
        jsonResponse({
          jobStatus: {
            jobId: 'job1',
            did: SELF,
            state: 'JOB_STATE_FAILED',
            error: 'unsupported codec',
          },
        }),
    });
    const tool = makeTool(agent);

    await expect(tool.handler({ filePath: 'clip.mp4' })).rejects.toThrow(/unsupported codec/);
  });

  it('times out with a clear error when the job never completes', async () => {
    writeFileSync(join(baseDir, 'clip.mp4'), Buffer.from('bytes'));
    const { agent } = makeAgent();
    stubVideoService({
      upload: jsonResponse({
        jobStatus: { jobId: 'job1', did: SELF, state: 'JOB_STATE_ENCODING' },
      }),
      jobStatus: () =>
        jsonResponse({ jobStatus: { jobId: 'job1', did: SELF, state: 'JOB_STATE_ENCODING' } }),
    });
    const tool = makeTool(agent);
    (tool as unknown as { jobPollTimeoutMs: number }).jobPollTimeoutMs = 0;

    await expect(tool.handler({ filePath: 'clip.mp4' })).rejects.toThrow(/timed out/i);
  });

  it('requires an authenticated session DID before contacting the video service', async () => {
    writeFileSync(join(baseDir, 'clip.mp4'), Buffer.from('bytes'));
    const { agent } = makeAgent({ session: undefined });
    const { fetchMock } = stubVideoService({});
    const tool = makeTool(agent);

    await expect(tool.handler({ filePath: 'clip.mp4' })).rejects.toThrow(/authenticated session/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('derives the upload Content-Type from the extension (.mov and .webm)', async () => {
    writeFileSync(join(baseDir, 'clip.mov'), Buffer.from('mov'));
    writeFileSync(join(baseDir, 'clip.webm'), Buffer.from('webm'));
    const { agent } = makeAgent();
    const { callsTo } = stubVideoService({
      upload: jsonResponse({
        jobStatus: { jobId: 'jobX', did: SELF, state: 'JOB_STATE_COMPLETED', blob: LEX_VIDEO_BLOB },
      }),
    });
    const tool = makeTool(agent);

    await tool.handler({ filePath: 'clip.mov' });
    await tool.handler({ filePath: 'clip.webm' });

    const uploads = callsTo('app.bsky.video.uploadVideo');
    expect(uploads[0]!.init?.headers).toMatchObject({ 'Content-Type': 'video/quicktime' });
    expect(uploads[1]!.init?.headers).toMatchObject({ 'Content-Type': 'video/webm' });
  });

  it('rejects an unsupported video extension before any network call', async () => {
    writeFileSync(join(baseDir, 'clip.avi'), Buffer.from('avi-bytes'));
    const { agent, getServiceAuth } = makeAgent();
    const { fetchMock } = stubVideoService({});
    const tool = makeTool(agent);

    await expect(tool.handler({ filePath: 'clip.avi' })).rejects.toThrow(
      /Unsupported video format/
    );
    expect(getServiceAuth).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a video larger than the 100 MB service limit before any network call', async () => {
    writeFileSync(join(baseDir, 'big.mp4'), Buffer.alloc(100_000_001));
    const { agent } = makeAgent();
    const { fetchMock } = stubVideoService({});
    const tool = makeTool(agent);

    await expect(tool.handler({ filePath: 'big.mp4' })).rejects.toThrow(/cannot exceed 100 ?MB/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a path that escapes the media base dir (path traversal) and never uploads', async () => {
    const { agent } = makeAgent();
    const { fetchMock } = stubVideoService({});
    const tool = makeTool(agent);

    await expect(tool.handler({ filePath: '../../etc/secret.mp4' })).rejects.toThrow(
      /outside the allowed directory/
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uploads caption tracks as text/vtt PDS blobs and returns full blob descriptors', async () => {
    writeFileSync(join(baseDir, 'clip.mp4'), Buffer.from('video-bytes'));
    writeFileSync(join(baseDir, 'subs.vtt'), Buffer.from('WEBVTT'));
    const { agent, uploadBlob } = makeAgent();
    uploadBlob.mockResolvedValue({
      data: { blob: { ref: { toString: () => 'bafkreicap' }, mimeType: 'text/vtt', size: 6 } },
    });
    stubVideoService({
      upload: jsonResponse({
        jobStatus: { jobId: 'job1', did: SELF, state: 'JOB_STATE_COMPLETED', blob: LEX_VIDEO_BLOB },
      }),
    });
    const tool = makeTool(agent);

    const result = await tool.handler({
      filePath: 'clip.mp4',
      captions: [{ lang: 'en', file: 'subs.vtt' }],
    });

    // Captions are ordinary PDS blobs (the video service only processes the video).
    expect(uploadBlob).toHaveBeenCalledTimes(1);
    const [captionBuffer, captionOpts] = uploadBlob.mock.calls[0]!;
    expect(captionBuffer.toString()).toBe('WEBVTT');
    expect(captionOpts).toEqual({ encoding: 'text/vtt' });

    // The caption entry carries a FULL descriptor so create_post embed.video
    // captions can reference it without re-deriving mimeType/size.
    expect(result.video.captions).toEqual([
      { lang: 'en', file: { type: 'blob', ref: 'bafkreicap', mimeType: 'text/vtt', size: 6 } },
    ]);
  });

  it('tolerates a failed caption upload: the video still succeeds with that caption skipped', async () => {
    writeFileSync(join(baseDir, 'clip.mp4'), Buffer.from('video-bytes'));
    // 'missing.vtt' is never written, so the caption readFile fails.
    const { agent, uploadBlob } = makeAgent();
    stubVideoService({
      upload: jsonResponse({
        jobStatus: { jobId: 'job1', did: SELF, state: 'JOB_STATE_COMPLETED', blob: LEX_VIDEO_BLOB },
      }),
    });
    const tool = makeTool(agent);

    const result = await tool.handler({
      filePath: 'clip.mp4',
      captions: [{ lang: 'en', file: 'missing.vtt' }],
    });

    expect(uploadBlob).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.video.captions).toEqual([]);
  });

  it('skips a caption larger than the 20 kB lexicon cap instead of uploading it', async () => {
    writeFileSync(join(baseDir, 'clip.mp4'), Buffer.from('video-bytes'));
    writeFileSync(join(baseDir, 'huge.vtt'), Buffer.alloc(20_001));
    const { agent, uploadBlob } = makeAgent();
    stubVideoService({
      upload: jsonResponse({
        jobStatus: { jobId: 'job1', did: SELF, state: 'JOB_STATE_COMPLETED', blob: LEX_VIDEO_BLOB },
      }),
    });
    const tool = makeTool(agent);

    const result = await tool.handler({
      filePath: 'clip.mp4',
      captions: [{ lang: 'en', file: 'huge.vtt' }],
    });

    expect(uploadBlob).not.toHaveBeenCalled();
    expect(result.video.captions).toEqual([]);
  });

  it('describes its output as ready for create_post embed.video', () => {
    const { agent } = makeAgent();
    const tool = makeTool(agent);

    expect(tool.schema.description).toMatch(/create_post/);
    expect(tool.schema.description).toMatch(/embed\.video/);
    expect(tool.schema.description).not.toMatch(/does not yet support video embeds/);
  });
});
