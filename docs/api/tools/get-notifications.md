# get_notifications

Retrieve the authenticated user's notifications.

## Authentication

**Required:** Yes (Private tool)

## Parameters

### `limit` (optional)

- **Type:** `number`
- **Default:** `50`
- **Constraints:** 1-100
- **Description:** Maximum number of notifications to return

### `cursor` (optional)

- **Type:** `string`
- **Description:** Pagination cursor from previous response

### `seenAt` (optional)

- **Type:** `string`
- **Description:** ISO 8601 timestamp passed through to the read API to compute
  each notification's `isRead` flag relative to that time. This is a read-only
  parameter; it does **not** mark notifications as read or change server-side
  read state.

### `countOnly` (optional)

- **Type:** `boolean`
- **Default:** `false`
- **Description:** When `true`, return only the unread count and skip fetching
  the notification list — a cheap badge-number path. The response contains just
  `{ success, unreadCount }`; the `notifications`, `cursor`, `hasMore`, and
  `seenAt` fields are omitted.

This tool is read-only: it lists notifications but never mutates server-side
read state. To clear the unread state after processing, use the
`mark_notifications_seen` tool.

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

When `countOnly` is `true`, only `success` and `unreadCount` are returned:

```typescript
{
  success: boolean;
  unreadCount: number;
}
```

Otherwise the full list is returned (`unreadCount` is always present):

```typescript
{
  success: boolean;
  unreadCount: number;  // Number of unread notifications
  notifications: Array<{
    uri: string;
    cid: string;
    author: {
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
    };
    reason: string;  // "like", "repost", "follow", "mention", "reply", "quote"
    record: any;
    isRead: boolean;
    indexedAt: string;
    labels?: any[];
  }>;
  cursor?: string;
  seenAt?: string;
  hasMore: boolean;
}
```

## Examples

### Get Recent Notifications

```json
{
  "limit": 50
}
```

### Get Only the Unread Count

```json
{
  "countOnly": true
}
```

**Response:**

```json
{
  "success": true,
  "unreadCount": 7
}
```

### Get Notifications with Pagination

```json
{
  "limit": 50,
  "cursor": "cursor_from_previous_response"
}
```

### Compute `isRead` Relative to a Timestamp

Passing `seenAt` controls how the `isRead` flag on each returned notification is
computed; it does not change any server-side state.

```json
{
  "limit": 50,
  "seenAt": "2026-01-15T10:30:00.000Z"
}
```

## Notification Types

The `reason` field is one of the following values. Note that this tool maps each
notification to
`{ uri, cid, author, reason, record, isRead, indexedAt, labels }` only; the AT
Protocol `reasonSubject` value is not surfaced in the output.

### `like`

Someone liked your post

### `repost`

Someone reposted your post

### `follow`

Someone followed you

### `mention`

Someone mentioned you in a post

### `reply`

Someone replied to your post

### `quote`

Someone quoted your post

## Error Handling

### Common Errors

#### Authentication Required

```json
{
  "error": "Authentication required",
  "code": "AUTHENTICATION_FAILED"
}
```

#### Invalid Limit

```json
{
  "error": "Limit must be between 1 and 100",
  "code": "VALIDATION_ERROR"
}
```

## Pagination

Pass the `cursor` from the previous response to fetch older notifications, and
check `hasMore` before requesting another page. `limit` accepts 1-100 (default
50).

## Related Tools

- **[get_timeline](./get-timeline.md)** - Get timeline
- **[get_user_profile](./get-user-profile.md)** - Get user profile

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
