# mute_user

Mute a user to hide their content from your feeds and notifications without them
knowing.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `actor` (required)

- **Type:** `string`
- **Description:** User identifier (DID or handle) to mute

## Response

Tool results are returned as stringified JSON text. The illustrative shape is:

```typescript
{
  success: boolean;
  message: string;
  mutedUser: {
    actor: string;   // echoes the actor you passed in
    did?: string;
  };
}
```

## Examples

### Mute a User

```json
{
  "actor": "spammer.bsky.social"
}
```

**Response (illustrative):**

```json
{
  "success": true,
  "message": "User spammer.bsky.social has been muted. Their content will no longer appear in your feeds.",
  "mutedUser": {
    "actor": "spammer.bsky.social"
  }
}
```

## What Muting Does

- Posts, replies, and reposts from the muted user are hidden from your feeds.
- Notifications from the muted user are suppressed.
- You remain following the user (if you were), and the user can still see and
  interact with your content. Muting is invisible to them.

## Error Handling

An `actor` that is neither a DID nor a handle raises a `VALIDATION_ERROR` before
any network call. Muting is idempotent on the server, so re-muting an
already-muted user succeeds. Other failures surface as the underlying AT
Protocol error.

## Mute vs Block

- **Mute:** soft filter, user unaware, reversible.
- **Block:** hard barrier, user may notice, more severe.

## Related Tools

- **[unmute_user](./unmute-user.md)** - Unmute a user
- **[block_user](./block-user.md)** - Block a user
- **[unfollow_user](./unfollow-user.md)** - Unfollow a user

## See Also

- [Moderation Tools](../../guide/tools-resources.md#moderation)
