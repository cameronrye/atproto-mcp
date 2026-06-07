# block_user

Block a user to prevent them from seeing your content and interacting with you.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `actor` (required)

- **Type:** `string`
- **Description:** User identifier (DID or handle) to block. Handles are
  resolved to a DID before the block record is created, because a block record's
  subject must be a DID.

## Response

Tool results are returned as stringified JSON text. The illustrative shape is:

```typescript
{
  success: boolean;
  message: string;
  blockedUser: {
    actor: string;   // echoes the actor you passed in
    did?: string;
    uri?: string;    // AT-URI of the created block record
  };
}
```

## Examples

### Block a User

```json
{
  "actor": "harasser.bsky.social"
}
```

**Response (illustrative):**

```json
{
  "success": true,
  "message": "User harasser.bsky.social has been blocked. They cannot see your content or interact with you.",
  "blockedUser": {
    "actor": "harasser.bsky.social",
    "uri": "at://did:plc:myuser/app.bsky.graph.block/block123"
  }
}
```

## What Blocking Does

- The blocked user cannot see your posts, and you cannot see theirs.
- The blocked user cannot reply to your posts or follow you.
- Existing follow relationships between you are removed.

## Error Handling

An `actor` that is neither a DID (`did:...`) nor a handle (`user.domain`) raises
a `VALIDATION_ERROR` before any network call:

```json
{
  "error": "Actor must be a valid DID (did:...) or handle (user.domain.com)",
  "code": "VALIDATION_ERROR"
}
```

A handle that cannot be resolved, or other API failures, surface as the
underlying AT Protocol error. This tool does not deduplicate or special-case
self-blocks; those conditions are handled by the AT Protocol service and
returned as its error.

## Block vs Mute

- **Block:** complete separation; the user can tell they are blocked.
- **Mute:** soft filter that only affects your own feeds; the user is unaware.

## Related Tools

- **[unblock_user](./unblock-user.md)** - Unblock a user
- **[mute_user](./mute-user.md)** - Mute a user (softer option)
- **[report_user](./report-user.md)** - Report a user for violations

## See Also

- [Moderation Tools](../../guide/tools-resources.md#moderation)
