# create_rich_text_post

Create a post with rich text formatting including mentions, links, and hashtags.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `text` (required)

- **Type:** `string`
- **Constraints:** 1-300 characters
- **Description:** Post text with rich formatting

### `facets` (optional)

- **Type:** `Array<Facet>`
- **Description:** Rich text facets (mentions, links, hashtags). The server maps
  these into the AT Protocol `app.bsky.richtext.facet` shape before posting.

### `embed` (optional)

- **Type:** `object`
- **Description:** Embedded content. Has a `type` discriminator (`"images"`,
  `"external"`, or `"record"`) plus the matching field:
  - `type: "images"` with `images`: array (max 4) of
    `{ filePath: string, alt: string }`. `filePath` is a local image path the
    server uploads to obtain a blob.
  - `type: "external"` with `external`:
    `{ uri: string, title: string, description: string, thumbFilePath?: string }`.
  - `type: "record"` with `record`: `{ uri: string, cid: string }` to quote
    another record.

## Facet Shape

Each facet has a UTF-8 byte range and one or more features. A feature is
`{ type, value }` where `type` is one of `"mention"`, `"link"`, or `"hashtag"`:

- **mention** — `value` is the target DID
- **link** — `value` is the URL
- **hashtag** — `value` is the tag text (without the `#`)

```typescript
{
  index: {
    byteStart: number; // UTF-8 byte offset, inclusive
    byteEnd: number; // UTF-8 byte offset, exclusive
  }
  features: Array<{
    type: 'mention' | 'link' | 'hashtag';
    value: string;
  }>;
}
```

## Response

Returned as stringified JSON text content (shape illustrative):

```typescript
{
  success: boolean;
  message: string;
  post: {
    uri: string;
    cid: string;
    text: string;
    facets?: unknown[];   // mapped into app.bsky.richtext.facet form
    embed?: unknown;
    createdAt: string;
  };
}
```

## Examples

### Post with Mention

```json
{
  "text": "Great work @alice.bsky.social!",
  "facets": [
    {
      "index": {
        "byteStart": 11,
        "byteEnd": 30
      },
      "features": [
        {
          "type": "mention",
          "value": "did:plc:abc123"
        }
      ]
    }
  ]
}
```

### Post with Link

```json
{
  "text": "Check out this article: https://example.com",
  "facets": [
    {
      "index": {
        "byteStart": 24,
        "byteEnd": 43
      },
      "features": [
        {
          "type": "link",
          "value": "https://example.com"
        }
      ]
    }
  ]
}
```

### Post with Hashtag

```json
{
  "text": "Loving the #atproto community!",
  "facets": [
    {
      "index": {
        "byteStart": 11,
        "byteEnd": 19
      },
      "features": [
        {
          "type": "hashtag",
          "value": "atproto"
        }
      ]
    }
  ]
}
```

### Post with Multiple Facets

```json
{
  "text": "Hey @alice check out #atproto at https://atproto.com",
  "facets": [
    {
      "index": { "byteStart": 4, "byteEnd": 10 },
      "features": [
        {
          "type": "mention",
          "value": "did:plc:abc123"
        }
      ]
    },
    {
      "index": { "byteStart": 21, "byteEnd": 29 },
      "features": [
        {
          "type": "hashtag",
          "value": "atproto"
        }
      ]
    },
    {
      "index": { "byteStart": 33, "byteEnd": 53 },
      "features": [
        {
          "type": "link",
          "value": "https://atproto.com"
        }
      ]
    }
  ]
}
```

## Error Handling

### Common Errors

#### Invalid Byte Indices

```json
{
  "error": "Facet byte indices are invalid",
  "code": "VALIDATION_ERROR"
}
```

#### Invalid DID

```json
{
  "error": "Invalid DID format for mention",
  "code": "VALIDATION_ERROR"
}
```

## Best Practices

### Byte Indices

- Use UTF-8 byte positions, not character positions
- Ensure indices don't overlap
- Validate indices before submission

### Mentions

- Resolve handles to DIDs before creating facets
- Verify user exists before mentioning
- Limit mentions to avoid spam

### Links

- Use full URLs with protocol (https://)
- Validate URLs before creating facets
- Consider using link previews

### Hashtags

- Use lowercase for tags
- Remove # symbol from tag value
- Keep tags relevant and specific

## Related Tools

- **[create_post](./create-post.md)** - Create simple posts
- **[generate_link_preview](./generate-link-preview.md)** - Generate link
  previews

## See Also

- [Content Management Examples](../../examples/content-management.md)
- [Tools & Resources Guide](../../guide/tools-resources.md#content-management)
