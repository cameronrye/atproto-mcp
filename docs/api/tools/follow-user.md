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

If you're already following the user, the tool returns the existing follow record:

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

#### Cannot Follow Self
```json
{
  "error": "Cannot follow yourself",
  "code": "INVALID_OPERATION"
}
```

#### Rate Limit Exceeded
```json
{
  "error": "Rate limit exceeded. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
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
- Respect rate limits when following multiple users
- Consider implementing follow limits to prevent spam

### Bulk Operations
When following multiple users:
- Add delays between follow operations
- Implement exponential backoff for rate limits
- Track failed follows for retry logic
- Monitor for rate limit responses

## Rate Limiting

This tool is subject to AT Protocol rate limits:
- **Default limit:** 100 follows per hour
- **Burst limit:** 5 follows per minute

## Related Tools

- **[unfollow_user](./unfollow-user.md)** - Unfollow a user
- **[get_user_profile](./get-user-profile.md)** - Get user profile information
- **[get_followers](./get-followers.md)** - Get a user's followers
- **[get_follows](./get-follows.md)** - Get users a user follows

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
- [Social Graph Guide](../../guide/tools-resources.md#social-graph)

