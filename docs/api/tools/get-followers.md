# get_followers

Get the list of users following a specific user.

## Authentication

**Optional:** Enhanced tool. Works without authentication. Authentication
enriches the underlying AT Protocol API call, but this tool only returns the
profile fields listed in the Response section (did, handle, displayName,
description, avatar, banner, followersCount, followsCount, postsCount,
indexedAt) and does not surface viewer-specific relationship state.

## Parameters

### `actor` (required)

- **Type:** `string`
- **Description:** User identifier (DID or handle)

### `limit` (optional)

- **Type:** `number`
- **Default:** `50`
- **Constraints:** 1-100
- **Description:** Maximum number of followers to return

### `cursor` (optional)

- **Type:** `string`
- **Description:** Pagination cursor from previous response

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

```typescript
{
  success: boolean;
  followers: Array<{
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    avatar?: string;
    banner?: string;
    followersCount?: number;
    followsCount?: number;
    postsCount?: number;
    indexedAt?: string;
  }>;
  cursor?: string;
  hasMore: boolean;
  actor: string;            // the requested actor (DID or handle)
}
```

## Examples

### Get Followers by Handle

```json
{
  "actor": "alice.bsky.social",
  "limit": 50
}
```

### Get Followers with Pagination

```json
{
  "actor": "alice.bsky.social",
  "limit": 50,
  "cursor": "cursor_from_previous_response"
}
```

## Error Handling

### Common Errors

#### Invalid Actor

```json
{
  "error": "Actor (DID or handle) is required",
  "code": "VALIDATION_ERROR"
}
```

#### User Not Found

```json
{
  "error": "User not found",
  "code": "NOT_FOUND"
}
```

## Pagination

Pass the `cursor` from the previous response to page through users with many
followers, and check `hasMore` before requesting another page.

## Related Tools

- **[get_follows](./get-follows.md)** - Get users a user follows
- **[get_user_profile](./get-user-profile.md)** - Get user profile
- **[follow_user](./follow-user.md)** - Follow a user

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
