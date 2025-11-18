# analyze_image

Analyze image metadata and provide optimization suggestions. Returns dimensions, file size, format, and recommendations for better performance and accessibility.

## Authentication

**Optional** - This tool works without authentication.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `blob` | `object` | Yes | - | Image blob object with ref, mimeType, and size. |
| `blob.ref.$link` | `string` | Yes | - | Blob reference link. |
| `blob.mimeType` | `string` | Yes | - | MIME type of the image (e.g., `image/jpeg`). |
| `blob.size` | `number` | Yes | - | Size of the image in bytes. |
| `includeOptimizationSuggestions` | `boolean` | No | `true` | Whether to include optimization suggestions. |

## Response

```typescript
{
  success: boolean;
  analysis: {
    mimeType: string;
    size: number;
    sizeKB: number;
    sizeMB: number;
    format: string;
    isOptimized: boolean;
  };
  suggestions?: string[];
}
```

## Examples

### Analyze Uploaded Image

```json
{
  "blob": {
    "ref": { "$link": "bafkreiabc123..." },
    "mimeType": "image/jpeg",
    "size": 524288
  },
  "includeOptimizationSuggestions": true
}
```

### Quick Analysis (No Suggestions)

```json
{
  "blob": {
    "ref": { "$link": "bafkreixyz789..." },
    "mimeType": "image/png",
    "size": 1048576
  },
  "includeOptimizationSuggestions": false
}
```

## Error Handling

Common errors:

- **`InvalidRequest`**: Invalid blob object or missing required fields
- **`UnsupportedFormat`**: Image format is not supported

## Best Practices

1. **Check Before Upload**: Analyze images before uploading to posts
2. **Optimize Large Images**: Follow suggestions to reduce file size
3. **Use Appropriate Formats**: JPEG for photos, PNG for graphics, WebP for best compression
4. **Add Alt Text**: Always include descriptive alt text for accessibility
5. **Monitor File Sizes**: Keep images under 1MB for best performance
6. **Consider Mobile**: Optimize for mobile data usage
7. **Test Different Formats**: Compare JPEG, PNG, and WebP for best results

## Supported Formats

- **JPEG** (`image/jpeg`): Best for photographs, lossy compression
- **PNG** (`image/png`): Best for graphics with transparency, lossless compression
- **WebP** (`image/webp`): Modern format with superior compression
- **GIF** (`image/gif`): Animated images (use sparingly, large file sizes)

## Optimization Guidelines

### File Size Recommendations
- **Optimal**: Under 500 KB
- **Acceptable**: 500 KB - 1 MB
- **Large**: 1 MB - 2 MB (consider optimizing)
- **Too Large**: Over 2 MB (should optimize)

### Format-Specific Advice
- **JPEG**: Use 80-85% quality for good balance
- **PNG**: Use compression tools like pngquant
- **WebP**: Best compression, but check browser support
- **GIF**: Convert to video for better compression

## Common Suggestions

The tool may suggest:
- Reducing file size if over 1 MB
- Converting to WebP for better compression
- Using JPEG instead of PNG for photos
- Compressing images without quality loss
- Adding alt text for accessibility
- Optimizing for web use

## Accessibility

Always include alt text when using images:
- Use the `generate_alt_text` tool for assistance
- Describe what's in the image, not just "image of..."
- Keep alt text concise but descriptive
- Include important text that appears in the image

## Rate Limiting

This tool is not subject to AT Protocol API rate limits as it performs local analysis.

## Related Tools

- **[upload_image](./upload-image.md)** - Upload images to AT Protocol
- **[generate_alt_text](#generate-alt-text)** - Generate descriptive alt text
- **[extract_media_from_post](#extract-media-from-post)** - Extract media from posts
- **[create_post](./create-post.md)** - Create posts with images

## See Also

- [Rich Media Guide](../../guide/tools-resources.md#rich-media)
- [Image Upload Best Practices](../../guide/tools-resources.md#content-management)
- [AT Protocol Media Guidelines](https://docs.bsky.app/docs/advanced-guides/posts#images)

