# get_post_context

Get post with thread, author, and engagement data. Combines post details, thread
context, author profile, and engagement metrics in a single call.

## Authentication

**Enhanced** - This tool works without authentication but provides additional
data when authenticated.

## Parameters

| Parameter              | Type      | Required | Default | Description                                             |
| ---------------------- | --------- | -------- | ------- | ------------------------------------------------------- |
| `uri`                  | `string`  | Yes      | -       | AT-URI of the post to get context for.                  |
| `includeThread`        | `boolean` | No       | `true`  | Whether to include thread context (parent and replies). |
| `includeAuthorProfile` | `boolean` | No       | `true`  | Whether to include detailed author profile.             |
| `includeEngagement`    | `boolean` | No       | `true`  | Whether to calculate engagement metrics.                |

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

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
      description?: string;
      followersCount?: number;
      followsCount?: number;
      postsCount?: number;
    };
    record: {
      text: string;
      createdAt: string;
      reply?: { root: { uri: string; cid: string }; parent: { uri: string; cid: string } };
      embed?: any;
      langs?: string[];
      labels?: any;
      tags?: string[];
    };
    replyCount?: number;
    repostCount?: number;
    likeCount?: number;
    indexedAt: string;
    viewer?: { repost?: string; like?: string };
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

- **Invalid AT-URI**: The `uri` is not a valid `at://` post URI
- **Post not found or blocked**: The post does not exist, was deleted, or is
  blocked
- Errors are returned as MCP error objects; the exact wording may vary.

## Thread Context

The thread object provides:

- **parent**: Immediate parent post (if this is a reply)
- **root**: Root post of the thread (if part of a conversation)
- **replies**: Direct replies to this post
- **depth**: How deep in the thread this post is (0 = root post)

## Engagement Metrics

Computed from the post's real counts when `includeEngagement` is true:

- **totalEngagement**: Sum of `likeCount`, `repostCount`, and `replyCount`
- **engagementRate**: `totalEngagement / ageHours` — a time-velocity metric
  (engagement per hour since posting), **not** engagement relative to follower
  count. If `ageHours` is 0 or negative, it falls back to `totalEngagement`.
- **ageHours**: Hours since the post's `createdAt`

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

Subject to the server's per-tool limit of 100 requests per minute. A single call
may issue multiple AT Protocol requests (`getPostThread`, plus `getProfile` when
`includeAuthorProfile` is true).

## Related Tools

- **[get_thread](./get-thread.md)** - Get detailed thread structure
- **[get_user_profile](./get-user-profile.md)** - Get author profile
- **[reply_to_post](./reply-to-post.md)** - Reply to a post
- **[like_post](./like-post.md)** - Like a post
- **[repost](./repost.md)** - Repost a post

## See Also

- [Composite Operations Guide](../../guide/tools-resources.md#composite-operations)
- [Data Retrieval Guide](../../guide/tools-resources.md#data-retrieval)
