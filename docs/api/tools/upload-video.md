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

- **Maximum file size:** 50MB
- **Maximum duration:** 60 seconds
- **Recommended resolution:** 1080p or lower
- **Recommended bitrate:** 5 Mbps or lower

## Error Handling

### Common Errors

#### Invalid Format
```json
{
  "error": "Unsupported video format",
  "code": "VALIDATION_ERROR"
}
```

#### File Too Large
```json
{
  "error": "Video size exceeds 50MB limit",
  "code": "VALIDATION_ERROR"
}
```

#### Video Too Long
```json
{
  "error": "Video duration exceeds 60 seconds",
  "code": "VALIDATION_ERROR"
}
```

#### Upload Failed
```json
{
  "error": "Failed to upload video",
  "code": "UPLOAD_ERROR"
}
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

