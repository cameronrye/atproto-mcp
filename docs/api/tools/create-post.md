# create_post

Create a new post on AT Protocol with support for text, replies, images, a
video (from [upload_video](./upload-video.md)), external links, quote posts,
richtext facets, and language tags. This is the single rich post-creation tool
(it replaces the former `create_rich_text_post`):
mentions, links, and #hashtags in the text are auto-detected into richtext facets
unless you supply `facets` explicitly.

## Authentication

**Required:** Yes (Private tool)

This tool requires authentication using an app password (OAuth is not yet
implemented).

## Parameters

### `text` (required)

- **Type:** `string`
- **Constraints:**
  - Minimum length: 1 character
  - Maximum length: 300 graphemes / 3000 UTF-8 bytes (emoji count as one
    grapheme)
- **Description:** The text content of the post

### `reply` (optional)

- **Type:** `object`
- **Description:** Reply information if this post is a reply to another post
- **Properties:**
  - `root` (required): `string` - AT-URI of the root post in the thread
  - `parent` (required): `string` - AT-URI of the immediate parent post

> Both `root` and `parent` must reference `app.bsky.feed.post` records. An
> AT-URI naming any other record type (a like, a follow, …) is rejected with a
> validation error, since it would produce a structurally invalid reply.

### `embed` (optional)

- **Type:** `object`
- **Description:** Optional media embed: images OR an external link card OR a
  video (at most one). Mutually exclusive with `quote` — a post may carry
  images, an external link, a video, OR a quote (record), never a combination.
- **Properties:**
  - `images` (optional): Array of image objects (max 4)
    - `alt` (required): `string` - Alt text for accessibility (max 1000
      characters)
    - `image` (required): `object` - Pre-uploaded blob descriptor: pass the
      `image.blob` object returned by [upload_image](./upload-image.md)
      verbatim (`{ type: 'blob', ref, mimeType, size }`; `ref` may be the flat
      CID string or the lexicon `{ "$link": "<cid>" }` form). This tool does
      **not** accept raw image data — upload first, then reference the blob.
  - `external` (optional): External link object
    - `uri` (required): `string` - Valid URL
    - `title` (required): `string` - Link title (max 300 characters)
    - `description` (required): `string` - Link description (max 1000
      characters)
    - `thumb` (optional): `object` - Thumbnail for the link card as a
      pre-uploaded blob descriptor: pass the `preview.thumb.blob` object from
      [generate_link_preview](./generate-link-preview.md) (or the `image.blob`
      from [upload_image](./upload-image.md)) verbatim. Omit for a card without
      a thumbnail.
  - `video` (optional): A video embed (`app.bsky.embed.video`)
    - `video` (required): `object` - Pre-uploaded **processed** video blob
      descriptor: pass the `video.blob` object returned by
      [upload_video](./upload-video.md) verbatim
      (`{ type: 'blob', ref, mimeType, size }`; `ref` may be the flat CID
      string or the lexicon `{ "$link": "<cid>" }` form). The video must
      already have been uploaded and transcoded by the video service — this
      tool does **not** accept raw video data.
    - `captions` (optional): Array of caption tracks (max 20)
      - `lang` (required): `string` - BCP-47 language code for the caption
        track (at least 2 characters, e.g. `"en"`, `"fr"`, `"pt-BR"`)
      - `file` (required): `object` - Pre-uploaded WebVTT caption blob
        descriptor: pass a `video.captions[].file` object from
        [upload_video](./upload-video.md) verbatim
    - `alt` (optional): `string` - Alt text describing the video for
      accessibility (max 1000 characters)
    - `aspectRatio` (optional): `object` - Aspect ratio hint clients use to
      reserve layout space before the video loads
      - `width` (required): `number` - Width component (positive integer)
      - `height` (required): `number` - Height component (positive integer)

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
  `embed.images`, `embed.external`, and `embed.video`.
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

Images must be uploaded first with [upload_image](./upload-image.md); pass each
returned `image.blob` object verbatim as `embed.images[].image`:

```json
{
  "text": "Check out these amazing photos!",
  "embed": {
    "images": [
      {
        "alt": "A beautiful sunset over the ocean",
        "image": {
          "type": "blob",
          "ref": "bafkreiabc123...",
          "mimeType": "image/jpeg",
          "size": 245678
        }
      },
      {
        "alt": "Mountains in the distance",
        "image": {
          "type": "blob",
          "ref": "bafkreidef456...",
          "mimeType": "image/png",
          "size": 198432
        }
      }
    ]
  }
}
```

### Post with Video

Upload the video first with [upload_video](./upload-video.md) — it returns the
**processed** blob descriptor once the video service finishes transcoding.
Suppose it returned:

```json
{
  "success": true,
  "message": "Video uploaded and processed successfully from ./videos/tutorial.mp4",
  "video": {
    "blob": {
      "type": "blob",
      "ref": "bafkreivideo123...",
      "mimeType": "video/mp4",
      "size": 4853210
    },
    "alt": "Tutorial on using AT Protocol",
    "jobId": "rmpdzv4uoctlginpv3oddi6w",
    "captions": [
      {
        "lang": "en",
        "file": {
          "type": "blob",
          "ref": "bafkreicaption789...",
          "mimeType": "text/vtt",
          "size": 1843
        }
      }
    ]
  }
}
```

Then pass `video.blob` verbatim as `embed.video.video` and each
`video.captions[]` entry verbatim under `embed.video.captions`:

```json
{
  "text": "New tutorial is up! 🎬",
  "embed": {
    "video": {
      "video": {
        "type": "blob",
        "ref": "bafkreivideo123...",
        "mimeType": "video/mp4",
        "size": 4853210
      },
      "alt": "Tutorial on using AT Protocol",
      "aspectRatio": { "width": 16, "height": 9 },
      "captions": [
        {
          "lang": "en",
          "file": {
            "type": "blob",
            "ref": "bafkreicaption789...",
            "mimeType": "text/vtt",
            "size": 1843
          }
        }
      ]
    }
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

### Post with External Link and Thumbnail

Call [generate_link_preview](./generate-link-preview.md) first, then reuse its
`preview` fields — including the `preview.thumb.blob` descriptor — so the link
card carries a thumbnail:

```json
{
  "text": "Interesting article about AT Protocol",
  "embed": {
    "external": {
      "uri": "https://example.com/article",
      "title": "Understanding AT Protocol",
      "description": "A comprehensive guide to the AT Protocol architecture and features",
      "thumb": {
        "type": "blob",
        "ref": "bafkreighi789...",
        "mimeType": "image/jpeg",
        "size": 45678
      }
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

The limit is 300 graphemes and 3000 UTF-8 bytes, counted on graphemes so
emoji-heavy posts are not falsely rejected:

```json
{
  "error": "Post text is 312 graphemes; the maximum is 300.",
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

A post can include only one embed: images, an external link, a video, or a
quote (record) — not a combination.

```json
{
  "error": "A post can include only one embed: images, an external link, a video, or a quote (record) — not a combination. Provide only one.",
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

- Keep posts concise and within 300 graphemes (3000 UTF-8 bytes)
- Use proper formatting and line breaks for readability
- Include relevant hashtags for discoverability

### Images

- Upload images first with `upload_image`, then pass each returned `image.blob`
  descriptor as `embed.images[].image`
- Always provide descriptive alt text for accessibility
- Maximum 4 images per post (Bluesky platform limit)

### Video

- Upload the video first with `upload_video` (it waits for the video service to
  finish transcoding), then pass the returned `video.blob` descriptor as
  `embed.video.video`
- Pass any `video.captions[].file` descriptors from `upload_video` verbatim as
  `embed.video.captions[].file` (max 20 caption tracks)
- Provide `alt` text, and an `aspectRatio` hint when you know the dimensions
- One video per post; a video cannot be combined with images, an external link,
  or a quote

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
- **[upload_video](./upload-video.md)** - Upload and process a video before
  posting
- **[generate_link_preview](./generate-link-preview.md)** - Generate link
  preview data

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
- [Error Handling Guide](../../guide/error-handling.md)
- [Authentication Guide](../../guide/authentication.md)
