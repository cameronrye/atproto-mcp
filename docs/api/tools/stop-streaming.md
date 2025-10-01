# stop_streaming

Stop a specific real-time streaming subscription.

## Authentication

**Optional:** Public tool

## Parameters

### `subscriptionId` (required)
- **Type:** `string`
- **Description:** ID of the subscription to stop (from `start_streaming`)

## Response

```typescript
{
  success: boolean;
  message: string;
  subscription: {
    id: string;
    status: string;  // "stopped" or "not_found"
  }
}
```

## Examples

### Stop Streaming

```json
{
  "subscriptionId": "my-stream-1"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Stopped streaming subscription my-stream-1",
  "subscription": {
    "id": "my-stream-1",
    "status": "stopped"
  }
}
```

### Subscription Not Found

```json
{
  "success": false,
  "message": "No active firehose client found",
  "subscription": {
    "id": "unknown-stream",
    "status": "not_found"
  }
}
```

## Error Handling

### Common Errors

#### Invalid Subscription ID
```json
{
  "error": "Subscription ID is required",
  "code": "VALIDATION_ERROR"
}
```

#### Subscription Not Found
```json
{
  "success": false,
  "message": "No active firehose client found"
}
```

## Best Practices

### Resource Management
- Stop subscriptions when no longer needed
- Clean up on application shutdown
- Monitor active subscription count
- Implement timeout for idle subscriptions

### Graceful Shutdown
```javascript
// Stop all subscriptions on shutdown
process.on('SIGTERM', async () => {
  await stopStreaming({ subscriptionId: 'my-stream' });
  process.exit(0);
});
```

### Error Handling
- Handle "not found" gracefully
- Log subscription lifecycle events
- Track subscription state
- Implement retry logic if needed

## Related Tools

- **[start_streaming](./start-streaming.md)** - Start streaming
- **[get_streaming_status](./get-streaming-status.md)** - Check status

## See Also

- [Real-time Data Examples](../../examples/real-time-data.md)

