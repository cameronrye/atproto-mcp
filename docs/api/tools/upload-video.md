# upload_video

Upload a video to AT Protocol for use in posts.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `video` (required)

- **Type:** `Blob`
- **Description:** Video file data

### `alt` (optional)

- **Type:** `string`
- **Description:** Alt text for accessibility

### `captions` (optional)

- **Type:** `Array<{ lang: string; file: Blob }>`
- **Description:** Caption/subtitle files

## Response

```typescript
{
  success: boolean;
  message: string;
  blob: {
    $type: string;
    ref: {
      $link: string;
    };
    mimeType: string;
    size: number;
  };
  alt?: string;
}
```

## Examples

### Upload Video

```json
{
  "video": "<Blob data>",
  "alt": "Tutorial on using AT Protocol"
}
```

### Upload Video with Captions

```json
{
  "video": "<Blob data>",
  "alt": "Conference talk",
  "captions": [
    {
      "lang": "en",
      "file": "<VTT Blob data>"
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
