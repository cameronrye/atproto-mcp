# track_users

Track activity from specific users in the firehose stream. Returns recent events from the specified users.

## Authentication

**Optional** - This tool works without authentication but requires the firehose to be started first using `start_streaming`.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `users` | `string[]` | Yes | - | Array of user DIDs or handles to track. At least one user is required. |
| `limit` | `number` | No | `20` | Maximum number of events to return. Must be between 1 and 100. |
| `eventTypes` | `string[]` | No | `['post']` | Types of events to track. Options: `post`, `like`, `repost`, `follow`, `profile`. |

## Response

```typescript
{
  success: boolean;
  users: string[];
  events: Array<{
    user: string;
    eventType: string;
    collection: string;
    operation: string;
    record?: any;
    seq: number;
    time: string;
    receivedAt: string;
  }>;
  totalEvents: number;
  totalScanned: number;
}
```

## Examples

### Track User Posts

```json
{
  "users": ["alice.bsky.social"],
  "limit": 10
}
```

### Track Multiple Users (All Event Types)

```json
{
  "users": ["alice.bsky.social", "bob.bsky.social", "did:plc:xyz123"],
  "limit": 50,
  "eventTypes": ["post", "like", "repost", "follow"]
}
```

### Track User Engagement Only

```json
{
  "users": ["influencer.bsky.social"],
  "eventTypes": ["like", "repost"],
  "limit": 25
}
```

## Error Handling

Common errors:

- **`InvalidRequest`**: No users provided or invalid parameters
- **`StreamingNotStarted`**: Firehose streaming must be started first using `start_streaming`
- **`RateLimitExceeded`**: Too many requests in a short period

## Best Practices

1. **Start Streaming First**: Always call `start_streaming` before using this tool
2. **Use DIDs for Reliability**: DIDs are permanent, handles can change
3. **Filter Event Types**: Specify only the event types you need to reduce noise
4. **Adjust Limit**: Start with a smaller limit and increase as needed
5. **Buffer Size**: The tool scans the event buffer, which has a maximum size - older events may be dropped
6. **Track Key Accounts**: Monitor influential users or competitors for insights
7. **Combine with Keywords**: Use `monitor_keywords` alongside this tool for comprehensive monitoring

## Event Types

- **`post`**: New posts created by the user (collection: `app.bsky.feed.post`)
- **`like`**: Posts liked by the user (collection: `app.bsky.feed.like`)
- **`repost`**: Posts reposted by the user (collection: `app.bsky.feed.repost`)
- **`follow`**: Users followed by the user (collection: `app.bsky.graph.follow`)
- **`profile`**: Profile updates (collection: `app.bsky.actor.profile`)

## Rate Limiting

This tool reads from the local event buffer and is not subject to AT Protocol API rate limits. However, the firehose connection itself has limits:

- Maximum 1 concurrent firehose connection per client
- Event buffer size is limited (typically 1000 events)
- Older events are dropped as new ones arrive

## Related Tools

- **[start_streaming](./start-streaming.md)** - Start the firehose stream (required before using this tool)
- **[stop_streaming](./stop-streaming.md)** - Stop the firehose stream
- **[get_streaming_status](./get-streaming-status.md)** - Check firehose connection status
- **[get_recent_events](./get-recent-events.md)** - Get recent events from the buffer
- **[monitor_keywords](#monitor-keywords)** - Monitor keywords in the firehose
- **[get_user_profile](./get-user-profile.md)** - Get detailed user profile information

## See Also

- [Streaming Tools Guide](../../guide/tools-resources.md#streaming--real-time)
- [AT Protocol Firehose Documentation](https://docs.bsky.app/docs/advanced-guides/firehose)

