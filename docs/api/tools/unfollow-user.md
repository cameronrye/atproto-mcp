# unfollow_user

Unfollow a user on AT Protocol.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `followUri` (required)
- **Type:** `string`
- **Description:** AT Protocol URI of the follow record to delete (returned from `follow_user`)

## Response

```typescript
{
  success: boolean;   // Operation success status
  message: string;    // Success message
  deletedFollow: {
    uri: string;      // URI of the deleted follow record
  }
}
```

## Examples

### Unfollow a User

```json
{
  "followUri": "at://did:plc:myuser/app.bsky.graph.follow/follow123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User unfollowed successfully",
  "deletedFollow": {
    "uri": "at://did:plc:myuser/app.bsky.graph.follow/follow123"
  }
}
```

## Error Handling

### Common Errors

#### Invalid Follow URI
```json
{
  "error": "Invalid AT Protocol URI format",
  "code": "VALIDATION_ERROR"
}
```

#### Follow Not Found
```json
{
  "error": "Follow record not found",
  "code": "NOT_FOUND"
}
```

#### Not Authorized
```json
{
  "error": "Not authorized to delete this follow record",
  "code": "UNAUTHORIZED"
}
```

## Best Practices

### Tracking Follows
- Store the follow URI when you follow a user
- The follow URI is different from the user's DID or handle
- The follow URI is returned by the `follow_user` tool

### Finding Follow URIs
If you don't have the follow URI stored:
1. Use `get_follows` to list users you follow
2. Find the target user in the list
3. Extract the follow URI from the response

## Related Tools

- **[follow_user](./follow-user.md)** - Follow a user
- **[get_follows](./get-follows.md)** - Get users you follow (includes follow URIs)

## See Also

- [Social Operations Examples](../../examples/social-operations.md)

