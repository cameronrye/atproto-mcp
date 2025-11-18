# extract_media_from_post

Extract all media content from a post or thread. Returns images, videos, external links, and quote posts. Optionally includes media from entire thread.

## Authentication

**Enhanced** - This tool works without authentication but provides better results when authenticated.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `uri` | `string` | Yes | - | AT-URI of the post to extract media from. |
| `includeThread` | `boolean` | No | `false` | Whether to extract media from the entire thread. |
| `includeEmbeds` | `boolean` | No | `true` | Whether to include embedded media (images, videos). |
| `includeExternalLinks` | `boolean` | No | `true` | Whether to include external links and previews. |

## Response

```typescript
{
  success: boolean;
  media: {
    images: Array<{
      uri: string;
      alt?: string;
      aspectRatio?: { width: number; height: number };
      blob?: any;
    }>;
    videos: Array<{
      uri: string;
      alt?: string;
      aspectRatio?: { width: number; height: number };
      blob?: any;
    }>;
    externalLinks: Array<{
      uri: string;
      title?: string;
      description?: string;
      thumb?: string;
    }>;
    quotePosts: Array<{
      uri: string;
      cid: string;
    }>;
  };
  threadMedia?: Array<any>;
}
```

## Examples

### Extract Media from Single Post

```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz1",
  "includeThread": false,
  "includeEmbeds": true,
  "includeExternalLinks": true
}
```

### Extract Media from Entire Thread

```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz1",
  "includeThread": true
}
```

### Extract Images Only

```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz1",
  "includeEmbeds": true,
  "includeExternalLinks": false
}
```

## Error Handling

Common errors:

- **`InvalidRequest`**: Invalid URI or parameters
- **`InvalidAtUri`**: URI is not a valid AT-URI
- **`PostNotFound`**: Post does not exist or has been deleted
- **`PostBlocked`**: Post is from a blocked user
- **`RateLimitExceeded`**: Too many requests in a short period

## Best Practices

1. **Check Media Availability**: Verify media exists before attempting to download
2. **Include Thread**: Set `includeThread: true` for comprehensive media extraction
3. **Filter by Type**: Use `includeEmbeds` and `includeExternalLinks` to filter media types
4. **Handle Alt Text**: Always use provided alt text for accessibility
5. **Respect Aspect Ratios**: Maintain aspect ratios when displaying images
6. **Cache Media**: Store extracted media to avoid repeated API calls
7. **Check Blob References**: Verify blob references are valid before downloading

## Media Types

### Images
- Embedded images from posts
- Includes alt text (if provided)
- Aspect ratio information
- Blob reference for downloading

### Videos
- Embedded videos from posts
- Includes alt text (if provided)
- Aspect ratio information
- Blob reference for downloading

### External Links
- Link previews with metadata
- Title and description
- Thumbnail image (if available)
- Original URL

### Quote Posts
- Posts quoted/embedded in the original post
- URI and CID for fetching full post data
- Can contain their own media

## Thread Media Extraction

When `includeThread: true`:
- Extracts media from all posts in the thread
- Includes parent posts and replies
- Returns array of media grouped by post
- Useful for archiving or analyzing thread content

## AT-URI Format

AT-URIs must follow this format:
```
at://did:plc:USER_DID/app.bsky.feed.post/POST_ID
```

Example:
```
at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3k7qe4smwe22t
```

## Use Cases

- **Content Archiving**: Save all media from important posts
- **Media Analysis**: Analyze media usage patterns
- **Content Curation**: Extract media for sharing or reuse
- **Accessibility Auditing**: Check alt text coverage
- **Thread Documentation**: Archive complete thread media
- **Link Extraction**: Collect external resources from posts

## Rate Limiting

This tool is subject to AT Protocol API rate limits:

- 3,000 requests per hour for authenticated users
- 300 requests per hour for unauthenticated users
- Thread extraction may require multiple API calls

## Related Tools

- **[get_thread](./get-thread.md)** - Get complete thread structure
- **[get_post_context](#get-post-context)** - Get post with full context
- **[analyze_image](#analyze-image)** - Analyze image metadata
- **[upload_image](./upload-image.md)** - Upload images
- **[upload_video](./upload-video.md)** - Upload videos

## See Also

- [Rich Media Guide](../../guide/tools-resources.md#rich-media)
- [Data Retrieval Guide](../../guide/tools-resources.md#data-retrieval)

