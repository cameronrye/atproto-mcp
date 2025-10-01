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
- **Description:** Rich text facets (mentions, links, tags)

### `reply` (optional)
- **Type:** `object`
- **Description:** Reply information
- **Properties:**
  - `root`: Root post URI
  - `parent`: Parent post URI

### `embed` (optional)
- **Type:** `object`
- **Description:** Embedded content

### `langs` (optional)
- **Type:** `string[]`
- **Description:** Language codes

## Facet Types

### Mention
```typescript
{
  index: {
    byteStart: number;
    byteEnd: number;
  };
  features: [{
    $type: "app.bsky.richtext.facet#mention";
    did: string;
  }];
}
```

### Link
```typescript
{
  index: {
    byteStart: number;
    byteEnd: number;
  };
  features: [{
    $type: "app.bsky.richtext.facet#link";
    uri: string;
  }];
}
```

### Tag (Hashtag)
```typescript
{
  index: {
    byteStart: number;
    byteEnd: number;
  };
  features: [{
    $type: "app.bsky.richtext.facet#tag";
    tag: string;
  }];
}
```

## Response

```typescript
{
  uri: string;
  cid: string;
  success: boolean;
  message: string;
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
          "$type": "app.bsky.richtext.facet#mention",
          "did": "did:plc:abc123"
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
          "$type": "app.bsky.richtext.facet#link",
          "uri": "https://example.com"
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
          "$type": "app.bsky.richtext.facet#tag",
          "tag": "atproto"
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
      "features": [{
        "$type": "app.bsky.richtext.facet#mention",
        "did": "did:plc:abc123"
      }]
    },
    {
      "index": { "byteStart": 21, "byteEnd": 29 },
      "features": [{
        "$type": "app.bsky.richtext.facet#tag",
        "tag": "atproto"
      }]
    },
    {
      "index": { "byteStart": 33, "byteEnd": 53 },
      "features": [{
        "$type": "app.bsky.richtext.facet#link",
        "uri": "https://atproto.com"
      }]
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
- **[generate_link_preview](./generate-link-preview.md)** - Generate link previews

## See Also

- [Content Management Examples](../../examples/content-management.md)
- [Rich Text Guide](../../guide/tools-resources.md#rich-text)

