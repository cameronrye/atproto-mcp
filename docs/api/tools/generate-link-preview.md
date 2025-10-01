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
  preview: {
    uri: string;
    title: string;
    description: string;
    thumb?: {
      $type: string;
      ref: {
        $link: string;
      };
      mimeType: string;
      size: number;
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
  "preview": {
    "uri": "https://example.com/article",
    "title": "Understanding AT Protocol",
    "description": "A comprehensive guide to the AT Protocol architecture and features",
    "thumb": {
      "$type": "blob",
      "ref": {
        "$link": "bafyreiabc123..."
      },
      "mimeType": "image/jpeg",
      "size": 45678
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
- Open Graph: `og:image`
- Fallback: First large image on page
- Automatically resized and optimized

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
```json
{
  "error": "Failed to fetch URL",
  "code": "FETCH_ERROR"
}
```

#### No Preview Data
```json
{
  "error": "No preview data found for URL",
  "code": "NO_PREVIEW_DATA"
}
```

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

- **[create_post](./create-post.md)** - Create posts with link embeds
- **[create_rich_text_post](./create-rich-text-post.md)** - Create posts with rich formatting

## See Also

- [Content Management Examples](../../examples/content-management.md)
- [Link Preview Guide](../../guide/tools-resources.md#link-previews)

