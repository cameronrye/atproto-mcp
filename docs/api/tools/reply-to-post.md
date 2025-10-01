# reply_to_post

Reply to an existing post on AT Protocol with proper threading support.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `text` (required)
- **Type:** `string`
- **Constraints:** 
  - Minimum length: 1 character
  - Maximum length: 300 characters
- **Description:** The text content of the reply

### `root` (required)
- **Type:** `string`
- **Description:** AT Protocol URI of the root post in the thread (the first post)

### `parent` (required)
- **Type:** `string`
- **Description:** AT Protocol URI of the immediate parent post you're replying to

### `langs` (optional)
- **Type:** `string[]`
- **Description:** Array of ISO 639-1 language codes
- **Example:** `["en", "es"]`

## Response

```typescript
{
  uri: string;        // URI of the created reply
  cid: string;        // Content identifier of the reply
  success: boolean;   // Operation success status
  message: string;    // Success message
  replyTo: {
    root: string;     // Root post URI
    parent: string;   // Parent post URI
  }
}
```

## Examples

### Simple Reply

```json
{
  "text": "Great point! I totally agree.",
  "root": "at://did:plc:abc123/app.bsky.feed.post/root123",
  "parent": "at://did:plc:abc123/app.bsky.feed.post/root123"
}
```

### Reply to a Reply (Nested Thread)

```json
{
  "text": "Thanks for the clarification!",
  "root": "at://did:plc:abc123/app.bsky.feed.post/root123",
  "parent": "at://did:plc:def456/app.bsky.feed.post/reply456"
}
```

### Reply with Language Tags

```json
{
  "text": "Merci beaucoup! Thank you!",
  "root": "at://did:plc:abc123/app.bsky.feed.post/root123",
  "parent": "at://did:plc:abc123/app.bsky.feed.post/root123",
  "langs": ["fr", "en"]
}
```

## Error Handling

### Common Errors

#### Missing Root or Parent
```json
{
  "error": "Root post URI is required",
  "code": "VALIDATION_ERROR"
}
```

#### Invalid URI Format
```json
{
  "error": "Invalid AT Protocol URI format",
  "code": "VALIDATION_ERROR"
}
```

#### Post Not Found
```json
{
  "error": "Parent post not found",
  "code": "NOT_FOUND"
}
```

## Best Practices

### Threading
- **Root:** Always set to the first post in the thread
- **Parent:** Set to the immediate post you're replying to
- For direct replies to the original post, `root` and `parent` are the same

### Content
- Keep replies focused and relevant to the parent post
- Use @mentions to notify specific users
- Consider thread context when replying

## Related Tools

- **[create_post](./create-post.md)** - Create standalone posts
- **[get_thread](./get-thread.md)** - View entire thread context

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
- [Threading Guide](../../guide/tools-resources.md#threading)

