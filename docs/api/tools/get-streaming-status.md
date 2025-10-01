# get_streaming_status

Get the current status of firehose streaming and recent events.

## Authentication

**Optional:** Public tool

## Parameters

None

## Response

```typescript
{
  success: boolean;
  firehoseStatus: {
    connected: boolean;      // Whether firehose is connected
    lastSeq: number | null;  // Last sequence number received
    subscriptionCount: number; // Number of active subscriptions
  };
  recentEvents: Array<{
    type: string;           // Event type
    seq: number;            // Sequence number
    time: string;           // Event timestamp
    repo: string;           // Repository DID
    collection?: string;    // Collection name
    operation?: string;     // Operation type
    receivedAt: string;     // When event was received
  }>;
  eventBufferSize: number;  // Total events in buffer
}
```

## Examples

### Get Status

```json
{}
```

**Response:**
```json
{
  "success": true,
  "firehoseStatus": {
    "connected": true,
    "lastSeq": 12345678,
    "subscriptionCount": 2
  },
  "recentEvents": [
    {
      "type": "commit",
      "seq": 12345670,
      "time": "2024-01-15T10:30:00.000Z",
      "repo": "did:plc:abc123",
      "collection": "app.bsky.feed.post",
      "operation": "create",
      "receivedAt": "2024-01-15T10:30:00.123Z"
    },
    {
      "type": "commit",
      "seq": 12345671,
      "time": "2024-01-15T10:30:01.000Z",
      "repo": "did:plc:def456",
      "collection": "app.bsky.feed.like",
      "operation": "create",
      "receivedAt": "2024-01-15T10:30:01.234Z"
    }
  ],
  "eventBufferSize": 100
}
```

### Not Connected

```json
{
  "success": true,
  "firehoseStatus": {
    "connected": false,
    "lastSeq": null,
    "subscriptionCount": 0
  },
  "recentEvents": [],
  "eventBufferSize": 0
}
```

## Status Fields

### Connection Status
- **connected: true** - Actively receiving events
- **connected: false** - Not connected or disconnected

### Last Sequence Number
- **null** - Never connected or no events received
- **number** - Last event sequence number
- Used for resuming streams after disconnection

### Subscription Count
- Number of active subscriptions
- Each subscription can filter different collections
- 0 means no active subscriptions

### Recent Events
- Last 10 events from buffer
- Includes metadata about each event
- Useful for monitoring stream health

## Use Cases

### Health Monitoring
```javascript
// Check if streaming is healthy
const status = await getStreamingStatus();
if (!status.firehoseStatus.connected) {
  console.error('Firehose disconnected!');
  await reconnect();
}
```

### Debugging
```javascript
// Debug event flow
const status = await getStreamingStatus();
console.log('Last sequence:', status.firehoseStatus.lastSeq);
console.log('Recent events:', status.recentEvents.length);
console.log('Buffer size:', status.eventBufferSize);
```

### Dashboard Display
```javascript
// Show streaming stats in UI
setInterval(async () => {
  const status = await getStreamingStatus();
  updateDashboard({
    connected: status.firehoseStatus.connected,
    eventsPerSecond: calculateRate(status.recentEvents),
    subscriptions: status.firehoseStatus.subscriptionCount
  });
}, 1000);
```

## Best Practices

### Monitoring
- Poll status regularly (every 5-10 seconds)
- Alert on disconnections
- Track sequence number gaps
- Monitor buffer size

### Reconnection
- Detect disconnections quickly
- Implement exponential backoff
- Resume from last sequence number
- Log reconnection attempts

### Performance
- Don't poll too frequently (< 1 second)
- Cache status for short periods
- Use for debugging, not event processing
- Monitor subscription count

## Related Tools

- **[start_streaming](./start-streaming.md)** - Start streaming
- **[stop_streaming](./stop-streaming.md)** - Stop streaming
- **[get_recent_events](./get-recent-events.md)** - Get buffered events

## See Also

- [Real-time Data Examples](../../examples/real-time-data.md)
- [Monitoring Guide](../../guide/tools-resources.md#monitoring)

