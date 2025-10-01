# unmute_user

Unmute a previously muted user to see their content again.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `actor` (required)
- **Type:** `string`
- **Description:** User identifier (DID or handle) to unmute

## Response

```typescript
{
  success: boolean;
  message: string;
  unmutedUser: {
    did: string;
    handle?: string;
  }
}
```

## Examples

### Unmute a User

```json
{
  "actor": "user.bsky.social"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User unmuted successfully",
  "unmutedUser": {
    "did": "did:plc:abc123xyz789",
    "handle": "user.bsky.social"
  }
}
```

## Error Handling

### Common Errors

#### User Not Muted
```json
{
  "success": true,
  "message": "User was not muted"
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

- Provide easy access to muted users list
- Allow bulk unmute operations
- Show unmute confirmation

## Related Tools

- **[mute_user](./mute-user.md)** - Mute a user

## See Also

- [Moderation Guide](../../guide/tools-resources.md#moderation)

