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
- **Description:** ISO 8601 timestamp of when notifications were last seen

## Response

```typescript
{
  success: boolean;
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
    reasonSubject?: string;
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

### Get Notifications with Pagination

```json
{
  "limit": 50,
  "cursor": "cursor_from_previous_response"
}
```

### Mark Notifications as Seen

```json
{
  "limit": 50,
  "seenAt": "2024-01-15T10:30:00.000Z"
}
```

## Notification Types

### `like`
Someone liked your post
- `reasonSubject`: URI of the liked post

### `repost`
Someone reposted your post
- `reasonSubject`: URI of the reposted post

### `follow`
Someone followed you
- No `reasonSubject`

### `mention`
Someone mentioned you in a post
- `reasonSubject`: URI of the post with mention

### `reply`
Someone replied to your post
- `reasonSubject`: URI of the parent post

### `quote`
Someone quoted your post
- `reasonSubject`: URI of the quoted post

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

## Best Practices

### Polling
- Poll every 30-60 seconds for new notifications
- Use `seenAt` to track read status
- Implement exponential backoff for errors

### Display
- Group notifications by type
- Show unread count prominently
- Provide quick actions (like, reply)

### Performance
- Cache notifications for short periods
- Prefetch notification details
- Implement virtual scrolling

### User Experience
- Mark as read when viewed
- Allow filtering by notification type
- Provide notification preferences

## Related Tools

- **[get_timeline](./get-timeline.md)** - Get timeline
- **[get_user_profile](./get-user-profile.md)** - Get user profile

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
- [Real-time Data Examples](../../examples/real-time-data.md)

