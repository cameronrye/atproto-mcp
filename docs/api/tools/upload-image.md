# upload_image

Upload an image to AT Protocol for use in posts or profile.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `image` (required)

- **Type:** `Blob`
- **Description:** Image file data

### `alt` (optional)

- **Type:** `string`
- **Description:** Alt text for accessibility

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

### Upload Image

```json
{
  "image": "<Blob data>",
  "alt": "A beautiful sunset over the ocean"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "blob": {
    "$type": "blob",
    "ref": {
      "$link": "bafyreiabc123..."
    },
    "mimeType": "image/jpeg",
    "size": 245678
  },
  "alt": "A beautiful sunset over the ocean"
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

```json
{
  "error": "Failed to upload image",
  "code": "UPLOAD_ERROR"
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
