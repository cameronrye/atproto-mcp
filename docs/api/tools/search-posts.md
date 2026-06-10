# search_posts

Search for posts on AT Protocol with advanced filtering options.

## Authentication

**Required:** Yes (Private tool)

The AT Protocol search endpoint changed in 2025 to require authentication;
unauthenticated calls return `403 Forbidden`. Provide credentials (e.g.
`ATPROTO_IDENTIFIER` + `ATPROTO_PASSWORD`) for this tool to work.

## Parameters

### `q` (required)

- **Type:** `string`
- **Constraints:**
  - Minimum length: 1 character
  - Maximum length: 300 characters
- **Description:** Search query text. A non-empty query is required: there is no
  match-all wildcard (a literal `*` is searched as text and matches nothing),
  and an empty query does **not** return all of an author's posts. To list a
  user's posts without a search term, use a timeline/author-feed tool instead.

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
- **Constraints:** A valid BCP-47 language tag (e.g. `en`, `en-US`, `pt-BR`)
- **Description:** Filter posts by language

### `domain` (optional)

- **Type:** `string`
- **Description:** Filter posts containing links from this domain

### `url` (optional)

- **Type:** `string`
- **Description:** Filter posts containing this specific URL

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

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
  "since": "2026-01-01T00:00:00Z",
  "until": "2026-01-31T23:59:59Z"
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
  "error": "Language code must be a valid BCP-47 tag (e.g. en, en-US, pt-BR)",
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

## Notes

### Query and Filters

- A non-empty `q` is required; there is no match-all wildcard.
- Combine filters (`author`, `mentions`, `lang`, `domain`, `url`, date range) to
  narrow results.
- `sort: "latest"` favors recent content; `sort: "top"` favors popular content.

### Language Filtering

- `lang` accepts a BCP-47 tag (e.g. `en`, `en-US`, `pt-BR`), not a
  two-letter-only code.

### Date Ranges

- `since` / `until` use ISO 8601 timestamps (`YYYY-MM-DDTHH:mm:ssZ`).

### Pagination

- Pass the `cursor` from the previous response, and check `hasMore` before
  requesting another page. `limit` accepts 1-100 (default 25).

## Rate Limiting

This server applies a per-tool limit of 100 requests per minute. Calls are also
subject to Bluesky's platform-level rate limits.

## Related Tools

- **[get_timeline](./get-timeline.md)** - Get personalized timeline
- **[get_post_context](./get-post-context.md)** - View post threads
- **[get_custom_feed](./get-custom-feed.md)** - Access custom feeds

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
- [Tools & Resources Guide](../../guide/tools-resources.md)
