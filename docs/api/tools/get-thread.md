# get_thread

View a complete post thread with all replies and context.

## Authentication

**Optional:** Public tool (works without authentication)

## Parameters

### `uri` (required)
- **Type:** `string`
- **Description:** AT Protocol URI of any post in the thread

### `depth` (optional)
- **Type:** `number`
- **Default:** `6`
- **Description:** Maximum depth of replies to fetch

## Response

```typescript
{
  success: boolean;
  thread: {
    post: Post;           // The requested post
    parent?: Thread;      // Parent post (if reply)
    replies?: Thread[];   // Reply threads
  }
}
```

## Examples

### Get Thread

```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz789"
}
```

### Get Thread with Limited Depth

```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz789",
  "depth": 3
}
```

## Thread Structure

### Root Post
- The first post in the conversation
- Has no parent
- May have many replies

### Reply Post
- Has a parent post
- May have its own replies
- Part of a thread chain

### Thread Depth
- **Depth 0**: Just the requested post
- **Depth 1**: Post + direct replies
- **Depth 6**: Default, shows deep conversations

## Use Cases

### Conversation View
- Display full conversation context
- Show reply chains
- Navigate thread hierarchy

### Content Analysis
- Analyze conversation patterns
- Track discussion topics
- Measure engagement depth

## Best Practices

- Use appropriate depth for UI
- Cache threads for performance
- Handle deleted posts gracefully
- Show thread structure clearly

## Related Tools

- **[reply_to_post](./reply-to-post.md)** - Reply to posts
- **[create_post](./create-post.md)** - Create posts

## See Also

- [Social Operations Examples](../../examples/social-operations.md)

