# mute_user

Mute a user to hide their content from your feeds without unfollowing.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `actor` (required)
- **Type:** `string`
- **Description:** User identifier (DID or handle) to mute

## Response

```typescript
{
  success: boolean;
  message: string;
  mutedUser: {
    did: string;
    handle?: string;
  }
}
```

## Examples

### Mute a User

```json
{
  "actor": "spammer.bsky.social"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User muted successfully",
  "mutedUser": {
    "did": "did:plc:abc123xyz789",
    "handle": "spammer.bsky.social"
  }
}
```

## What Muting Does

### Hidden Content
- Posts from muted user don't appear in your timeline
- Replies from muted user are hidden
- Reposts from muted user are filtered out
- Notifications from muted user are suppressed

### What's NOT Affected
- You remain following the user (if you were)
- User can still see your content
- User can still interact with your posts
- Direct mentions may still notify you

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

#### Already Muted
```json
{
  "success": true,
  "message": "User was already muted"
}
```

## Best Practices

### When to Mute
- Temporary content overload from a user
- Want to reduce noise without unfollowing
- Testing content preferences
- Managing information diet

### Mute vs Block
- **Mute**: Soft filter, user unaware, reversible
- **Block**: Hard barrier, user may notice, more severe

### User Experience
- Provide easy mute/unmute toggle
- Show muted status in user profiles
- Allow viewing muted content optionally
- Provide mute list management

## Related Tools

- **[unmute_user](./unmute-user.md)** - Unmute a user
- **[block_user](./block-user.md)** - Block a user
- **[unfollow_user](./unfollow-user.md)** - Unfollow a user

## See Also

- [Moderation Guide](../../guide/tools-resources.md#moderation)

