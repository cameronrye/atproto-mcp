# get_recent_events

Get recent events from the firehose stream buffer.

## Authentication

**Optional:** Public tool

## Parameters

### `limit` (optional)
- **Type:** `number`
- **Default:** `20`
- **Constraints:** 1-100
- **Description:** Maximum number of events to return

### `collection` (optional)
- **Type:** `string`
- **Description:** Filter events by collection
- **Example:** `"app.bsky.feed.post"`

## Response

```typescript
{
  success: boolean;
  events: Array<{
    type: string;           // Event type
    seq: number;            // Sequence number
    time: string;           // Event timestamp
    repo: string;           // Repository DID
    collection?: string;    // Collection name
    operation?: string;     // Operation type (create/update/delete)
    record?: any;           // Record data
    receivedAt: string;     // When event was received
  }>;
  totalBuffered: number;    // Total events in buffer
  filtered: boolean;        // Whether collection filter was applied
}
```

## Examples

### Get Recent Events

```json
{
  "limit": 20
}
```

**Response:**
```json
{
  "success": true,
  "events": [
    {
      "type": "commit",
      "seq": 12345670,
      "time": "2024-01-15T10:30:00.000Z",
      "repo": "did:plc:abc123",
      "collection": "app.bsky.feed.post",
      "operation": "create",
      "record": {
        "$type": "app.bsky.feed.post",
        "text": "Hello world!",
        "createdAt": "2024-01-15T10:30:00.000Z"
      },
      "receivedAt": "2024-01-15T10:30:00.123Z"
    }
  ],
  "totalBuffered": 100,
  "filtered": false
}
```

### Filter by Collection

```json
{
  "limit": 10,
  "collection": "app.bsky.feed.post"
}
```

**Response:**
```json
{
  "success": true,
  "events": [
    {
      "type": "commit",
      "seq": 12345670,
      "time": "2024-01-15T10:30:00.000Z",
      "repo": "did:plc:abc123",
      "collection": "app.bsky.feed.post",
      "operation": "create",
      "record": {
        "$type": "app.bsky.feed.post",
        "text": "Hello world!",
        "createdAt": "2024-01-15T10:30:00.000Z"
      },
      "receivedAt": "2024-01-15T10:30:00.123Z"
    }
  ],
  "totalBuffered": 100,
  "filtered": true
}
```

## Event Buffer

### Buffer Characteristics
- **Size:** 100 events maximum
- **Type:** FIFO (First In, First Out)
- **Retention:** In-memory only
- **Persistence:** Lost on server restart

### Buffer Behavior
- New events push out old events
- Most recent events are at the end
- Filtered queries don't affect buffer
- Buffer shared across all subscriptions

## Event Structure

### Commit Events

#### Create Operation
```json
{
  "type": "commit",
  "operation": "create",
  "collection": "app.bsky.feed.post",
  "record": {
    "$type": "app.bsky.feed.post",
    "text": "Post content",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Update Operation
```json
{
  "type": "commit",
  "operation": "update",
  "collection": "app.bsky.actor.profile",
  "record": {
    "$type": "app.bsky.actor.profile",
    "displayName": "New Name"
  }
}
```

#### Delete Operation
```json
{
  "type": "commit",
  "operation": "delete",
  "collection": "app.bsky.feed.post"
}
```

## Use Cases

### Event Processing
```javascript
// Process recent posts
const result = await getRecentEvents({
  limit: 50,
  collection: 'app.bsky.feed.post'
});

for (const event of result.events) {
  if (event.operation === 'create') {
    await processNewPost(event.record);
  }
}
```

### Monitoring
```javascript
// Monitor specific user activity
const events = await getRecentEvents({ limit: 100 });
const userEvents = events.events.filter(
  e => e.repo === 'did:plc:target-user'
);
console.log(`User has ${userEvents.length} recent events`);
```

### Analytics
```javascript
// Count events by type
const events = await getRecentEvents({ limit: 100 });
const counts = events.events.reduce((acc, event) => {
  acc[event.collection] = (acc[event.collection] || 0) + 1;
  return acc;
}, {});
console.log('Event distribution:', counts);
```

### Debugging
```javascript
// Debug event flow
const result = await getRecentEvents({ limit: 10 });
console.log('Recent events:', result.events.length);
console.log('Total buffered:', result.totalBuffered);
console.log('Filtered:', result.filtered);
```

## Best Practices

### Polling Strategy
- Poll every 5-10 seconds for real-time processing
- Use larger limits for batch processing
- Filter by collection to reduce processing
- Track processed sequence numbers

### Performance
- Don't poll too frequently (< 1 second)
- Use collection filters when possible
- Process events asynchronously
- Implement backpressure handling

### Reliability
- Handle empty event arrays
- Check `totalBuffered` for buffer health
- Track sequence numbers for deduplication
- Implement error handling

### Memory Management
- Process events immediately
- Don't store large event arrays
- Clear processed events
- Monitor buffer size

## Limitations

### Buffer Size
- Only 100 events retained
- High-volume streams may miss events
- Use for recent data only
- Not suitable for historical analysis

### Persistence
- Events lost on server restart
- No replay capability
- No guaranteed delivery
- Use external storage for persistence

## Related Tools

- **[start_streaming](./start-streaming.md)** - Start streaming
- **[get_streaming_status](./get-streaming-status.md)** - Check status
- **[stop_streaming](./stop-streaming.md)** - Stop streaming

## See Also

- [Real-time Data Examples](../../examples/real-time-data.md)
- [Event Processing Guide](../../guide/tools-resources.md#event-processing)

