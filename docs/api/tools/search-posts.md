# search_posts

Search for posts on AT Protocol with advanced filtering options.

## Authentication

**Optional:** Public tool (works without authentication)

## Parameters

### `q` (required)
- **Type:** `string`
- **Constraints:** 
  - Minimum length: 1 character
  - Maximum length: 300 characters
- **Description:** Search query text

### `limit` (optional)
- **Type:** `number`
- **Default:** `25`
- **Constraints:** 1-100
- **Description:** Maximum number of results to return

### `cursor` (optional)
- **Type:** `string`
- **Description:** Pagination cursor from previous response

### `sort` (optional)
- **Type:** `"top" | "latest"`
- **Default:** `"latest"`
- **Description:** Sort order for results

### `since` (optional)
- **Type:** `string`
- **Description:** ISO 8601 timestamp - only return posts after this time

### `until` (optional)
- **Type:** `string`
- **Description:** ISO 8601 timestamp - only return posts before this time

### `mentions` (optional)
- **Type:** `string`
- **Description:** Filter posts that mention this user (handle or DID)

### `author` (optional)
- **Type:** `string`
- **Description:** Filter posts by author (handle or DID)

### `lang` (optional)
- **Type:** `string`
- **Constraints:** 2-character ISO 639-1 code
- **Description:** Filter posts by language

### `domain` (optional)
- **Type:** `string`
- **Description:** Filter posts containing links from this domain

### `url` (optional)
- **Type:** `string`
- **Description:** Filter posts containing this specific URL

## Response

```typescript
{
  success: boolean;
  posts: Array<{
    uri: string;
    cid: string;
    author: {
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
    };
    record: {
      text: string;
      createdAt: string;
      reply?: {
        root: { uri: string; cid: string };
        parent: { uri: string; cid: string };
      };
      embed?: any;
      langs?: string[];
      tags?: string[];
    };
    replyCount?: number;
    repostCount?: number;
    likeCount?: number;
    indexedAt: string;
    viewer?: {
      repost?: string;
      like?: string;
    };
  }>;
  cursor?: string;
  hasMore: boolean;
  searchQuery: string;
  totalResults?: number;
}
```

## Examples

### Basic Text Search

```json
{
  "q": "artificial intelligence"
}
```

### Search with Filters

```json
{
  "q": "machine learning",
  "sort": "top",
  "lang": "en",
  "limit": 50
}
```

### Search by Author

```json
{
  "q": "typescript",
  "author": "alice.bsky.social"
}
```

### Search with Date Range

```json
{
  "q": "bluesky",
  "since": "2024-01-01T00:00:00Z",
  "until": "2024-01-31T23:59:59Z"
}
```

### Search for Mentions

```json
{
  "q": "great post",
  "mentions": "bob.bsky.social"
}
```

### Search by Domain

```json
{
  "q": "article",
  "domain": "example.com"
}
```

### Paginated Search

```json
{
  "q": "atproto",
  "limit": 25,
  "cursor": "cursor_from_previous_response"
}
```

## Error Handling

### Common Errors

#### Empty Query
```json
{
  "error": "Search query is required",
  "code": "VALIDATION_ERROR"
}
```

#### Invalid Language Code
```json
{
  "error": "Language code must be 2 characters",
  "code": "VALIDATION_ERROR"
}
```

#### Invalid Date Format
```json
{
  "error": "Invalid ISO 8601 timestamp",
  "code": "VALIDATION_ERROR"
}
```

## Best Practices

### Query Construction
- Use specific keywords for better results
- Combine multiple filters for precise searches
- Use quotes for exact phrase matching
- Include hashtags in queries when relevant

### Sorting
- **`latest`**: Best for real-time monitoring and recent content
- **`top`**: Best for finding popular or high-quality content

### Pagination
- Always check `hasMore` before requesting next page
- Store and use the `cursor` from previous response
- Implement reasonable page sizes (25-50 results)

### Performance
- Use specific filters to reduce result set
- Cache search results when appropriate
- Implement debouncing for user-initiated searches
- Monitor rate limits for frequent searches

### Language Filtering
- Use ISO 639-1 two-letter codes
- Combine with text search for multilingual content
- Consider user's language preferences

### Date Ranges
- Use ISO 8601 format: `YYYY-MM-DDTHH:mm:ssZ`
- Narrow date ranges for better performance
- Consider timezone implications

## Use Cases

### Content Discovery
- Find posts about specific topics
- Discover trending discussions
- Monitor hashtags and keywords

### User Research
- Analyze user sentiment
- Track brand mentions
- Study conversation patterns

### Content Moderation
- Monitor for specific terms
- Track reported content
- Identify spam patterns

### Analytics
- Track topic popularity over time
- Measure engagement metrics
- Analyze content trends

## Rate Limiting

This tool is subject to AT Protocol rate limits:
- **Default limit:** 300 searches per hour
- **Burst limit:** 10 searches per minute

## Related Tools

- **[get_timeline](./get-timeline.md)** - Get personalized timeline
- **[get_thread](./get-thread.md)** - View post threads
- **[get_custom_feed](./get-custom-feed.md)** - Access custom feeds

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
- [Search Best Practices](../../guide/tools-resources.md#search)

