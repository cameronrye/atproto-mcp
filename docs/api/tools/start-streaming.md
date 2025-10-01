# start_streaming

Start real-time streaming of AT Protocol events from the firehose.

## Authentication

**Optional:** Public tool (works without authentication for public events)

## Parameters

### `subscriptionId` (required)
- **Type:** `string`
- **Description:** Unique identifier for this subscription

### `collections` (optional)
- **Type:** `string[]`
- **Default:** `[]` (all collections)
- **Description:** Filter events by specific collections
- **Examples:**
  - `["app.bsky.feed.post"]` - Only post events
  - `["app.bsky.feed.like", "app.bsky.feed.repost"]` - Likes and reposts
  - `[]` - All events

## Response

```typescript
{
  success: boolean;
  message: string;
  subscription: {
    id: string;           // Subscription ID
    collections: string[]; // Filtered collections
    status: string;       // "active"
  };
  firehoseStatus: {
    connected: boolean;   // Connection status
    lastSeq: number | null; // Last sequence number
    subscriptionCount: number; // Active subscriptions
  }
}
```

## Examples

### Stream All Events

```json
{
  "subscriptionId": "my-stream-1"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Started streaming AT Protocol events for subscription my-stream-1",
  "subscription": {
    "id": "my-stream-1",
    "collections": [],
    "status": "active"
  },
  "firehoseStatus": {
    "connected": true,
    "lastSeq": 12345678,
    "subscriptionCount": 1
  }
}
```

### Stream Only Posts

```json
{
  "subscriptionId": "posts-stream",
  "collections": ["app.bsky.feed.post"]
}
```

### Stream Social Interactions

```json
{
  "subscriptionId": "social-stream",
  "collections": [
    "app.bsky.feed.like",
    "app.bsky.feed.repost",
    "app.bsky.graph.follow"
  ]
}
```

## AT Protocol Firehose

### What is the Firehose?

The firehose is a real-time stream of all public events on the AT Protocol network:
- New posts created
- Likes and reposts
- Follows and unfollows
- Profile updates
- And more

### Event Types

#### Commit Events
- **Type:** `commit`
- **Contains:** Repository commits with operations
- **Operations:**
  - `create` - New record created
  - `update` - Record updated
  - `delete` - Record deleted

#### Identity Events
- **Type:** `identity`
- **Contains:** Identity updates (handle changes, etc.)

#### Account Events
- **Type:** `account`
- **Contains:** Account status changes

## Collections

Common AT Protocol collections:

### Social
- `app.bsky.feed.post` - Posts
- `app.bsky.feed.like` - Likes
- `app.bsky.feed.repost` - Reposts
- `app.bsky.graph.follow` - Follows
- `app.bsky.graph.block` - Blocks

### Profile
- `app.bsky.actor.profile` - Profile updates

### Lists
- `app.bsky.graph.list` - User lists
- `app.bsky.graph.listitem` - List memberships

## Error Handling

### Common Errors

#### Invalid Subscription ID
```json
{
  "error": "Subscription ID is required",
  "code": "VALIDATION_ERROR"
}
```

#### Connection Failed
```json
{
  "error": "Failed to connect to firehose",
  "code": "CONNECTION_ERROR"
}
```

#### Already Subscribed
```json
{
  "error": "Subscription ID already exists",
  "code": "DUPLICATE_SUBSCRIPTION"
}
```

## Best Practices

### Subscription Management
- Use unique subscription IDs
- Stop subscriptions when no longer needed
- Monitor subscription health
- Handle reconnection gracefully

### Event Processing
- Process events asynchronously
- Implement event buffering
- Handle high event volumes
- Use collection filters to reduce load

### Performance
- Filter by collections to reduce bandwidth
- Batch process events when possible
- Implement backpressure handling
- Monitor memory usage

### Reliability
- Implement reconnection logic
- Track sequence numbers for resume
- Handle connection drops gracefully
- Log errors for debugging

## Event Buffer

The server maintains a buffer of recent events:
- **Buffer size:** 100 events
- **Access:** Use `get_recent_events` tool
- **Retention:** In-memory only (lost on restart)

## Use Cases

### Real-time Monitoring
- Monitor mentions of keywords
- Track specific users
- Watch for trending topics
- Detect spam patterns

### Analytics
- Count posts per minute
- Track engagement rates
- Analyze user behavior
- Measure network activity

### Content Moderation
- Detect policy violations
- Monitor reported content
- Track harassment patterns
- Identify spam accounts

### Bot Development
- Auto-reply to mentions
- Repost relevant content
- Track conversation threads
- Engage with community

## Implementation Example

```javascript
// Start streaming
const result = await startStreaming({
  subscriptionId: 'my-bot',
  collections: ['app.bsky.feed.post']
});

// Poll for events
setInterval(async () => {
  const events = await getRecentEvents({
    limit: 20,
    collection: 'app.bsky.feed.post'
  });
  
  for (const event of events.events) {
    if (event.operation === 'create') {
      await processNewPost(event.record);
    }
  }
}, 5000); // Every 5 seconds
```

## Related Tools

- **[stop_streaming](./stop-streaming.md)** - Stop streaming
- **[get_streaming_status](./get-streaming-status.md)** - Check status
- **[get_recent_events](./get-recent-events.md)** - Get buffered events

## See Also

- [Real-time Data Examples](../../examples/real-time-data.md)
- [Firehose Guide](../../guide/tools-resources.md#firehose)
- [Event Processing](../../guide/tools-resources.md#event-processing)

