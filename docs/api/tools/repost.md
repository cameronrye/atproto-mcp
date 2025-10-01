# repost

Repost content on AT Protocol with optional quote text.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `uri` (required)
- **Type:** `string`
- **Description:** AT Protocol URI of the post to repost

### `cid` (required)
- **Type:** `string`
- **Description:** Content identifier (CID) of the post

### `text` (optional)
- **Type:** `string`
- **Description:** Quote text to add commentary to the repost (creates a quote post)

## Response

```typescript
{
  uri: string;        // URI of the repost record
  cid: string;        // CID of the repost record
  success: boolean;   // Operation success status
  message: string;    // Success message
  repostedPost: {
    uri: string;      // URI of the reposted post
    cid: string;      // CID of the reposted post
  }
}
```

## Examples

### Simple Repost

```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz789",
  "cid": "bafyreiabc123..."
}
```

**Response:**
```json
{
  "uri": "at://did:plc:myuser/app.bsky.feed.repost/repost123",
  "cid": "bafyreidef456...",
  "success": true,
  "message": "Post reposted successfully",
  "repostedPost": {
    "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz789",
    "cid": "bafyreiabc123..."
  }
}
```

### Quote Post (Repost with Commentary)

```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz789",
  "cid": "bafyreiabc123...",
  "text": "This is exactly what I was thinking! Great insights."
}
```

## Error Handling

### Common Errors

#### Invalid URI
```json
{
  "error": "Invalid AT Protocol URI format",
  "code": "VALIDATION_ERROR"
}
```

#### Post Not Found
```json
{
  "error": "Post not found",
  "code": "NOT_FOUND"
}
```

#### Already Reposted
```json
{
  "error": "Post is already reposted",
  "code": "DUPLICATE"
}
```

## Best Practices

- Use quote posts (with `text`) to add your own commentary
- Store the repost URI if you need to unrepost later
- Check if you've already reposted before calling this tool

## Related Tools

- **[unrepost](./unrepost.md)** - Remove a repost
- **[like_post](./like-post.md)** - Like a post

## See Also

- [Social Operations Examples](../../examples/social-operations.md)

