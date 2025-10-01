# get_follows

Get the list of users that a specific user follows.

## Authentication

**Optional:** Public tool (works without authentication)

## Parameters

### `actor` (required)
- **Type:** `string`
- **Description:** User identifier (DID or handle)

### `limit` (optional)
- **Type:** `number`
- **Default:** `50`
- **Constraints:** 1-100
- **Description:** Maximum number of follows to return

### `cursor` (optional)
- **Type:** `string`
- **Description:** Pagination cursor from previous response

## Response

```typescript
{
  success: boolean;
  follows: Array<{
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    avatar?: string;
    indexedAt?: string;
    viewer?: {
      muted?: boolean;
      blockedBy?: boolean;
      following?: string;
      followedBy?: string;
    };
  }>;
  subject: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  cursor?: string;
  hasMore: boolean;
}
```

## Examples

### Get Follows by Handle

```json
{
  "actor": "alice.bsky.social",
  "limit": 50
}
```

### Get Follows with Pagination

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

## Best Practices

- Use pagination for users following many accounts
- Cache follow lists for short periods
- Check viewer data to see mutual follows

## Related Tools

- **[get_followers](./get-followers.md)** - Get a user's followers
- **[get_user_profile](./get-user-profile.md)** - Get user profile
- **[follow_user](./follow-user.md)** - Follow a user
- **[unfollow_user](./unfollow-user.md)** - Unfollow a user

## See Also

- [Social Operations Examples](../../examples/social-operations.md)

