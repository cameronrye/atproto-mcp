# get_post_context

Get post with thread, author, engagement, and media data. Combines post details,
thread context, author profile, engagement metrics, and extracted media in a
single call. This is the single post reader — it replaces the former `get_thread`
and `extract_media_from_post` tools (use the `include*` flags below to control
what is returned).

## Authentication

**Enhanced** - This tool works without authentication but provides additional
data when authenticated.

## Parameters

| Parameter              | Type      | Required | Default | Description                                                                                      |
| ---------------------- | --------- | -------- | ------- | ------------------------------------------------------------------------------------------------ |
| `uri`                  | `string`  | Yes      | -       | AT-URI of the post to get context for.                                                           |
| `includeThread`        | `boolean` | No       | `true`  | Whether to include thread context (parent chain, root, and replies).                             |
| `includeAuthorProfile` | `boolean` | No       | `true`  | Whether to include detailed author profile.                                                      |
| `includeEngagement`    | `boolean` | No       | `true`  | Whether to calculate engagement metrics.                                                         |
| `depth`                | `number`  | No       | `6`     | How many levels of replies to fetch (0-10).                                                       |
| `parentHeight`         | `number`  | No       | `80`    | How many parent posts up the chain to fetch (0-80).                                               |
| `includeMedia`         | `boolean` | No       | `false` | Extract media embeds (images, videos, external links, quote posts) from the post.                |

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
  media?: {
    images: Array<{ uri: string; alt?: string; aspectRatio?: any; thumb?: string }>;
    videos: Array<{ uri: string; alt?: string; aspectRatio?: any; thumbnail?: string }>;
    externalLinks: Array<{ uri: string; title?: string; description?: string; thumb?: string }>;
    quotePosts: Array<{ uri: string; cid: string }>;
  };
}
```

The `media` object is present only when `includeMedia` is `true`. It handles the
AppView `#view` embed shapes — images, video, external link cards, record (quote
post), and `recordWithMedia` (quote post plus attached media).

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

### Extract Media from a Post

Replaces the former `extract_media_from_post` tool — set `includeMedia: true`
(and disable the other sections if you only want media):

```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz1",
  "includeThread": false,
  "includeAuthorProfile": false,
  "includeEngagement": false,
  "includeMedia": true
}
```

### Deeper Thread

Pull more of the reply tree and parent chain:

```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz1",
  "depth": 10,
  "parentHeight": 80
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

- **[get_user_profile](./get-user-profile.md)** - Get author profile
- **[reply_to_post](./reply-to-post.md)** - Reply to a post
- **[like_post](./like-post.md)** - Like a post
- **[repost](./repost.md)** - Repost a post

## See Also

- [Composite Operations Guide](../../guide/tools-resources.md#composite-operations)
- [Data Retrieval Guide](../../guide/tools-resources.md#data-retrieval)
