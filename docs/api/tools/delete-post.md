# delete_post

Delete a post from AT Protocol.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `uri` (required)
- **Type:** `string`
- **Description:** AT Protocol URI of the post to delete

## Response

```typescript
{
  success: boolean;
  message: string;
  deletedPost: {
    uri: string;
  }
}
```

## Examples

### Delete a Post

```json
{
  "uri": "at://did:plc:myuser/app.bsky.feed.post/post123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Post deleted successfully",
  "deletedPost": {
    "uri": "at://did:plc:myuser/app.bsky.feed.post/post123"
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

#### Not Authorized
```json
{
  "error": "Not authorized to delete this post",
  "code": "UNAUTHORIZED"
}
```

## Best Practices

### Permissions
- You can only delete your own posts
- Verify ownership before attempting deletion
- Handle authorization errors gracefully

### Cascading Effects
- Deleting a post doesn't delete replies to it
- Likes and reposts of the deleted post become invalid
- Thread structure is maintained with deleted posts

### User Experience
- Confirm deletion with users before executing
- Provide undo functionality if possible
- Show clear feedback after deletion

## Related Tools

- **[create_post](./create-post.md)** - Create a post
- **[get_thread](./get-thread.md)** - View post threads

## See Also

- [Content Management Examples](../../examples/content-management.md)

