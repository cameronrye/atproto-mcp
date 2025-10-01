# get_custom_feed

Access custom algorithm feeds on AT Protocol.

## Authentication

**Optional:** Public tool (works without authentication)

## Parameters

### `feed` (required)
- **Type:** `string`
- **Description:** AT Protocol URI of the custom feed

### `limit` (optional)
- **Type:** `number`
- **Default:** `50`
- **Constraints:** 1-100
- **Description:** Maximum number of posts to return

### `cursor` (optional)
- **Type:** `string`
- **Description:** Pagination cursor

## Response

```typescript
{
  success: boolean;
  feed: Array<{
    post: Post;
    reason?: any;
  }>;
  cursor?: string;
  hasMore: boolean;
}
```

## Examples

### Get Custom Feed

```json
{
  "feed": "at://did:plc:abc123/app.bsky.feed.generator/my-feed"
}
```

### Get Feed with Pagination

```json
{
  "feed": "at://did:plc:abc123/app.bsky.feed.generator/my-feed",
  "limit": 30,
  "cursor": "cursor_from_previous_response"
}
```

## Custom Feeds

### What are Custom Feeds?
- Algorithm-driven content feeds
- Created by community members
- Curated content collections
- Topic-specific feeds

### Popular Feed Types
- Topic feeds (tech, art, science)
- Language-specific feeds
- Community feeds
- Trending content feeds

## Use Cases

### Content Discovery
- Find niche content
- Follow specific topics
- Discover new creators

### Community Building
- Create topic communities
- Curate quality content
- Build engaged audiences

## Best Practices

- Explore different feeds
- Cache feed content
- Respect feed creator's intent
- Provide feed attribution

## Related Tools

- **[get_timeline](./get-timeline.md)** - Get personal timeline
- **[search_posts](./search-posts.md)** - Search posts

## See Also

- [Social Operations Examples](../../examples/social-operations.md)

