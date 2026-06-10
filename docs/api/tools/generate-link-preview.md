# generate_link_preview

Generate a link preview card for a URL to embed in posts.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `url` (required)

- **Type:** `string`
- **Description:** URL to generate preview for

## Response

```typescript
{
  success: boolean;
  message: string;
  preview: {
    uri: string;
    title: string;
    description: string;
    thumb?: {
      blob: {
        type: string;      // 'blob'
        ref: string;       // stringified CID
        mimeType: string;
        size: number;
      };
    };
  }
}
```

## Examples

### Generate Link Preview

```json
{
  "url": "https://example.com/article"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Link preview generated for https://example.com/article",
  "preview": {
    "uri": "https://example.com/article",
    "title": "Understanding AT Protocol",
    "description": "A comprehensive guide to the AT Protocol architecture and features",
    "thumb": {
      "blob": {
        "type": "blob",
        "ref": "bafyreiabc123...",
        "mimeType": "image/jpeg",
        "size": 45678
      }
    }
  }
}
```

## How It Works

The tool:

1. Fetches the URL
2. Extracts Open Graph or meta tags
3. Downloads and uploads the preview image
4. Returns structured preview data

## Extracted Data

### Title

- Open Graph: `og:title`
- Fallback: `<title>` tag
- Max length: 300 characters

### Description

- Open Graph: `og:description`
- Fallback: `<meta name="description">`
- Max length: 1000 characters

### Image

- Open Graph: `og:image` only (if the page has no `og:image`, the preview is
  returned without a thumbnail)
- The image is downloaded over an SSRF-safe fetch (capped at 1MB) and uploaded
  **as-is** — it is not resized, re-encoded, or otherwise optimized
- If the `og:image` is larger than 1MB or cannot be fetched, the thumbnail is
  omitted

## Error Handling

### Common Errors

#### Invalid URL

```json
{
  "error": "Invalid URL format",
  "code": "VALIDATION_ERROR"
}
```

#### URL Not Accessible

A non-2xx response throws `Failed to fetch URL: <status>`, which surfaces with
code `TOOL_EXECUTION_ERROR`. There is no dedicated `FETCH_ERROR` code.

```json
{
  "error": "Failed to fetch URL: 404",
  "code": "TOOL_EXECUTION_ERROR"
}
```

#### Missing Preview Metadata

There is no "no preview data" error. When `og:title`, `og:description`, and
`og:image` are missing, the tool still returns success: the title falls back to
the URL hostname, the description falls back to an empty string, and the
thumbnail is omitted.

## Best Practices

### URL Validation

- Validate URLs before generating previews
- Handle redirects appropriately
- Check for HTTPS when possible

### Caching

- Cache preview data for frequently shared URLs
- Set reasonable cache expiration (24 hours)
- Invalidate cache for dynamic content

### Performance

- Generate previews asynchronously
- Show loading state to users
- Implement timeout for slow URLs
- Provide fallback for failed previews

### User Experience

- Allow users to edit preview data
- Show preview before posting
- Provide option to remove preview
- Handle missing images gracefully

## Use Cases

### Social Sharing

- Share articles with rich previews
- Display website information
- Enhance link visibility

### Content Curation

- Create link collections
- Build reading lists
- Share resources

## Related Tools

- **[create_post](./create-post.md)** - Create posts with link embeds and rich
  formatting

## See Also

- [Content Management Examples](../../examples/content-management.md)
- [Link Preview Guide](../../guide/tools-resources.md#link-previews)
