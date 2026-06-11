/**
 * Enhanced media support tools for AT Protocol
 */

import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import { readFile } from 'fs/promises';
import { basename, extname } from 'path';
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
  filePath: z
    .string()
    .min(1, 'File path is required')
    .describe(
      'Absolute or relative path to the image file on disk. Must resolve within the allowed media directory (ATPROTO_MEDIA_DIR env var, defaults to cwd). Accepted extensions: .jpg, .jpeg, .png, .gif, .webp, .avif. Maximum file size 1 MB.'
    ),
  altText: z
    .string()
    .max(1000, 'Alt text cannot exceed 1000 characters')
    .optional()
    .describe(
      'Accessible alt-text description of the image (max 1000 characters). Omit if no description is available.'
    ),
});

/**
 * The Bluesky video service. Raw video blobs are NOT playable on Bluesky: the
 * app.bsky.video service transcodes the upload (to HLS) and stores the
 * processed blob on the user's PDS, which is what app.bsky.embed.video
 * records must reference. This is the same flow the official client uses.
 */
export const VIDEO_SERVICE_URL = 'https://video.bsky.app';
export const VIDEO_SERVICE_DID = 'did:web:video.bsky.app';

/**
 * Maximum video size accepted by the video service, per the
 * app.bsky.embed.video lexicon (`maxSize: 100000000` — "May be up to 100mb,
 * formerly limited to 50mb").
 */
export const MAX_VIDEO_SIZE_BYTES = 100_000_000;

/** Maximum caption (.vtt) blob size per the app.bsky.embed.video lexicon. */
export const MAX_CAPTION_SIZE_BYTES = 20_000;

/** Delay between app.bsky.video.getJobStatus polls. */
export const VIDEO_JOB_POLL_INTERVAL_MS = 1_000;

/** Upper bound on the total processing wait before giving up. */
export const VIDEO_JOB_POLL_TIMEOUT_MS = 5 * 60_000;

/**
 * Lifetime of the service-auth token minted for the upload, matching the
 * official client's 30 minutes (the token must outlive a slow upload).
 */
export const VIDEO_UPLOAD_TOKEN_LIFETIME_S = 30 * 60;

/** app.bsky.video.defs#jobStatus as the video service returns it over JSON. */
interface IVideoJobStatus {
  jobId: string;
  did?: string;
  state: string;
  progress?: number;
  blob?: {
    ref?: string | { $link?: string };
    mimeType?: string;
    size?: number;
  };
  error?: string;
  message?: string;
}

/**
 * Pull a job status out of a video-service response body. The lexicon wraps
 * it as { jobStatus }, but the deployed service has returned the bare object
 * in some paths (e.g. the 409 already_exists answer), so accept both.
 */
function videoJobFromBody(body: unknown): IVideoJobStatus | undefined {
  const candidate = (body as { jobStatus?: unknown } | undefined)?.jobStatus ?? body;
  if (
    candidate &&
    typeof candidate === 'object' &&
    typeof (candidate as IVideoJobStatus).state === 'string'
  ) {
    return candidate as IVideoJobStatus;
  }
  return undefined;
}

const UploadVideoSchema = z.object({
  filePath: z
    .string()
    .min(1, 'File path is required')
    .describe(
      'Absolute or relative path to the video file on disk. Must resolve within the allowed media directory (ATPROTO_MEDIA_DIR env var, defaults to cwd). Accepted extensions: .mp4, .mov, .webm. Maximum file size 100 MB (the app.bsky.video service limit).'
    ),
  altText: z
    .string()
    .max(1000, 'Alt text cannot exceed 1000 characters')
    .optional()
    .describe(
      'Accessible alt-text description of the video (max 1000 characters). Omit if no description is available.'
    ),
  captions: z
    .array(
      z.object({
        lang: z
          .string()
          .min(2, 'Language code must be at least 2 characters')
          .describe('BCP-47 language code for the caption track (e.g. "en", "fr", "pt-BR").'),
        file: z
          .string()
          .min(1, 'Caption file path is required')
          .describe(
            'Absolute or relative path to the WebVTT (.vtt) caption file for this language. Must resolve within the allowed media directory. Caption files over 20 kB are not supported by the embed lexicon and are skipped.'
          ),
      })
    )
    .optional()
    .describe(
      'Optional list of caption tracks to attach to the video. Each entry pairs a language code with a WebVTT file path.'
    ),
});

const GenerateLinkPreviewSchema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .describe(
      'Fully-qualified HTTP or HTTPS URL of the webpage to preview. SSRF-safe: private/internal IP ranges and non-HTTP schemes are rejected. The server fetches up to 2 MB of the page HTML and up to 1 MB for the og:image thumbnail.'
    ),
});

export class UploadImageTool extends BaseTool {
  public readonly schema = {
    method: 'upload_image',
    description:
      'Upload an image file to AT Protocol for use in posts and profiles. Reads a local image file (JPEG, PNG, GIF, WebP, or AVIF; max 1 MB) and uploads it as an AT Protocol blob, returning a blob descriptor and alt text. Pass the returned `image.blob` object verbatim as `embed.images[].image` in create_post, as `avatar`/`banner` in update_profile, or to analyze_image. Requires authentication (app password). Use upload_video instead for video files. Subject to per-tool rate limiting.',
    params: UploadImageSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the upload succeeded.',
        },
        message: {
          type: 'string',
          description: 'Human-readable status message.',
        },
        image: {
          type: 'object',
          description:
            'Uploaded image blob descriptor and metadata. Pass the `blob` object as create_post embed.images[].image or update_profile avatar/banner.',
          properties: {
            blob: {
              type: 'object',
              description: 'AT Protocol blob descriptor.',
              properties: {
                type: { type: 'string', description: 'Always "blob".' },
                ref: {
                  type: 'string',
                  description: 'CID reference string (bafkrei…) of the uploaded blob.',
                },
                mimeType: {
                  type: 'string',
                  description: 'MIME type of the uploaded image (e.g. "image/jpeg").',
                },
                size: {
                  type: 'number',
                  description: 'Size of the uploaded blob in bytes.',
                },
              },
              required: ['type', 'ref', 'mimeType', 'size'],
            },
            alt: {
              type: 'string',
              description: 'Alt text for the image (empty string if none was provided).',
            },
          },
          required: ['blob', 'alt'],
        },
      },
      required: ['success', 'message', 'image'],
    },
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
      'Upload a video to Bluesky through the app.bsky.video service (video.bsky.app), which transcodes it for playback and stores the processed blob on your PDS. Reads a local video file (MP4, MOV, or WebM; max 100 MB), checks your account video-upload quota, uploads with a service-auth token, polls processing until it completes, and returns the PROCESSED video blob descriptor — pass the returned `video.blob` object verbatim as `embed.video.video` in create_post, and any `video.captions[].file` descriptors as `embed.video.captions[].file`. WebVTT caption tracks are uploaded as ordinary PDS blobs; caption files the embed lexicon does not support (over 20 kB) are skipped. Requires authentication (app password). Use upload_image instead for still images. Subject to per-tool rate limiting and the video service daily quota.',
    params: UploadVideoSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the upload and processing succeeded.',
        },
        message: {
          type: 'string',
          description: 'Human-readable status message.',
        },
        video: {
          type: 'object',
          description:
            'Processed video blob descriptor and metadata. Pass the `blob` object as create_post embed.video.video and each `captions[].file` as embed.video.captions[].file.',
          properties: {
            blob: {
              type: 'object',
              description:
                'AT Protocol blob descriptor for the PROCESSED video (transcoded by the video service and stored on the PDS).',
              properties: {
                type: { type: 'string', description: 'Always "blob".' },
                ref: {
                  type: 'string',
                  description: 'CID reference string (bafkrei…) of the processed video blob.',
                },
                mimeType: {
                  type: 'string',
                  description: 'MIME type of the processed video (typically "video/mp4").',
                },
                size: {
                  type: 'number',
                  description: 'Size of the processed video blob in bytes.',
                },
              },
              required: ['type', 'ref', 'mimeType', 'size'],
            },
            alt: {
              type: 'string',
              description: 'Alt text for the video (empty string if none was provided).',
            },
            jobId: {
              type: 'string',
              description: 'Video-service processing job id (useful for support/debugging).',
            },
            captions: {
              type: 'array',
              description:
                'Uploaded caption tracks. Each entry pairs a BCP-47 language code with the caption blob descriptor for create_post embed.video.captions.',
              items: {
                type: 'object',
                properties: {
                  lang: {
                    type: 'string',
                    description: 'BCP-47 language code for the caption track.',
                  },
                  file: {
                    type: 'object',
                    description: 'AT Protocol blob descriptor for the uploaded .vtt caption blob.',
                    properties: {
                      type: { type: 'string', description: 'Always "blob".' },
                      ref: {
                        type: 'string',
                        description: 'CID reference string of the caption blob.',
                      },
                      mimeType: {
                        type: 'string',
                        description: 'MIME type of the caption blob (always "text/vtt").',
                      },
                      size: {
                        type: 'number',
                        description: 'Size of the caption blob in bytes.',
                      },
                    },
                    required: ['type', 'ref', 'mimeType', 'size'],
                  },
                },
                required: ['lang', 'file'],
              },
            },
          },
          required: ['blob', 'alt', 'jobId'],
        },
      },
      required: ['success', 'message', 'video'],
    },
  };

  /**
   * Poll knobs as instance fields so tests can tighten them without real
   * sleeps; production uses the exported constants.
   */
  protected jobPollIntervalMs = VIDEO_JOB_POLL_INTERVAL_MS;
  protected jobPollTimeoutMs = VIDEO_JOB_POLL_TIMEOUT_MS;

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
      jobId: string;
      captions?: Array<{
        lang: string;
        file: {
          type: string;
          ref: string;
          mimeType: string;
          size: number;
        };
      }>;
    };
  }> {
    try {
      this.logger.info('Uploading video via the app.bsky.video service', {
        filePath: params.filePath,
        hasAltText: !!params.altText,
        captionCount: params.captions?.length ?? 0,
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

      // Enforce the video service's own size limit (app.bsky.embed.video
      // lexicon maxSize) before doing any network work.
      if (videoData.length > MAX_VIDEO_SIZE_BYTES) {
        throw new Error('Video file size cannot exceed 100 MB (the app.bsky.video service limit)');
      }

      const agent = this.atpClient.getAgent();
      const did = agent.session?.did;
      if (!did) {
        throw new Error(
          'Video upload requires an authenticated session: no DID is available to attribute the upload to.'
        );
      }

      // Preflight: ask the video service whether this account may upload and
      // whether enough daily quota remains, so a doomed multi-MB upload fails
      // fast with a clear reason.
      await this.assertUploadWithinLimits(videoData.length);

      // The video service relays the processed blob to the user's own PDS, so
      // the upload token is scoped to uploadBlob on the PDS (aud = the PDS
      // did:web), exactly like the official client.
      const uploadToken = await this.getVideoServiceToken(
        {
          aud: `did:web:${agent.dispatchUrl.host}`,
          lxm: 'com.atproto.repo.uploadBlob',
          exp: Math.floor(Date.now() / 1000) + VIDEO_UPLOAD_TOKEN_LIFETIME_S,
        },
        'getVideoUploadServiceAuth'
      );

      const uploadResponse = await this.fetchVideoService('app.bsky.video.uploadVideo', {
        method: 'POST',
        token: uploadToken,
        contentType: mimeType,
        body: videoData,
        query: { did, name: basename(safePath) },
      });

      let job: IVideoJobStatus | undefined;
      if (uploadResponse.ok) {
        job = videoJobFromBody(uploadResponse.body);
      } else if (
        (uploadResponse.body as { error?: string } | undefined)?.error === 'already_exists'
      ) {
        // These exact bytes were uploaded before; the service answers 409 with
        // the existing job, which is just as good — reuse it.
        const body = uploadResponse.body as { jobId?: string };
        job =
          videoJobFromBody(uploadResponse.body) ??
          (typeof body.jobId === 'string'
            ? { jobId: body.jobId, state: 'JOB_STATE_CREATED' }
            : undefined);
      }
      if (!job) {
        const body = uploadResponse.body as { message?: string; error?: string } | undefined;
        throw new Error(
          `Video upload to ${VIDEO_SERVICE_URL} failed (HTTP ${uploadResponse.status}): ` +
            `${body?.message ?? body?.error ?? 'unknown error'}`
        );
      }

      // Poll until the transcode finishes; only the processed blob is playable.
      const completed = await this.waitForVideoProcessing(job);
      const processedBlob = completed.blob;
      const ref =
        typeof processedBlob?.ref === 'string'
          ? processedBlob.ref
          : (processedBlob?.ref?.$link ?? '');
      if (!processedBlob || !ref) {
        throw new Error(
          `Video processing completed but the service returned no usable blob ref (job ${completed.jobId})`
        );
      }

      // Upload captions if provided. Captions are ordinary PDS blobs — the
      // video service only processes the video itself.
      const processedCaptions = await this.uploadCaptions(params.captions);

      this.logger.info('Video uploaded and processed successfully', {
        filePath: params.filePath,
        jobId: completed.jobId,
        blobRef: ref,
        size: processedBlob.size,
        captionCount: processedCaptions?.length ?? 0,
      });

      return {
        success: true,
        message: `Video uploaded and processed successfully from ${params.filePath}`,
        video: {
          blob: {
            type: 'blob',
            ref,
            mimeType: processedBlob.mimeType ?? 'video/mp4',
            size: processedBlob.size ?? videoData.length,
          },
          alt: params.altText ?? '',
          jobId: completed.jobId,
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

  /**
   * Mint a service-auth token on the user's PDS for a video-service call.
   * aud/lxm follow the official client convention: limits checks target the
   * video service DID directly, while uploads target the user's own PDS with
   * lxm com.atproto.repo.uploadBlob (the service writes the blob there).
   */
  private async getVideoServiceToken(
    args: { aud: string; lxm: string; exp?: number },
    operationName: string
  ): Promise<string> {
    const response = await this.executeAtpOperation(
      async () => {
        const agent = this.atpClient.getAgent();
        return await agent.com.atproto.server.getServiceAuth(args);
      },
      operationName,
      { aud: args.aud, lxm: args.lxm }
    );
    const token = response.data?.token;
    if (!token) {
      throw new Error('The PDS did not return a service-auth token for the video service');
    }
    return token;
  }

  /** Perform one JSON request against the video service. */
  private async fetchVideoService(
    nsid: string,
    opts: {
      method?: 'GET' | 'POST';
      token?: string;
      query?: Record<string, string>;
      contentType?: string;
      body?: Buffer;
    } = {}
  ): Promise<{ ok: boolean; status: number; body: unknown }> {
    const url = new URL(`/xrpc/${nsid}`, VIDEO_SERVICE_URL);
    for (const [key, value] of Object.entries(opts.query ?? {})) {
      url.searchParams.set(key, value);
    }
    const headers: Record<string, string> = {};
    if (opts.token) {
      headers['Authorization'] = `Bearer ${opts.token}`;
    }
    if (opts.contentType) {
      headers['Content-Type'] = opts.contentType;
    }
    const response = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      ...(opts.body ? { body: new Uint8Array(opts.body) } : {}),
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // Non-JSON body (e.g. an HTML error page); callers handle undefined.
    }
    return { ok: response.ok, status: response.status, body };
  }

  /**
   * Preflight app.bsky.video.getUploadLimits: fail fast with the service's
   * reason when the account cannot upload, has no videos left today, or lacks
   * the byte quota for this file.
   */
  private async assertUploadWithinLimits(videoSizeBytes: number): Promise<void> {
    const token = await this.getVideoServiceToken(
      { aud: VIDEO_SERVICE_DID, lxm: 'app.bsky.video.getUploadLimits' },
      'getVideoUploadLimitsServiceAuth'
    );
    const { ok, status, body } = await this.fetchVideoService('app.bsky.video.getUploadLimits', {
      token,
    });
    const limits = body as
      | {
          canUpload?: boolean;
          remainingDailyVideos?: number;
          remainingDailyBytes?: number;
          message?: string;
          error?: string;
        }
      | undefined;
    if (!ok || !limits) {
      throw new Error(`Failed to check video upload limits (HTTP ${status})`);
    }
    if (!limits.canUpload) {
      throw new Error(
        `This account cannot upload videos right now: ${limits.message ?? limits.error ?? 'the video service gave no reason'}`
      );
    }
    if (typeof limits.remainingDailyVideos === 'number' && limits.remainingDailyVideos <= 0) {
      throw new Error(
        'Daily video upload limit reached: no videos remaining today. Try again tomorrow.'
      );
    }
    if (
      typeof limits.remainingDailyBytes === 'number' &&
      limits.remainingDailyBytes < videoSizeBytes
    ) {
      throw new Error(
        `Insufficient remaining daily video upload quota: the video is ${videoSizeBytes} bytes ` +
          `but only ${limits.remainingDailyBytes} bytes remain today.`
      );
    }
  }

  /**
   * Poll getJobStatus (bounded by jobPollTimeoutMs) until the processing job
   * completes, fails, or times out. Returns the completed status (with blob).
   */
  private async waitForVideoProcessing(initial: IVideoJobStatus): Promise<IVideoJobStatus> {
    const deadline = Date.now() + this.jobPollTimeoutMs;
    let status = initial;
    for (;;) {
      if (status.state === 'JOB_STATE_COMPLETED') {
        return status;
      }
      if (status.state === 'JOB_STATE_FAILED') {
        throw new Error(
          `Video processing failed (job ${status.jobId}): ` +
            `${status.error ?? status.message ?? 'unknown error'}`
        );
      }
      if (Date.now() >= deadline) {
        throw new Error(
          `Timed out after ${this.jobPollTimeoutMs}ms waiting for video processing ` +
            `(job ${status.jobId}, last state ${status.state})`
        );
      }
      await new Promise(resolve => setTimeout(resolve, this.jobPollIntervalMs));
      const {
        ok,
        status: httpStatus,
        body,
      } = await this.fetchVideoService('app.bsky.video.getJobStatus', {
        query: { jobId: initial.jobId },
      });
      const next = ok ? videoJobFromBody(body) : undefined;
      if (!next) {
        throw new Error(
          `Failed to fetch video processing status (job ${initial.jobId}, HTTP ${httpStatus})`
        );
      }
      status = next;
    }
  }

  /**
   * Upload caption tracks as ordinary text/vtt PDS blobs, returning full blob
   * descriptors so create_post embed.video.captions can use them verbatim.
   * Per-caption failures (missing file, over the 20 kB lexicon cap, upload
   * errors) are tolerated: the caption is skipped with a warning.
   */
  private async uploadCaptions(
    captions: Array<{ lang: string; file: string }> | undefined
  ): Promise<
    | Array<{ lang: string; file: { type: string; ref: string; mimeType: string; size: number } }>
    | undefined
  > {
    if (!captions || captions.length === 0) {
      return undefined;
    }
    const processed: Array<{
      lang: string;
      file: { type: string; ref: string; mimeType: string; size: number };
    }> = [];
    for (const caption of captions) {
      try {
        const captionData = await readFile(assertSafePath(caption.file, mediaBaseDir()));
        if (captionData.length > MAX_CAPTION_SIZE_BYTES) {
          throw new Error(
            `Caption file exceeds the ${MAX_CAPTION_SIZE_BYTES}-byte app.bsky.embed.video lexicon limit`
          );
        }
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

        processed.push({
          lang: caption.lang,
          file: {
            type: 'blob',
            // Stringify the multiformats CID (see UploadImageTool).
            ref: captionResponse.data?.blob?.ref?.toString() ?? '',
            mimeType: captionResponse.data?.blob?.mimeType ?? 'text/vtt',
            size: captionResponse.data?.blob?.size ?? captionData.length,
          },
        });
      } catch (captionError) {
        this.logger.warn('Failed to upload caption', captionError);
      }
    }
    return processed;
  }
}

export class GenerateLinkPreviewTool extends BaseTool {
  public readonly schema = {
    method: 'generate_link_preview',
    description:
      'Generate a link preview with title, description, and thumbnail for a given URL. Fetches the target page, extracts Open Graph / meta tags, optionally downloads and uploads the og:image thumbnail as an AT Protocol blob, and returns a preview object ready to attach as an external embed to a create_post or create_thread call. Requires authentication (app password). Use this tool before create_post when you want a rich URL card; use upload_image or upload_video for local media instead. Subject to per-tool rate limiting.',
    params: GenerateLinkPreviewSchema,
    outputSchema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the preview was generated successfully.',
        },
        message: {
          type: 'string',
          description: 'Human-readable status message.',
        },
        preview: {
          type: 'object',
          description: 'Link preview data suitable for use as an AT Protocol external embed.',
          properties: {
            uri: {
              type: 'string',
              description: 'The original URL that was previewed.',
            },
            title: {
              type: 'string',
              description:
                'Page title extracted from <title> or og:title (truncated to 300 characters).',
            },
            description: {
              type: 'string',
              description:
                'Page description from meta description or og:description (truncated to 1000 characters).',
            },
            thumb: {
              type: 'object',
              description:
                'Uploaded thumbnail blob reference, present only when an og:image was found and successfully downloaded.',
              properties: {
                blob: {
                  type: 'object',
                  description: 'AT Protocol blob descriptor for the thumbnail image.',
                  properties: {
                    type: { type: 'string', description: 'Always "blob".' },
                    ref: {
                      type: 'string',
                      description:
                        'CID reference string (bafkrei…) of the uploaded thumbnail blob.',
                    },
                    mimeType: {
                      type: 'string',
                      description: 'MIME type of the thumbnail image (e.g. "image/jpeg").',
                    },
                    size: {
                      type: 'number',
                      description: 'Size of the thumbnail blob in bytes.',
                    },
                  },
                  required: ['type', 'ref', 'mimeType', 'size'],
                },
              },
              required: ['blob'],
            },
          },
          required: ['uri', 'title', 'description'],
        },
      },
      required: ['success', 'message', 'preview'],
    },
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
          this.logger.warn('Failed to download thumbnail image', imageError);
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
