# get_user_connections

Retrieve an account's followers or follows from AT Protocol. Replaces the former
`get_followers` and `get_follows` tools — choose which side of the follow graph
to query with the `direction` parameter.

## Authentication

**Enhanced** - This tool works without authentication but returns richer
viewer-specific data when authenticated.

## Parameters

### `actor` (required)

- **Type:** `string`
- **Description:** Handle (e.g. `alice.bsky.social`) or DID of the account whose
  connections to list

### `direction` (required)

- **Type:** `string`
- **Values:** `"followers"` | `"follows"`
- **Description:** Which side of the follow graph to return. Use `"followers"`
  for accounts that follow the actor, or `"follows"` for accounts the actor
  follows.

### `limit` (optional)

- **Type:** `number`
- **Default:** `50`
- **Constraints:** 1-100
- **Description:** Maximum number of accounts to return per page

### `cursor` (optional)

- **Type:** `string`
- **Description:** Opaque pagination cursor from the previous response's `cursor`
  field; omit for the first page

## Response

```typescript
{
  success: boolean; // Whether the request succeeded
  actor: string; // The actor whose connections were fetched
  direction: 'followers' | 'follows'; // The direction queried
  connections: Array<{
    did: string; // Decentralized identifier
    handle: string; // AT Protocol handle
    displayName?: string; // Display name, if set
    description?: string; // Bio / profile description
    avatar?: string; // URL of the avatar image
    banner?: string; // URL of the banner image
    indexedAt?: string; // ISO 8601 timestamp when the record was indexed
  }>;
  cursor?: string; // Opaque cursor for the next page; absent when no more results
}
```

> **Note:** The `ProfileView` entries returned for connections do not carry
> follower / follow / post counts (only `ProfileViewDetailed` does), so those
> fields are omitted. Use `get_user_profile` or `get_user_summary` for aggregate
> counts.

## Examples

### Get Followers

```json
{
  "actor": "alice.bsky.social",
  "direction": "followers",
  "limit": 50
}
```

**Response:**

```json
{
  "success": true,
  "actor": "alice.bsky.social",
  "direction": "followers",
  "connections": [
    {
      "did": "did:plc:abc123",
      "handle": "bob.bsky.social",
      "displayName": "Bob"
    }
  ],
  "cursor": "next_page_cursor"
}
```

### Get Follows with Pagination

```json
{
  "actor": "alice.bsky.social",
  "direction": "follows",
  "limit": 50,
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

- **[get_user_profile](./get-user-profile.md)** - Retrieve a single profile and
  its aggregate counts
- **[get_user_summary](./get-user-summary.md)** - Profile plus recent posts and
  engagement stats in one call
- **[search_actors](./search-actors.md)** - Find accounts by handle or display
  name

## See Also

- [Basic Usage Examples](../../examples/basic-usage.md)
- [Authentication Guide](../../guide/authentication.md)
