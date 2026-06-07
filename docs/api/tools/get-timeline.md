# get_timeline

Retrieve the authenticated user's personalized timeline feed.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `algorithm` (optional)

- **Type:** `string`
- **Description:** Feed algorithm to use (e.g., "reverse-chronological")

### `limit` (optional)

- **Type:** `number`
- **Default:** `50`
- **Constraints:** 1-100
- **Description:** Maximum number of posts to return

### `cursor` (optional)

- **Type:** `string`
- **Description:** Pagination cursor from previous response

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
      reply?: any;
      embed?: any;
      langs?: string[];      // BCP-47 language tags
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
  algorithm?: string;        // echoes the requested algorithm, if any
}
```

## Examples

### Get Timeline

```json
{
  "limit": 50
}
```

### Get Timeline with Pagination

```json
{
  "limit": 50,
  "cursor": "cursor_from_previous_response"
}
```

### Get Timeline with Algorithm

```json
{
  "algorithm": "reverse-chronological",
  "limit": 30
}
```

## Error Handling

### Common Errors

#### Authentication Required

```json
{
  "error": "Authentication required",
  "code": "AUTHENTICATION_FAILED"
}
```

#### Invalid Limit

```json
{
  "error": "Limit must be between 1 and 100",
  "code": "VALIDATION_ERROR"
}
```

## Pagination

- Pass the `cursor` from the previous response to fetch the next page.
- Check `hasMore` before requesting another page.
- `limit` accepts 1-100 (default 50).

## Related Tools

- **[get_notifications](./get-notifications.md)** - Get notifications
- **[get_custom_feed](./get-custom-feed.md)** - Access custom feeds
- **[search_posts](./search-posts.md)** - Search for posts

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
