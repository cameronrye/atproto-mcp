# analyze_image

Analyze an image blob's metadata and provide optimization suggestions. Reports
the blob-declared file size and MIME type, plus recommendations for better
performance and accessibility.

::: tip Metadata only

This tool reads the blob's declared `size` and `mimeType`. It does **not**
decode the image, so it cannot report pixel dimensions or aspect ratio.

:::

## Authentication

**Optional** - This tool works without authentication.

## Parameters

| Parameter                        | Type      | Required | Default | Description                                     |
| -------------------------------- | --------- | -------- | ------- | ----------------------------------------------- |
| `blob`                           | `object`  | Yes      | -       | Image blob object with ref, mimeType, and size. |
| `blob.ref.$link`                 | `string`  | Yes      | -       | Blob reference link.                            |
| `blob.mimeType`                  | `string`  | Yes      | -       | MIME type of the image (e.g., `image/jpeg`).    |
| `blob.size`                      | `number`  | Yes      | -       | Size of the image in bytes.                     |
| `includeOptimizationSuggestions` | `boolean` | No       | `true`  | Whether to include optimization suggestions.    |

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

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

The tool validates the `blob` argument (it requires `ref.$link`, `mimeType`, and
a numeric `size`). A malformed `blob` is rejected as a schema validation error.
Any `mimeType` string is accepted; unrecognized formats simply fall through the
optimization heuristics rather than raising an "unsupported format" error.

## Supported Formats

- **JPEG** (`image/jpeg`): Best for photographs, lossy compression
- **PNG** (`image/png`): Best for graphics with transparency, lossless
  compression
- **WebP** (`image/webp`): Modern format with superior compression
- **GIF** (`image/gif`): Animated images (use sparingly, large file sizes)

## Optimization Heuristics

`isOptimized` is decided from the declared size and MIME type:

- **WebP / AVIF**: optimized under 500 KB
- **JPEG**: optimized under 300 KB
- **PNG**: optimized under 500 KB
- **Other formats**: optimized under 200 KB

## Common Suggestions

When `includeOptimizationSuggestions` is true, the tool may return text
suggestions such as:

- Compress images over 1 MB (or over 500 KB) for faster loading
- Convert PNG to WebP or JPEG for better compression
- Convert uncompressed formats (BMP, TIFF) to JPEG, PNG, or WebP
- Convert large GIFs to a video format (MP4)
- Use WebP for 25-35% better compression at the same quality
- Always include alt text for accessibility

## Accessibility

Always include alt text when using images:

- Describe what's in the image, not just "image of..."
- Keep alt text concise but descriptive
- Include important text that appears in the image

## Rate Limiting

This tool performs local analysis of blob metadata and does not call the AT
Protocol API. It is still subject to the server's per-tool limit of 100 requests
per minute.

## Related Tools

- **[upload_image](./upload-image.md)** - Upload images to AT Protocol
- **[get_post_context](./get-post-context.md)** - Extract media from a post with
  `includeMedia: true`
- **[create_post](./create-post.md)** - Create posts with images

## See Also

- [Rich Media Guide](../../guide/tools-resources.md#rich-media)
- [Image Upload Best Practices](../../guide/tools-resources.md#content-management)
- [AT Protocol Media Guidelines](https://docs.bsky.app/docs/advanced-guides/posts#images)
