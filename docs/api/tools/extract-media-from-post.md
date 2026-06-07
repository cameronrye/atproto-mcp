# extract_media_from_post

Extract all media content from a post or thread. Returns images, videos,
external links, and quote posts. Optionally includes media from entire thread.

## Authentication

**Enhanced** - This tool works without authentication but provides better
results when authenticated.

## Parameters

| Parameter              | Type      | Required | Default | Description                                         |
| ---------------------- | --------- | -------- | ------- | --------------------------------------------------- |
| `uri`                  | `string`  | Yes      | -       | AT-URI of the post to extract media from.           |
| `includeThread`        | `boolean` | No       | `false` | Whether to extract media from the entire thread.    |
| `includeEmbeds`        | `boolean` | No       | `true`  | Whether to include embedded media (images, videos). |
| `includeExternalLinks` | `boolean` | No       | `true`  | Whether to include external links and previews.     |

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative. `aspectRatio` is passed through directly from the post's embed
view and is often `undefined` (it is only present when the original post
declared it).

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

- **Invalid AT-URI**: The `uri` is not a valid `at://` post URI
- **Post not found or blocked**: The post does not exist, was deleted, or is
  blocked
- Errors are returned as MCP error objects; the exact wording may vary.

## Media Types

### Images

- Embedded images from posts (`fullsize` URL plus `thumb`)
- Includes alt text (if provided)
- `aspectRatio` passthrough from the embed (may be undefined)

### Videos

- Embedded videos from posts (HLS `playlist` URL plus `thumbnail`)
- Includes alt text (if provided)
- `aspectRatio` passthrough from the embed (may be undefined)

### External Links

- Link previews with metadata
- Title and description
- Thumbnail image (if available)
- Original URL

### Quote Posts

- Posts quoted/embedded in the original post
- URI and CID for fetching full post data
- Can contain their own media (handled via `recordWithMedia` embeds)

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
- **Content Curation**: Extract media for sharing or reuse
- **Accessibility Auditing**: Check alt text coverage
- **Link Extraction**: Collect external resources from posts

## Rate Limiting

Subject to the server's per-tool limit of 100 requests per minute. With
`includeThread: true`, the tool still issues a single `getPostThread` call but
processes more posts from the returned thread.

## Related Tools

- **[get_thread](./get-thread.md)** - Get complete thread structure
- **[get_post_context](./get-post-context.md)** - Get post with full context
- **[analyze_image](./analyze-image.md)** - Analyze image metadata
- **[upload_image](./upload-image.md)** - Upload images
- **[upload_video](./upload-video.md)** - Upload videos

## See Also

- [Rich Media Guide](../../guide/tools-resources.md#rich-media)
- [Data Retrieval Guide](../../guide/tools-resources.md#data-retrieval)
