# mark_notifications_seen

Mark the authenticated user's notifications as seen up to a timestamp (defaults
to now) so they are not reprocessed on subsequent `get_notifications` calls.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `seenAt` (optional)

- **Type:** `string`
- **Default:** the current time
- **Description:** ISO 8601 timestamp; notifications up to this time are marked
  seen. Defaults to now.

This tool persists the seen cursor **server-side**, so the unread state is
cleared for every client. Use it after processing notifications retrieved with
`get_notifications`; the read-only `seenAt` parameter on `get_notifications`
does **not** change this state.

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

```typescript
{
  success: boolean;
  message: string; // "Notifications marked as seen"
  seenAt: string; // ISO 8601 timestamp persisted as the seen-up-to marker
}
```

## Examples

### Mark Everything Seen Now

```json
{}
```

**Response:**

```json
{
  "success": true,
  "message": "Notifications marked as seen",
  "seenAt": "2026-06-11T12:00:00.000Z"
}
```

### Mark Notifications Seen up to a Specific Time

```json
{
  "seenAt": "2026-06-11T09:00:00.000Z"
}
```

## Typical Workflow

1. Call `get_notifications` (optionally with `countOnly: true` to check the
   unread badge first).
2. Process the returned notifications.
3. Call `mark_notifications_seen` to clear the unread state so the next run only
   sees new notifications.

## Error Handling

### Common Errors

#### Authentication Required

```json
{
  "error": "Authentication required",
  "code": "AUTHENTICATION_FAILED"
}
```

## Related Tools

- **[get_notifications](./get-notifications.md)** - Retrieve notifications (this
  tool clears their unread state)

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
