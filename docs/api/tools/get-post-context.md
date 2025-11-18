# get_post_context

Get post with thread, author, and engagement data. Combines post details, thread context, author profile, and engagement metrics in a single call.

## Authentication

**Enhanced** - This tool works without authentication but provides additional data when authenticated.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `uri` | `string` | Yes | - | AT-URI of the post to get context for. |
| `includeThread` | `boolean` | No | `true` | Whether to include thread context (parent and replies). |
| `includeAuthorProfile` | `boolean` | No | `true` | Whether to include detailed author profile. |
| `includeEngagement` | `boolean` | No | `true` | Whether to calculate engagement metrics. |

## Response

```typescript
{
  success: boolean;
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
    embed?: any;
    replyCount: number;
    repostCount: number;
    likeCount: number;
    indexedAt: string;
    createdAt: string;
  };
  thread?: {
    parent?: Post;
    root?: Post;
    replies: Post[];
    depth: number;
  };
  authorProfile?: {
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    followersCount: number;
    followsCount: number;
    postsCount: number;
  };
  engagement?: {
    likeCount: number;
    repostCount: number;
    replyCount: number;
    totalEngagement: number;
    engagementRate: number;
    ageHours: number;
  };
}
```

## Examples

### Get Complete Post Context

```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz1",
  "includeThread": true,
  "includeAuthorProfile": true,
  "includeEngagement": true
}
```

### Get Post with Thread Only

```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz1",
  "includeThread": true,
  "includeAuthorProfile": false,
  "includeEngagement": false
}
```

### Quick Post Overview

```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz1",
  "includeThread": false
}
```

## Error Handling

Common errors:

- **`InvalidRequest`**: Invalid URI or parameters
- **`InvalidAtUri`**: URI is not a valid AT-URI
- **`PostNotFound`**: Post does not exist or has been deleted
- **`PostBlocked`**: Post is from a blocked user or blocked by author
- **`RateLimitExceeded`**: Too many requests in a short period

## Best Practices

1. **Use for Analysis**: Get complete context before responding to posts
2. **Include Thread**: Set `includeThread: true` to understand conversation context
3. **Check Author**: Include author profile to verify credibility
4. **Monitor Engagement**: Track engagement metrics to identify viral posts
5. **Cache Results**: Store context to avoid repeated API calls
6. **Verify Timing**: Check `ageHours` to understand post recency
7. **Review Replies**: Examine thread replies for additional context

## Thread Context

The thread object provides:
- **parent**: Immediate parent post (if this is a reply)
- **root**: Root post of the thread (if part of a conversation)
- **replies**: Direct replies to this post
- **depth**: How deep in the thread this post is (0 = root post)

## Engagement Metrics

- **totalEngagement**: Sum of likes, reposts, and replies
- **engagementRate**: Engagement per hour since posting
- **ageHours**: Hours since the post was created

## Use Cases

- **Content Analysis**: Understand post performance and context
- **Conversation Tracking**: Follow discussion threads
- **Viral Detection**: Identify high-engagement posts
- **Author Research**: Learn about post authors
- **Reply Preparation**: Get full context before replying
- **Content Curation**: Evaluate posts for sharing

## AT-URI Format

AT-URIs must follow this format:
```
at://did:plc:USER_DID/app.bsky.feed.post/POST_ID
```

Example:
```
at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3k7qe4smwe22t
```

## Rate Limiting

This tool is subject to AT Protocol API rate limits:

- 3,000 requests per hour for authenticated users
- 300 requests per hour for unauthenticated users
- May require multiple API calls depending on parameters

## Related Tools

- **[get_thread](./get-thread.md)** - Get detailed thread structure
- **[get_user_profile](./get-user-profile.md)** - Get author profile
- **[reply_to_post](./reply-to-post.md)** - Reply to a post
- **[like_post](./like-post.md)** - Like a post
- **[repost](./repost.md)** - Repost a post

## See Also

- [Composite Operations Guide](../../guide/tools-resources.md#composite-operations)
- [Data Retrieval Guide](../../guide/tools-resources.md#data-retrieval)

