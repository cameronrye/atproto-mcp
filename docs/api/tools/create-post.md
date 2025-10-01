# create_post

Create a new post on AT Protocol with support for text, replies, images, external links, and language tags.

## Authentication

**Required:** Yes (Private tool)

This tool requires authentication using either app passwords or OAuth.

## Parameters

### `text` (required)
- **Type:** `string`
- **Constraints:** 
  - Minimum length: 1 character
  - Maximum length: 300 characters
- **Description:** The text content of the post

### `reply` (optional)
- **Type:** `object`
- **Description:** Reply information if this post is a reply to another post
- **Properties:**
  - `root` (required): `string` - URI of the root post in the thread
  - `parent` (required): `string` - URI of the immediate parent post

### `embed` (optional)
- **Type:** `object`
- **Description:** Embedded content (images or external links)
- **Properties:**
  - `images` (optional): Array of image objects (max 4)
    - `alt` (required): `string` - Alt text for accessibility (max 1000 characters)
    - `image` (required): `Blob` - Image file data
  - `external` (optional): External link object
    - `uri` (required): `string` - Valid URL
    - `title` (required): `string` - Link title (max 300 characters)
    - `description` (required): `string` - Link description (max 1000 characters)

### `langs` (optional)
- **Type:** `string[]`
- **Description:** Array of ISO 639-1 language codes (2 characters each)
- **Example:** `["en", "es"]`

## Response

Returns an object with the following properties:

```typescript
{
  uri: string;        // AT Protocol URI of the created post
  cid: string;        // Content identifier (CID) of the post
  success: boolean;   // Whether the operation succeeded
  message: string;    // Success message
}
```

## Examples

### Basic Text Post

```json
{
  "text": "Hello from the AT Protocol MCP Server! 👋"
}
```

**Response:**
```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz789",
  "cid": "bafyreiabc123...",
  "success": true,
  "message": "Post created successfully"
}
```

### Post with Language Tags

```json
{
  "text": "Bonjour le monde! Hello world!",
  "langs": ["fr", "en"]
}
```

### Reply to a Post

```json
{
  "text": "Great point! I totally agree.",
  "reply": {
    "root": "at://did:plc:abc123/app.bsky.feed.post/root123",
    "parent": "at://did:plc:abc123/app.bsky.feed.post/parent456"
  }
}
```

### Post with Images

```json
{
  "text": "Check out these amazing photos!",
  "embed": {
    "images": [
      {
        "alt": "A beautiful sunset over the ocean",
        "image": "<Blob data>"
      },
      {
        "alt": "Mountains in the distance",
        "image": "<Blob data>"
      }
    ]
  }
}
```

### Post with External Link

```json
{
  "text": "Interesting article about AT Protocol",
  "embed": {
    "external": {
      "uri": "https://example.com/article",
      "title": "Understanding AT Protocol",
      "description": "A comprehensive guide to the AT Protocol architecture and features"
    }
  }
}
```

## Error Handling

### Common Errors

#### Authentication Required
```json
{
  "error": "Authentication required",
  "code": "AUTHENTICATION_FAILED"
}
```

#### Text Too Long
```json
{
  "error": "Post text cannot exceed 300 characters",
  "code": "VALIDATION_ERROR"
}
```

#### Too Many Images
```json
{
  "error": "Cannot attach more than 4 images",
  "code": "VALIDATION_ERROR"
}
```

#### Invalid Reply URI
```json
{
  "error": "Invalid AT Protocol URI format",
  "code": "VALIDATION_ERROR"
}
```

#### Rate Limit Exceeded
```json
{
  "error": "Rate limit exceeded. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

## Best Practices

### Text Content
- Keep posts concise and under 300 characters
- Use proper formatting and line breaks for readability
- Include relevant hashtags for discoverability

### Images
- Always provide descriptive alt text for accessibility
- Optimize images before uploading (recommended max 1MB per image)
- Use appropriate image formats (JPEG, PNG, WebP)
- Maximum 4 images per post

### Replies
- Always include both `root` and `parent` URIs when replying
- The `root` should be the first post in the thread
- The `parent` should be the immediate post you're replying to

### Language Tags
- Use ISO 639-1 two-letter language codes
- Include all languages present in the post text
- Helps with content filtering and discovery

### External Links
- Provide accurate and descriptive titles
- Write clear descriptions that summarize the linked content
- Ensure URLs are valid and accessible

## Rate Limiting

This tool is subject to AT Protocol rate limits:
- **Default limit:** 300 posts per hour
- **Burst limit:** 10 posts per minute

When rate limited, the tool will return a `RATE_LIMIT_EXCEEDED` error with a `retryAfter` value indicating seconds to wait.

## Related Tools

- **[reply_to_post](./reply-to-post.md)** - Simplified tool specifically for replies
- **[create_rich_text_post](./create-rich-text-post.md)** - Create posts with rich text formatting
- **[upload_image](./upload-image.md)** - Upload images separately before posting
- **[generate_link_preview](./generate-link-preview.md)** - Generate link preview data

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
- [Error Handling Guide](../../guide/error-handling.md)
- [Authentication Guide](../../guide/authentication.md)

