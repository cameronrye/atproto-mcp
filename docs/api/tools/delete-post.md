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

#### Post Belongs to Another User

Before deleting, the tool verifies the post's DID matches the authenticated
session. If it does not, the operation fails:

```json
{
  "error": "Cannot delete post: post belongs to another user",
  "code": "TOOL_EXECUTION_ERROR"
}
```

## Best Practices

### Permissions

- You can only delete your own posts; the tool checks ownership before deleting

### Cascading Effects

- Deleting a post doesn't delete replies to it
- Likes and reposts of the deleted post become invalid

## Related Tools

- **[create_post](./create-post.md)** - Create a post
- **[get_post_context](./get-post-context.md)** - View post threads

## See Also

- [Content Management Examples](../../examples/content-management.md)
