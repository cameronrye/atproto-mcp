# create_post

Create a new post on AT Protocol with support for text, replies, images,
external links, quote posts, richtext facets, and language tags. This is the
single rich post-creation tool (it replaces the former `create_rich_text_post`):
mentions, links, and #hashtags in the text are auto-detected into richtext facets
unless you supply `facets` explicitly.

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
- **Description:** Optional media embed: images OR an external link card (at most
  one). Mutually exclusive with `quote` — a post may carry images, an external
  link, OR a quote (record), never a combination.
- **Properties:**
  - `images` (optional): Array of image objects (max 4)
    - `alt` (required): `string` - Alt text for accessibility (max 1000
      characters)
    - `image` (required): `Blob` - Image file data
  - `external` (optional): External link object
    - `uri` (required): `string` - Valid URL
    - `title` (required): `string` - Link title (max 300 characters)
    - `description` (required): `string` - Link description (max 1000
      characters)

### `facets` (optional)

- **Type:** `object[]`
- **Description:** Explicit richtext facets (byte-range annotations). Omit to let
  the server auto-detect mentions, links, and #hashtags from the text. Supplying
  `facets` disables auto-detection (applying both would double-annotate the
  text).
- **Properties (per facet):**
  - `index` (required): `object` - UTF-8 byte range of the annotated span
    - `byteStart` (required): `number` - Start byte offset (UTF-8), inclusive
    - `byteEnd` (required): `number` - End byte offset (UTF-8), exclusive
  - `features` (required): Array of feature objects applied to the span
    - `type` (required): `"mention"` | `"link"` | `"hashtag"`
    - `value` (required): `string` - For a mention, a handle or DID; for a link,
      the URL; for a hashtag, the tag without the leading `#`

> Caller-supplied facets are validated: each byte range must satisfy
> `byteStart < byteEnd <= textByteLength` (the text's UTF-8 byte length), and
> mention handles are resolved to DIDs.

### `quote` (optional)

- **Type:** `object`
- **Description:** Quote another post (record embed). Mutually exclusive with
  `embed.images` and `embed.external`.
- **Properties:**
  - `uri` (required): `string` - AT-URI of the post to quote
  - `cid` (required): `string` - CID (content hash) of the quoted post

### `langs` (optional)

- **Type:** `string[]`
- **Description:** Array of BCP-47 language tags (e.g. `"en"`, `"en-US"`,
  `"pt-BR"`)
- **Example:** `["en", "es"]`

## Response

Returns an object with the following properties:

```typescript
{
  uri: string; // AT Protocol URI of the created post
  cid: string; // Content identifier (CID) of the post
  success: boolean; // Whether the operation succeeded
  message: string; // Success message
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

### Quote Post

```json
{
  "text": "This is a great take 👇",
  "quote": {
    "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz789",
    "cid": "bafyreiabc123..."
  }
}
```

### Post with Explicit Richtext Facets

Link the text "AT Protocol" (bytes 11-22) to a URL instead of relying on
auto-detection:

```json
{
  "text": "Read about AT Protocol today!",
  "facets": [
    {
      "index": { "byteStart": 11, "byteEnd": 22 },
      "features": [{ "type": "link", "value": "https://atproto.com" }]
    }
  ]
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

#### Multiple Embeds Combined

A post can include only one embed: images, an external link, or a quote
(record) — not a combination.

```json
{
  "error": "A post can include only one embed: images, an external link, or a quote (record) — not a combination. Provide only one.",
  "code": "VALIDATION_ERROR"
}
```

#### Rate Limit Exceeded (this server's per-tool limit)

When this server's own per-tool limit is exceeded, the tool returns an MCP error
with code `InternalError` and no machine-readable `retryAfter` value:

```json
{
  "error": "Rate limit exceeded for tool \"create_post\". Please slow down and retry shortly.",
  "code": "InternalError"
}
```

#### Rate Limit Exceeded (upstream Bluesky API)

Separately, if the upstream Bluesky API returns an HTTP 429, the tool surfaces a
`RATE_LIMIT_EXCEEDED` error that includes a `retryAfter` value (seconds to wait)
derived from the response's `retry-after` header:

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
- Maximum 4 images per post (Bluesky platform limit)

### Replies

- Always include both `root` and `parent` URIs when replying
- The `root` should be the first post in the thread
- The `parent` should be the immediate post you're replying to

### Language Tags

- Use BCP-47 language tags (e.g. `en`, `en-US`, `pt-BR`)
- Include all languages present in the post text
- Helps with content filtering and discovery

### External Links

- Provide accurate and descriptive titles
- Write clear descriptions that summarize the linked content
- Ensure URLs are valid and accessible

## Rate Limiting

This server applies a per-tool rate limit of **100 requests per minute**. When
this server's own limit is exceeded, the tool returns an MCP error with code
`InternalError` and a message like
`Rate limit exceeded for tool "create_post". Please slow down and retry shortly.`
(no machine-readable `retryAfter` value).

Separately, if the upstream Bluesky API returns an HTTP 429, the tool surfaces a
`RATE_LIMIT_EXCEEDED` error that includes a `retryAfter` value (seconds to wait)
derived from the response's `retry-after` header.

## Related Tools

- **[reply_to_post](./reply-to-post.md)** - Simplified tool specifically for
  replies
- **[create_thread](./create-thread.md)** - Publish a multi-post chain in one
  call
- **[upload_image](./upload-image.md)** - Upload images separately before
  posting
- **[generate_link_preview](./generate-link-preview.md)** - Generate link
  preview data

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
- [Error Handling Guide](../../guide/error-handling.md)
- [Authentication Guide](../../guide/authentication.md)
