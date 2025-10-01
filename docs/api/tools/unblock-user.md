# unblock_user

Unblock a previously blocked user.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `blockUri` (required)
- **Type:** `string`
- **Description:** AT Protocol URI of the block record (returned from `block_user`)

## Response

```typescript
{
  success: boolean;
  message: string;
  deletedBlock: {
    uri: string;
  }
}
```

## Examples

### Unblock a User

```json
{
  "blockUri": "at://did:plc:myuser/app.bsky.graph.block/block123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User unblocked successfully",
  "deletedBlock": {
    "uri": "at://did:plc:myuser/app.bsky.graph.block/block123"
  }
}
```

## What Unblocking Does

### Restored Access
- User can see your public posts again
- You can see user's posts again
- User can follow you again
- Normal interactions are possible

### What's NOT Restored
- Previous follow relationships (must re-follow)
- Previous interactions remain deleted
- Block history may be retained for safety

## Error Handling

### Common Errors

#### Invalid Block URI
```json
{
  "error": "Invalid AT Protocol URI format",
  "code": "VALIDATION_ERROR"
}
```

#### Block Not Found
```json
{
  "error": "Block record not found",
  "code": "NOT_FOUND"
}
```

## Best Practices

### Tracking Blocks
- Store block URI when blocking
- Maintain list of blocked users
- Provide UI to manage blocks

### User Experience
- Confirm unblock action
- Explain unblock consequences
- Allow re-blocking easily
- Show unblock confirmation

## Related Tools

- **[block_user](./block-user.md)** - Block a user

## See Also

- [Moderation Guide](../../guide/tools-resources.md#moderation)

