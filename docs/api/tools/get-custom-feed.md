# get_custom_feed

Access custom algorithm feeds on AT Protocol.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `feedUri` (required)

- **Type:** `string`
- **Description:** AT Protocol URI of the custom feed generator
  (`at://.../app.bsky.feed.generator/...`)

### `limit` (optional)

- **Type:** `number`
- **Default:** `50`
- **Constraints:** 1-100
- **Description:** Maximum number of posts to return

### `cursor` (optional)

- **Type:** `string`
- **Description:** Pagination cursor

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

```typescript
{
  success: boolean;
  feed: {
    uri: string;
    displayName?: string;
    description?: string;
    creator: {
      did: string;
      handle: string;
      displayName?: string;
    };
  };
  posts: Array<{
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
    isLiked: boolean;       // requires authentication to be meaningful
    isReposted: boolean;    // requires authentication to be meaningful
  }>;
  cursor?: string;
}
```

## Examples

### Get Custom Feed

```json
{
  "feedUri": "at://did:plc:abc123/app.bsky.feed.generator/my-feed"
}
```

### Get Feed with Pagination

```json
{
  "feedUri": "at://did:plc:abc123/app.bsky.feed.generator/my-feed",
  "limit": 30,
  "cursor": "cursor_from_previous_response"
}
```

## Custom Feeds

Custom feeds are algorithm-driven content collections published by community
members as feed generators (records of type `app.bsky.feed.generator`). Common
examples include topic feeds (tech, art, science), language-specific feeds, and
community feeds. The `feedUri` identifies the generator to query.

## Pagination

Pass the `cursor` from the previous response to fetch the next page. `limit`
accepts 1-100 (default 50).

## Related Tools

- **[get_timeline](./get-timeline.md)** - Get personal timeline
- **[search_posts](./search-posts.md)** - Search posts

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
