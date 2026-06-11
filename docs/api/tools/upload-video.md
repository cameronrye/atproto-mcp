# upload_video

Upload a video to Bluesky through the `app.bsky.video` service. Raw video blobs
are **not** playable on Bluesky: the video service (`video.bsky.app`) transcodes
the upload and stores the processed blob on your PDS, which is what
`app.bsky.embed.video` records must reference. This tool runs the same flow the
official client uses and returns the **processed** video blob descriptor, ready
to pass to [create_post](./create-post.md).

## Authentication

**Required:** Yes (Private tool)

An authenticated session DID is required: the tool mints short-lived
service-auth tokens on your PDS for the video-service calls.

## How It Works

1. Reads the local video file and validates its extension and size (before any
   network work).
2. **Quota preflight** — calls `app.bsky.video.getUploadLimits` (with a
   service-auth token for `did:web:video.bsky.app`) to check that the account
   may upload and has enough daily video/byte quota remaining, so a doomed
   multi-megabyte upload fails fast with a clear reason.
3. **Upload** — mints a service-auth token scoped to
   `com.atproto.repo.uploadBlob` on your own PDS (30-minute lifetime, matching
   the official client) and POSTs the bytes to
   `https://video.bsky.app/xrpc/app.bsky.video.uploadVideo`. If those exact
   bytes were uploaded before, the service answers `409 already_exists` and the
   existing processing job is reused.
4. **Processing poll** — polls `app.bsky.video.getJobStatus` every second until
   the transcode completes or fails, bounded by a 5-minute timeout.
5. **Captions** — uploads any caption files as ordinary `text/vtt` PDS blobs
   (the video service only processes the video itself) and returns their blob
   descriptors alongside the processed video blob.

## Parameters

### `filePath` (required)

- **Type:** `string`
- **Description:** Absolute or relative path to the video file on disk. Must
  resolve within the allowed media directory (`ATPROTO_MEDIA_DIR` env var,
  defaults to the process working directory). Accepted extensions: `.mp4`,
  `.mov`, `.webm`. Maximum file size 100 MB (100,000,000 bytes — the
  `app.bsky.video` service limit).

### `altText` (optional)

- **Type:** `string`
- **Description:** Accessible alt-text description of the video. Maximum 1000
  characters. Omit if no description is available.

### `captions` (optional)

- **Type:** `Array<{ lang: string; file: string }>`
- **Description:** Caption tracks to attach to the video. Each entry pairs a
  `lang` (BCP-47 language code, at least 2 characters, e.g. `"en"`, `"fr"`,
  `"pt-BR"`) with a `file` path to the WebVTT (`.vtt`) caption file for that
  language (which must also resolve within the allowed media directory).
  Caption files over 20 kB (20,000 bytes) are not supported by the
  `app.bsky.embed.video` lexicon and are **skipped**; per-caption failures
  (missing file, over the cap, upload error) are tolerated with a warning
  rather than failing the whole video upload.

## Response

```typescript
{
  success: boolean;
  message: string;
  video: {
    blob: {
      type: string;        // value: 'blob'
      ref: string;         // stringified CID of the PROCESSED blob, e.g. 'bafkrei...'
      mimeType: string;    // typically 'video/mp4' after transcoding
      size: number;        // size of the processed blob in bytes
    };
    alt: string;           // alt text ('' if none was provided)
    jobId: string;         // video-service processing job id (for support/debugging)
    captions?: Array<{
      lang: string;        // BCP-47 language code
      file: {              // blob descriptor of the uploaded .vtt caption blob
        type: string;      // value: 'blob'
        ref: string;       // stringified CID
        mimeType: string;  // always 'text/vtt'
        size: number;
      };
    }>;
  };
}
```

::: tip

`video.blob` describes the **processed** video — transcoded by the video
service and stored on your PDS — not the file you uploaded, so `mimeType` and
`size` reflect the transcoded output. The descriptor has the same shape as
upload_image's `image.blob` (plus the sibling `jobId`): pass `video.blob`
verbatim as `embed.video.video` in [create_post](./create-post.md), and each
`video.captions[].file` verbatim as `embed.video.captions[].file`.

:::

## Examples

### Upload Video

```json
{
  "filePath": "./videos/tutorial.mp4",
  "altText": "Tutorial on using AT Protocol"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Video uploaded and processed successfully from ./videos/tutorial.mp4",
  "video": {
    "blob": {
      "type": "blob",
      "ref": "bafkreivideo123...",
      "mimeType": "video/mp4",
      "size": 4853210
    },
    "alt": "Tutorial on using AT Protocol",
    "jobId": "rmpdzv4uoctlginpv3oddi6w"
  }
}
```

### Upload Video with Captions

```json
{
  "filePath": "./videos/talk.mp4",
  "altText": "Conference talk",
  "captions": [
    {
      "lang": "en",
      "file": "./captions/en.vtt"
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Video uploaded and processed successfully from ./videos/talk.mp4",
  "video": {
    "blob": {
      "type": "blob",
      "ref": "bafkreivideo456...",
      "mimeType": "video/mp4",
      "size": 9120004
    },
    "alt": "Conference talk",
    "jobId": "kwx5ej3tqxxv2hcyvbq7worf",
    "captions": [
      {
        "lang": "en",
        "file": {
          "type": "blob",
          "ref": "bafkreicaption789...",
          "mimeType": "text/vtt",
          "size": 1843
        }
      }
    ]
  }
}
```

To publish the video, pass the descriptors to
[create_post](./create-post.md#post-with-video) as the `embed.video` embed.

## Supported Formats

- **MP4** (`.mp4`) - Recommended; uploaded as `video/mp4`
- **MOV** (`.mov`) - Uploaded as `video/quicktime`
- **WebM** (`.webm`) - Uploaded as `video/webm`

Whatever the input format, the video service transcodes it for playback; the
processed blob it returns is typically `video/mp4`.

## Size Limits

- **Video:** maximum 100 MB (100,000,000 bytes), per the
  `app.bsky.embed.video` lexicon — checked locally before any network work.
- **Captions:** maximum 20 kB (20,000 bytes) per `.vtt` file, per the same
  lexicon — larger caption files are skipped.
- **Daily quota:** the video service enforces per-account daily limits on video
  count and total bytes; the preflight `getUploadLimits` call surfaces these
  before the upload starts.

The tool does **not** inspect duration, resolution, or bitrate. The video
service applies its own platform constraints during processing; if processing
fails, the service's reason is surfaced in the error message.

## Error Handling

### Common Errors

The tool surfaces errors as messages (returned as stringified JSON text
content). The exact text:

#### Unsupported Format

```text
Unsupported video format: <extension>
```

Only `.mp4`, `.mov`, and `.webm` are accepted.

#### File Too Large

```text
Video file size cannot exceed 100 MB (the app.bsky.video service limit)
```

#### No Authenticated Session

```text
Video upload requires an authenticated session: no DID is available to attribute the upload to.
```

#### Quota and Limits

From the `getUploadLimits` preflight:

```text
This account cannot upload videos right now: <reason from the video service>
```

```text
Daily video upload limit reached: no videos remaining today. Try again tomorrow.
```

```text
Insufficient remaining daily video upload quota: the video is <n> bytes but only <m> bytes remain today.
```

#### Upload Failed

```text
Video upload to https://video.bsky.app failed (HTTP <status>): <message>
```

#### Processing Failed or Timed Out

```text
Video processing failed (job <jobId>): <error>
```

```text
Timed out after 300000ms waiting for video processing (job <jobId>, last state <state>)
```

## Best Practices

### Video Optimization

- Compress videos before uploading to stay within the 100 MB limit and your
  daily byte quota
- Use H.264 codec for MP4 for the most predictable transcoding results
- Use appropriate resolution (720p-1080p)

### Accessibility

- Always provide descriptive alt text (`altText`)
- Include captions when possible, and keep each `.vtt` file under 20 kB
- Describe audio content in alt text for users with hearing impairments

### Workflow

- Expect the call to take a while: the tool waits (up to 5 minutes) for the
  video service to finish transcoding before returning
- Pass the returned `video.blob` and `video.captions[].file` descriptors to
  create_post verbatim — do not re-upload or reshape them
- Keep the returned `jobId` if you need to debug a processing problem with the
  video service

## Related Tools

- **[upload_image](./upload-image.md)** - Upload image content
- **[create_post](./create-post.md)** - Create posts with video

## See Also

- [Content Management Examples](../../examples/content-management.md)
- [Media Best Practices](../../guide/tools-resources.md#media)
