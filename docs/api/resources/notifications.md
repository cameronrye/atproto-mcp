# Notifications Resource

MCP resource that exposes the authenticated user's recent notifications and mentions.

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
  "timestamp": "2024-01-15T10:30:00.000Z",
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
        "createdAt": "2024-01-15T10:25:00.000Z"
      },
      "isRead": false,
      "indexedAt": "2024-01-15T10:25:01.000Z",
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
        "createdAt": "2024-01-15T10:20:00.000Z"
      },
      "isRead": false,
      "indexedAt": "2024-01-15T10:20:01.000Z",
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
        "createdAt": "2024-01-15T10:15:00.000Z"
      },
      "isRead": true,
      "indexedAt": "2024-01-15T10:15:01.000Z",
      "labels": []
    }
  ],
  "cursor": "next_page_cursor",
  "seenAt": "2024-01-15T10:10:00.000Z"
}
```

## Usage in MCP

### Accessing the Resource

```javascript
// Request the notifications resource
const resource = await mcpClient.readResource('atproto://notifications');
const notificationsData = JSON.parse(resource.text);

console.log(`Unread notifications: ${
  notificationsData.notifications.filter(n => !n.isRead).length
}`);
```

### Polling for New Notifications

```javascript
// Poll for new notifications every 30 seconds
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

### Notification Display
- Show unread notification count
- Display notification list
- Group by notification type
- Show notification details

### User Engagement
- Alert on new notifications
- Show notification badges
- Provide quick actions
- Enable notification filtering

### Analytics
- Track notification patterns
- Measure engagement rates
- Analyze notification types
- Monitor response times

### Automation
- Auto-respond to mentions
- Track important notifications
- Filter spam notifications
- Archive old notifications

## Best Practices

### Polling
- Poll every 30-60 seconds
- Use exponential backoff on errors
- Respect rate limits
- Implement efficient diffing

### User Experience
- Show unread count prominently
- Group similar notifications
- Provide quick actions (like, reply)
- Mark as read when viewed

### Performance
- Cache notifications briefly
- Process asynchronously
- Implement virtual scrolling
- Prefetch notification details

### Data Handling
- Parse JSON safely
- Validate notification types
- Handle missing fields
- Log parsing errors

## Notification Management

### Read Status
- `isRead: false` - Unread notification
- `isRead: true` - Read notification
- Update via `get_notifications` tool

### Seen Timestamp
- `seenAt` - Last time user viewed notifications
- Used to determine "new" notifications
- Update when user views notifications

## Limitations

### Data Freshness
- Data is a snapshot at fetch time
- Not real-time (poll for updates)
- May include deleted content briefly
- Read status may be slightly stale

### Pagination
- Limited to 50 notifications per fetch
- Use cursor for additional notifications
- Cursor may expire after time
- No backward pagination

### Content
- Only includes recent notifications
- Older notifications may be archived
- Some notification types may be filtered
- Respects user's notification preferences

## Related Resources

- **[Timeline Resource](./timeline.md)** - User's timeline feed
- **[Profile Resource](./profile.md)** - User profile information

## Related Tools

- **[get_notifications](../tools/get-notifications.md)** - Get notifications with more control

## See Also

- [MCP Protocol Guide](../../guide/mcp-protocol.md)
- [Resource Access Patterns](../../guide/tools-resources.md#resources)
- [Notification Handling](../../guide/tools-resources.md#notifications)

