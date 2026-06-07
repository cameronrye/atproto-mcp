# upload_video

Upload a video to AT Protocol for use in posts.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `filePath` (required)

- **Type:** `string`
- **Description:** Path to the local video file to upload. Must resolve within
  the allowed media directory (defaults to the process working directory;
  override with `ATPROTO_MEDIA_DIR`).

### `altText` (optional)

- **Type:** `string`
- **Description:** Alt text for accessibility. Maximum 1000 characters.

### `captions` (optional)

- **Type:** `Array<{ lang: string; file: string }>`
- **Description:** Caption/subtitle files. Each entry has a `lang` (BCP-47
  language code, at least 2 characters) and a `file` that is a path to the local
  caption file (e.g. a `.vtt` file within `ATPROTO_MEDIA_DIR` / the working
  directory).

## Response

```typescript
{
  success: boolean;
  message: string;
  video: {
    blob: {
      type: string;        // value: 'blob'
      ref: string;         // stringified CID, e.g. 'bafkrei...'
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
      file: string;        // stringified CID ref of the uploaded VTT blob
    }>;
  };
}
```

::: tip

`type` is the literal `'blob'`, `ref` is the stringified CID (e.g.
`bafkrei...`), and each caption `file` is the stringified CID ref of the
uploaded caption blob. `aspectRatio` is declared optional but is intentionally
omitted at runtime, since the video is not decoded.

:::

## Examples

### Upload Video

```json
{
  "filePath": "./videos/tutorial.mp4",
  "altText": "Tutorial on using AT Protocol"
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

## Supported Formats

- **MP4** (`.mp4`) - Recommended
- **MOV** (`.mov`)
- **WebM** (`.webm`)

## Size Limits

- **Maximum file size:** 50MB — enforced by the tool; files larger than
  `50 * 1024 * 1024` bytes are rejected before upload.

The tool reads a local file path and uploads the bytes as-is. It does **not**
inspect duration, resolution, or bitrate, so it does not enforce a maximum
duration. Bluesky's own platform limits (around 60 seconds and recommended
resolutions/bitrates) still apply at the service, but they are not checked by
this tool.

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
Video file size cannot exceed 50MB
```

## Best Practices

### Video Optimization

- Compress videos before uploading
- Use H.264 codec for MP4
- Keep duration under 60 seconds
- Use appropriate resolution (720p-1080p)
- Optimize bitrate for file size

### Accessibility

- Always provide descriptive alt text
- Include captions when possible
- Describe audio content in alt text
- Consider users with hearing impairments

### Performance

- Show upload progress
- Implement chunked uploads for large files
- Provide retry logic for failed uploads
- Validate video before uploading

### User Experience

- Show video preview before upload
- Display file size and duration
- Warn about size/duration limits
- Provide compression options

## Related Tools

- **[upload_image](./upload-image.md)** - Upload image content
- **[create_post](./create-post.md)** - Create posts with video

## See Also

- [Content Management Examples](../../examples/content-management.md)
- [Media Best Practices](../../guide/tools-resources.md#media)
