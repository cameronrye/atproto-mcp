# like_post

Like a post on AT Protocol.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `uri` (required)
- **Type:** `string`
- **Description:** AT Protocol URI of the post to like

### `cid` (required)
- **Type:** `string`
- **Description:** Content identifier (CID) of the post

## Response

```typescript
{
  uri: string;        // URI of the like record
  cid: string;        // CID of the like record
  success: boolean;   // Operation success status
  message: string;    // Success message
  likedPost: {
    uri: string;      // URI of the liked post
    cid: string;      // CID of the liked post
  }
}
```

## Examples

### Like a Post

```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz789",
  "cid": "bafyreiabc123..."
}
```

**Response:**
```json
{
  "uri": "at://did:plc:myuser/app.bsky.feed.like/like123",
  "cid": "bafyreidef456...",
  "success": true,
  "message": "Post liked successfully",
  "likedPost": {
    "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz789",
    "cid": "bafyreiabc123..."
  }
}
```

### Already Liked Post

If the post is already liked, the tool returns the existing like record:

```json
{
  "uri": "at://did:plc:myuser/app.bsky.feed.like/like123",
  "cid": "bafyreidef456...",
  "success": true,
  "message": "Post was already liked",
  "likedPost": {
    "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz789",
    "cid": "bafyreiabc123..."
  }
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

## Best Practices

- Check if a post is already liked before calling this tool to avoid unnecessary operations
- Store the like URI if you need to unlike the post later
- Respect rate limits when liking multiple posts

## Related Tools

- **[unlike_post](./unlike-post.md)** - Remove a like from a post
- **[repost](./repost.md)** - Repost content

## See Also

- [Social Operations Examples](../../examples/social-operations.md)

