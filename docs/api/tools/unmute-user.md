# unmute_user

Unmute a previously muted user to restore their content in your feeds.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `actor` (required)

- **Type:** `string`
- **Description:** User identifier (DID or handle) to unmute

## Response

Tool results are returned as stringified JSON text. The illustrative shape is:

```typescript
{
  success: boolean;
  message: string;
  unmutedUser: {
    actor: string;   // echoes the actor you passed in
    did?: string;
  };
}
```

## Examples

### Unmute a User

```json
{
  "actor": "user.bsky.social"
}
```

**Response (illustrative):**

```json
{
  "success": true,
  "message": "User user.bsky.social has been unmuted. Their content will now appear in your feeds.",
  "unmutedUser": {
    "actor": "user.bsky.social"
  }
}
```

## Error Handling

An `actor` that is neither a DID nor a handle raises a `VALIDATION_ERROR` before
any network call. Unmuting is idempotent on the server, so unmuting a user who
was not muted still succeeds. Other failures surface as the underlying AT
Protocol error.

## Related Tools

- **[mute_user](./mute-user.md)** - Mute a user

## See Also

- [Moderation Tools](../../guide/tools-resources.md#moderation)
