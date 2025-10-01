# block_user

Block a user to prevent all interactions.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `actor` (required)
- **Type:** `string`
- **Description:** User identifier (DID or handle) to block

## Response

```typescript
{
  success: boolean;
  message: string;
  blockUri: string;
  blockedUser: {
    did: string;
    handle?: string;
  }
}
```

## Examples

### Block a User

```json
{
  "actor": "harasser.bsky.social"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User blocked successfully",
  "blockUri": "at://did:plc:myuser/app.bsky.graph.block/block123",
  "blockedUser": {
    "did": "did:plc:abc123xyz789",
    "handle": "harasser.bsky.social"
  }
}
```

## What Blocking Does

### Complete Separation
- Blocked user cannot see your posts
- You cannot see blocked user's posts
- Blocked user cannot reply to your posts
- Blocked user cannot follow you
- Existing follow relationships are removed
- All interactions are prevented

### Visibility
- Blocked user may notice they're blocked
- Attempts to view your profile show "blocked" message
- Attempts to interact fail with block error

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

#### Already Blocked
```json
{
  "success": true,
  "message": "User was already blocked",
  "blockUri": "at://did:plc:myuser/app.bsky.graph.block/block123"
}
```

#### Cannot Block Self
```json
{
  "error": "Cannot block yourself",
  "code": "INVALID_OPERATION"
}
```

## Best Practices

### When to Block
- Harassment or abuse
- Spam or bot accounts
- Severe policy violations
- Safety concerns

### Block vs Mute
- **Block**: Complete separation, user aware, severe
- **Mute**: Soft filter, user unaware, temporary

### User Experience
- Confirm block action with user
- Explain blocking consequences
- Provide easy unblock option
- Show blocked users list

### Safety
- Block immediately for safety concerns
- Report serious violations
- Document harassment patterns
- Consider platform-level reporting

## Related Tools

- **[unblock_user](./unblock-user.md)** - Unblock a user
- **[mute_user](./mute-user.md)** - Mute a user (softer option)
- **[report_user](./report-user.md)** - Report a user for violations

## See Also

- [Moderation Guide](../../guide/tools-resources.md#moderation)
- [Safety Best Practices](../../guide/tools-resources.md#safety)

