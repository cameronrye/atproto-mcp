# search_actors

Search for AT Protocol accounts by handle or display name. Use this when you
know a name but not the exact handle/DID; use
[get_user_profile](./get-user-profile.md) when you already have the handle/DID.

## Authentication

**Enhanced** - This tool works without authentication but may return
viewer-specific data when authenticated.

## Parameters

### `query` (required)

- **Type:** `string`
- **Constraints:** Minimum length: 1 character
- **Description:** Search term matched against handle and display name (e.g.
  `"alice"` or `"Alice Smith"`)

### `limit` (optional)

- **Type:** `number`
- **Default:** `25`
- **Constraints:** 1-100
- **Description:** Maximum number of accounts to return

### `cursor` (optional)

- **Type:** `string`
- **Description:** Pagination cursor from a previous response; omit for the first
  page

## Response

```typescript
{
  success: boolean; // Whether the request succeeded
  actors: Array<{
    did: string; // Decentralized identifier
    handle: string; // AT Protocol handle
    displayName?: string; // Display name, if set
    description?: string; // Bio / profile description
    avatar?: string; // URL of the avatar image
  }>;
  cursor?: string; // Opaque cursor for the next page; absent when no more results
}
```

## Examples

### Search by Name

```json
{
  "query": "alice",
  "limit": 25
}
```

**Response:**

```json
{
  "success": true,
  "actors": [
    {
      "did": "did:plc:abc123",
      "handle": "alice.bsky.social",
      "displayName": "Alice Smith",
      "description": "Designer and writer"
    }
  ],
  "cursor": "next_page_cursor"
}
```

### Search with Pagination

```json
{
  "query": "alice",
  "limit": 25,
  "cursor": "cursor_from_previous_response"
}
```

## Error Handling

### Common Errors

#### Empty Query

```json
{
  "error": "Query must be at least 1 character",
  "code": "VALIDATION_ERROR"
}
```

## Pagination

Pass the `cursor` from the previous response to fetch the next page. When the
response omits `cursor`, there are no more results. `limit` accepts 1-100
(default 25).

## Related Tools

- **[get_user_profile](./get-user-profile.md)** - Retrieve a profile when you
  already know the handle/DID
- **[get_user_connections](./get-user-connections.md)** - List an account's
  followers or follows
- **[search_posts](./search-posts.md)** - Search for posts rather than accounts

## See Also

- [Basic Usage Examples](../../examples/basic-usage.md)
- [Authentication Guide](../../guide/authentication.md)
