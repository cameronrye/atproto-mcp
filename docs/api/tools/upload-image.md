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

- **Maximum file size:** 1MB
- **Recommended dimensions:** 
  - Posts: 1000x1000px or smaller
  - Avatar: 400x400px
  - Banner: 1500x500px

## Error Handling

### Common Errors

#### Invalid Format
```json
{
  "error": "Unsupported image format",
  "code": "VALIDATION_ERROR"
}
```

#### File Too Large
```json
{
  "error": "Image size exceeds 1MB limit",
  "code": "VALIDATION_ERROR"
}
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

