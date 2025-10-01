# unlike_post

Remove a like from a post on AT Protocol.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `likeUri` (required)
- **Type:** `string`
- **Description:** AT Protocol URI of the like record to delete (returned from `like_post`)

## Response

```typescript
{
  success: boolean;   // Operation success status
  message: string;    // Success message
  deletedLike: {
    uri: string;      // URI of the deleted like record
  }
}
```

## Examples

### Unlike a Post

```json
{
  "likeUri": "at://did:plc:myuser/app.bsky.feed.like/like123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Post unliked successfully",
  "deletedLike": {
    "uri": "at://did:plc:myuser/app.bsky.feed.like/like123"
  }
}
```

## Error Handling

### Common Errors

#### Invalid Like URI
```json
{
  "error": "Invalid AT Protocol URI format",
  "code": "VALIDATION_ERROR"
}
```

#### Like Not Found
```json
{
  "error": "Like record not found",
  "code": "NOT_FOUND"
}
```

## Best Practices

- Store the like URI when you like a post so you can unlike it later
- The like URI is different from the post URI - it's returned by `like_post`

## Related Tools

- **[like_post](./like-post.md)** - Like a post

## See Also

- [Social Operations Examples](../../examples/social-operations.md)

