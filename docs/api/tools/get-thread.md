# get_thread

View a complete post thread with all replies and context.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `uri` (required)

- **Type:** `string`
- **Description:** AT Protocol URI of any post in the thread

### `depth` (optional)

- **Type:** `number`
- **Default:** `6`
- **Constraints:** 1-10
- **Description:** Maximum depth of reply levels to fetch below the requested
  post

### `parentHeight` (optional)

- **Type:** `number`
- **Default:** `80`
- **Constraints:** 0-10
- **Description:** Maximum number of parent posts to walk up from the requested
  post

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

```typescript
{
  success: boolean;
  thread: {
    post: {
      uri: string;
      cid: string;
      author: {
        did: string;
        handle: string;
        displayName?: string;
        avatar?: string;
      };
      text: string;
      createdAt: string;
      replyCount: number;
      repostCount: number;
      likeCount: number;
    };
    parent?: any;          // raw parent thread node (if the post is a reply)
    replies?: any[];       // raw reply thread nodes
  };
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

## Thread Depth

The `uri` may point to any post in a thread; the response is anchored on that
post. `depth` controls how many reply levels are returned below it, and
`parentHeight` controls how many ancestor posts are walked up toward the root.

- **Depth 1**: The requested post plus its direct replies
- **Depth 6**: Default; surfaces several levels of nested conversation
- **Depth 10**: Maximum

Deleted or blocked posts may appear as placeholder nodes in `parent`/`replies`
rather than full post objects.

## Related Tools

- **[reply_to_post](./reply-to-post.md)** - Reply to posts
- **[create_post](./create-post.md)** - Create posts

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
