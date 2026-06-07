# upload_image

Upload an image to AT Protocol for use in posts or profile.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `filePath` (required)

- **Type:** `string`
- **Description:** Path to the local image file to upload. Must resolve within
  the allowed media directory (defaults to the process working directory;
  override with `ATPROTO_MEDIA_DIR`).

### `altText` (optional)

- **Type:** `string`
- **Description:** Alt text for accessibility. Maximum 1000 characters.

## Response

```typescript
{
  success: boolean;
  message: string;
  image: {
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
  };
}
```

## Examples

### Upload Image

```json
{
  "filePath": "./images/sunset.jpg",
  "altText": "A beautiful sunset over the ocean"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Image uploaded successfully from ./images/sunset.jpg",
  "image": {
    "blob": {
      "type": "blob",
      "ref": "bafkreiabc123...",
      "mimeType": "image/jpeg",
      "size": 245678
    },
    "alt": "A beautiful sunset over the ocean"
  }
}
```

## Supported Formats

- **JPEG** (`.jpg`, `.jpeg`)
- **PNG** (`.png`)
- **WebP** (`.webp`)
- **GIF** (`.gif`)

## Size Limits

- **Maximum file size:** 1MB — enforced by the tool; files larger than
  `1024 * 1024` bytes are rejected before upload.

The tool reads a local file path and uploads the bytes as-is. It does **not**
inspect, resize, or re-encode the image, so it has no notion of pixel
dimensions. (Bluesky may downscale large images for display, but that is a
platform behavior, not something this tool controls.)

## Error Handling

### Common Errors

The tool surfaces errors as messages (returned as stringified JSON text
content). The exact text:

#### Unsupported Format

```text
Unsupported image format: <extension>
```

Only `.jpg`, `.jpeg`, `.png`, `.gif`, and `.webp` are accepted.

#### File Too Large

```text
Image file size cannot exceed 1MB
```

#### Upload Failed

Upload failures, oversized files, and unsupported formats all surface as an
error with code `TOOL_EXECUTION_ERROR`. The message is the underlying error text
(e.g. `Image file size cannot exceed 1MB` or the AT client's failure message).
There is no dedicated `UPLOAD_ERROR` code.

```json
{
  "error": "<underlying failure message>",
  "code": "TOOL_EXECUTION_ERROR"
}
```

## Best Practices

### Image Optimization

- Compress images before uploading
- Use appropriate format (JPEG for photos, PNG for graphics)
- Resize to appropriate dimensions
- Remove EXIF data for privacy

### Accessibility

- Always provide descriptive alt text
- Describe the content and context
- Keep alt text under 1000 characters
- Don't start with "Image of" or "Picture of"

### Performance

- Upload images before creating posts
- Cache blob references for reuse
- Implement retry logic for failed uploads
- Show upload progress to users

## Related Tools

- **[upload_video](./upload-video.md)** - Upload video content
- **[create_post](./create-post.md)** - Create posts with images
- **[update_profile](./update-profile.md)** - Update profile with images

## See Also

- [Content Management Examples](../../examples/content-management.md)
- [Media Best Practices](../../guide/tools-resources.md#media)
