# Notifications Resource

MCP resource that exposes the authenticated user's recent notifications and
mentions.

## Resource URI

```
atproto://notifications
```

## Authentication

**Required:** Yes

This resource requires authentication to access the user's notifications.

## Resource Information

- **Name:** User Notifications
- **Description:** Current user's recent notifications and mentions
- **MIME Type:** `application/json`

## Data Structure

```typescript
{
  uri: string;              // Resource URI
  timestamp: string;        // ISO 8601 timestamp when data was fetched
  notifications: Array<{
    uri: string;            // Notification URI
    cid: string;            // Notification CID
    author: {
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
    };
    reason: string;         // Notification type
    reasonSubject?: string; // Subject URI (for likes, reposts, etc.)
    record: any;            // Notification record data
    isRead: boolean;        // Whether notification has been read
    indexedAt: string;      // When notification was indexed
    labels?: Array<any>;    // Moderation labels
  }>;
  cursor?: string;          // Pagination cursor
  seenAt?: string;          // Last seen timestamp
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

## Example Response

```json
{
  "uri": "atproto://notifications",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "notifications": [
    {
      "uri": "at://did:plc:abc123/app.bsky.feed.like/like123",
      "cid": "bafyreiabc123...",
      "author": {
        "did": "did:plc:def456",
        "handle": "bob.bsky.social",
        "displayName": "Bob Johnson",
        "avatar": "https://cdn.bsky.app/img/avatar/..."
      },
      "reason": "like",
      "reasonSubject": "at://did:plc:myuser/app.bsky.feed.post/post123",
      "record": {
        "$type": "app.bsky.feed.like",
        "subject": {
          "uri": "at://did:plc:myuser/app.bsky.feed.post/post123",
          "cid": "bafyreiabc123..."
        },
        "createdAt": "2026-01-15T10:25:00.000Z"
      },
      "isRead": false,
      "indexedAt": "2026-01-15T10:25:01.000Z",
      "labels": []
    },
    {
      "uri": "at://did:plc:ghi789/app.bsky.graph.follow/follow456",
      "cid": "bafyreighi789...",
      "author": {
        "did": "did:plc:ghi789",
        "handle": "charlie.bsky.social",
        "displayName": "Charlie Brown"
      },
      "reason": "follow",
      "record": {
        "$type": "app.bsky.graph.follow",
        "subject": "did:plc:myuser",
        "createdAt": "2026-01-15T10:20:00.000Z"
      },
      "isRead": false,
      "indexedAt": "2026-01-15T10:20:01.000Z",
      "labels": []
    },
    {
      "uri": "at://did:plc:jkl012/app.bsky.feed.post/reply789",
      "cid": "bafyreijkl012...",
      "author": {
        "did": "did:plc:jkl012",
        "handle": "diana.bsky.social",
        "displayName": "Diana Prince"
      },
      "reason": "reply",
      "reasonSubject": "at://did:plc:myuser/app.bsky.feed.post/post456",
      "record": {
        "$type": "app.bsky.feed.post",
        "text": "Great point! I totally agree.",
        "reply": {
          "root": {
            "uri": "at://did:plc:myuser/app.bsky.feed.post/post456",
            "cid": "bafyreiabc123..."
          },
          "parent": {
            "uri": "at://did:plc:myuser/app.bsky.feed.post/post456",
            "cid": "bafyreiabc123..."
          }
        },
        "createdAt": "2026-01-15T10:15:00.000Z"
      },
      "isRead": true,
      "indexedAt": "2026-01-15T10:15:01.000Z",
      "labels": []
    }
  ],
  "cursor": "next_page_cursor",
  "seenAt": "2026-01-15T10:10:00.000Z"
}
```

## Usage in MCP

### Accessing the Resource

```javascript
// Request the notifications resource
const resource = await mcpClient.readResource('atproto://notifications');
const notificationsData = JSON.parse(resource.text);

console.log(
  `Unread notifications: ${
    notificationsData.notifications.filter(n => !n.isRead).length
  }`
);
```

### Polling for New Notifications

Each read returns a fresh snapshot. The interval below is a client-side
suggestion — the server does not poll or push notifications on your behalf.

```javascript
// Re-read notifications periodically (client-side choice, not server behavior)
setInterval(async () => {
  const resource = await mcpClient.readResource('atproto://notifications');
  const data = JSON.parse(resource.text);

  const unread = data.notifications.filter(n => !n.isRead);
  if (unread.length > 0) {
    await handleNewNotifications(unread);
  }
}, 30000);
```

### Grouping Notifications

```javascript
// Group notifications by type
const resource = await mcpClient.readResource('atproto://notifications');
const data = JSON.parse(resource.text);

const grouped = data.notifications.reduce((acc, notif) => {
  acc[notif.reason] = acc[notif.reason] || [];
  acc[notif.reason].push(notif);
  return acc;
}, {});

console.log(`Likes: ${grouped.like?.length || 0}`);
console.log(`Follows: ${grouped.follow?.length || 0}`);
console.log(`Replies: ${grouped.reply?.length || 0}`);
```

## Use Cases

- Show an unread count and render a grouped notification list
- Alert on new mentions, replies, likes, reposts, and follows
- Drive automation such as auto-responding to mentions
- Analyze notification patterns and engagement

## Best Practices

These are suggestions for client applications; none are enforced by this server.

- Treat each read as a point-in-time snapshot and re-read when you need newer
  data
- Group similar notifications and surface the unread count prominently
- Use the `cursor` to page through older notifications
- Parse the JSON defensively and handle missing optional fields

## Notification Management

### Read Status

- `isRead: false` - Unread notification
- `isRead: true` - Read notification
- This resource and the `get_notifications` tool are **read-only**; neither
  marks notifications as read. The read/seen state is set elsewhere in the AT
  Protocol stack (e.g. when the user views notifications in a client).

### Seen Timestamp

- `seenAt` - Last time notifications were marked as seen for this account
- Used to determine which notifications are "new"

## Limitations

- Data is a snapshot at fetch time, not a real-time stream; re-read for updates
- Each read returns up to 50 notifications (hardcoded server-side); use the
  `cursor` to fetch more
- Cursors are forward-only and may expire over time
- Only recent notifications are included; older ones may be archived by the
  service

## Related Resources

- **[Timeline Resource](./timeline.md)** - User's timeline feed
- **[Profile Resource](./profile.md)** - User profile information

## Related Tools

- **[get_notifications](../tools/get-notifications.md)** - Get notifications
  with more control

## See Also

- [MCP Protocol Guide](../../guide/mcp-protocol.md)
- [Resource Access Patterns](../../guide/tools-resources.md#resources)
- [Notification Handling](../../guide/tools-resources.md#notifications)
