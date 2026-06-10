# get_author_feed

Retrieve posts by a specific AT Protocol user. Lists a specific user's posts —
this differs from [get_timeline](./get-timeline.md) (your home feed) and
[search_posts](./search-posts.md) (query-based search).

## Authentication

**Enhanced** - This tool works without authentication but includes viewer state
(liked/reposted by the caller) when authenticated.

## Parameters

### `actor` (required)

- **Type:** `string`
- **Constraints:** Minimum length: 1 character
- **Description:** Handle or DID of the account whose posts to list

### `limit` (optional)

- **Type:** `number`
- **Default:** `50`
- **Constraints:** 1-100
- **Description:** Maximum number of posts to return per page

### `cursor` (optional)

- **Type:** `string`
- **Description:** Pagination cursor from a previous response; omit for the first
  page

### `filter` (optional)

- **Type:** `string`
- **Values:** `"posts_with_replies"` | `"posts_no_replies"` |
  `"posts_with_media"` | `"posts_and_author_threads"`
- **Default:** `"posts_with_replies"`
- **Description:** Which of the author's posts to include

## Response

```typescript
{
  success: boolean; // Whether the request succeeded
  posts: Array<{
    uri: string; // AT Protocol URI of the post
    cid: string; // Content identifier (CID) of the post
    author: {
      did: string; // Decentralized identifier of the author
      handle: string; // AT Protocol handle of the author
      displayName?: string; // Author's display name, if set
      avatar?: string; // URL of the author's avatar image
    };
    text: string; // Text content of the post
    createdAt: string; // ISO 8601 timestamp when the post was created
    replyCount?: number; // Number of replies
    repostCount?: number; // Number of reposts
    likeCount?: number; // Number of likes
  }>;
  cursor?: string; // Opaque cursor for the next page; absent when no more results
}
```

## Examples

### List a User's Posts

```json
{
  "actor": "alice.bsky.social",
  "limit": 50
}
```

**Response:**

```json
{
  "success": true,
  "posts": [
    {
      "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz789",
      "cid": "bafyreiabc123...",
      "author": {
        "did": "did:plc:abc123",
        "handle": "alice.bsky.social",
        "displayName": "Alice"
      },
      "text": "Hello from AT Protocol!",
      "createdAt": "2026-01-15T10:30:00.000Z",
      "likeCount": 12,
      "repostCount": 3,
      "replyCount": 1
    }
  ],
  "cursor": "next_page_cursor"
}
```

### Posts Without Replies

```json
{
  "actor": "alice.bsky.social",
  "filter": "posts_no_replies",
  "limit": 50
}
```

### Media Posts with Pagination

```json
{
  "actor": "alice.bsky.social",
  "filter": "posts_with_media",
  "cursor": "cursor_from_previous_response"
}
```

## Error Handling

### Common Errors

#### Invalid Actor

```json
{
  "error": "Invalid actor identifier",
  "code": "VALIDATION_ERROR"
}
```

#### Actor Not Found

```json
{
  "error": "Profile not found",
  "code": "NOT_FOUND"
}
```

## Pagination

Pass the `cursor` from the previous response to fetch the next page. When the
response omits `cursor`, there are no more results. `limit` accepts 1-100
(default 50).

## Related Tools

- **[get_timeline](./get-timeline.md)** - Retrieve your personalized home feed
- **[search_posts](./search-posts.md)** - Search for posts by query
- **[get_user_summary](./get-user-summary.md)** - Profile plus recent posts in
  one call

## See Also

- [Basic Usage Examples](../../examples/basic-usage.md)
- [Authentication Guide](../../guide/authentication.md)
