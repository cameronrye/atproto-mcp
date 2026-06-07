# unblock_user

Unblock a previously blocked user to restore normal interactions.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `actor` (required)

- **Type:** `string`
- **Description:** User identifier (DID or handle) to unblock. You do not need
  the block record URI — the tool looks up your block record for this actor via
  their profile (`viewer.blocking`) and deletes it.

## Response

Tool results are returned as stringified JSON text. The illustrative shape is:

```typescript
{
  success: boolean;
  message: string;
  unblockedUser: {
    actor: string;
  }
}
```

## Examples

### Unblock a User

```json
{
  "actor": "former-blocked.bsky.social"
}
```

**Response (illustrative):**

```json
{
  "success": true,
  "message": "User former-blocked.bsky.social has been unblocked. Normal interactions are now restored.",
  "unblockedUser": {
    "actor": "former-blocked.bsky.social"
  }
}
```

### User Not Currently Blocked

If you are not blocking the actor, the tool returns `success: false` instead of
throwing:

```json
{
  "success": false,
  "message": "User former-blocked.bsky.social is not currently blocked.",
  "unblockedUser": {
    "actor": "former-blocked.bsky.social"
  }
}
```

## What Unblocking Does

- You and the user can see each other's public posts again.
- The user can follow you again and normal interactions resume.
- Previous follow relationships are not restored automatically — re-follow if
  desired.

## Error Handling

An `actor` that is neither a DID nor a handle raises a `VALIDATION_ERROR` before
any network call. A "not currently blocked" condition is reported via
`success: false` (see above), not as a thrown error. Unresolvable handles and
other API failures surface as the underlying AT Protocol error.

## Related Tools

- **[block_user](./block-user.md)** - Block a user

## See Also

- [Moderation Tools](../../guide/tools-resources.md#moderation)
