# follow_user

Follow a user on AT Protocol.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `actor` (required)

- **Type:** `string`
- **Description:** User identifier - can be either a DID or handle
- **Examples:**
  - DID: `did:plc:abc123xyz789`
  - Handle: `user.bsky.social`

## Response

```typescript
{
  uri: string;        // URI of the follow record
  cid: string;        // CID of the follow record
  success: boolean;   // Operation success status
  message: string;    // Success message
  followedUser: {
    did: string;      // DID of the followed user
    handle?: string;  // Handle of the followed user
  }
}
```

## Examples

### Follow by Handle

```json
{
  "actor": "alice.bsky.social"
}
```

**Response:**

```json
{
  "uri": "at://did:plc:myuser/app.bsky.graph.follow/follow123",
  "cid": "bafyreiabc123...",
  "success": true,
  "message": "User followed successfully",
  "followedUser": {
    "did": "did:plc:abc123xyz789",
    "handle": "alice.bsky.social"
  }
}
```

### Follow by DID

```json
{
  "actor": "did:plc:abc123xyz789"
}
```

### Already Following

If you're already following the user, the tool returns the existing follow
record:

```json
{
  "uri": "at://did:plc:myuser/app.bsky.graph.follow/follow123",
  "cid": "bafyreiabc123...",
  "success": true,
  "message": "User was already being followed",
  "followedUser": {
    "did": "did:plc:abc123xyz789",
    "handle": "alice.bsky.social"
  }
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

#### Rate Limit Exceeded

When this server's per-tool limit is exceeded, the tool returns a generic
internal error (there is no `RATE_LIMIT_EXCEEDED` code or `retryAfter` from the
per-tool limiter):

```json
{
  "error": "Rate limit exceeded for tool \"follow_user\". Please slow down and retry shortly.",
  "code": "InternalError"
}
```

## Best Practices

### Actor Identifiers

- **Handles** are more user-friendly but can change
- **DIDs** are permanent and never change
- Use DIDs for programmatic operations
- Use handles for user-facing features

### Following Strategy

- Check if already following before calling to avoid unnecessary operations
- Store the follow URI if you need to unfollow later

### Bulk Operations

To follow many users in one call, use
**[batch_action](./batch-action.md)** with `action: "follow"` instead of looping
over this tool.

## Rate Limiting

This server applies a per-tool rate limit of **100 requests per minute**. When
the limit is exceeded, the tool returns a generic internal error with the
message
`Rate limit exceeded for tool "follow_user". Please slow down and retry shortly.`
(no `retryAfter` value). Note: a separate `RATE_LIMIT_EXCEEDED` code with a
`retryAfter` value is only surfaced when the upstream AT Protocol API itself
returns HTTP 429 — that is a different mechanism from this server's per-tool
limiter.

## Related Tools

- **[unfollow_user](./unfollow-user.md)** - Unfollow a user
- **[get_user_profile](./get-user-profile.md)** - Get user profile information
- **[get_user_connections](./get-user-connections.md)** - Get a user's followers
  or follows (`direction: 'followers' | 'follows'`)

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
- [Tools & Resources Guide](../../guide/tools-resources.md#social-operations)
