# stop_streaming

Intended to stop a specific real-time streaming subscription.

::: danger Not implemented

`stop_streaming` is registered and visible to MCP clients but is effectively a
**no-op** — because [`start_streaming`](./start-streaming.md) never opens a
connection (firehose decoding is not implemented), there is never an active
subscription to stop. See [Experimental & Roadmap](../../guide/experimental.md).

:::

## Authentication

**Optional:** No authentication is performed.

## Parameters

### `subscriptionId` (required)

- **Type:** `string`
- **Description:** ID of the subscription to stop.

## Behavior

In normal operation no firehose client exists, so the tool reports that there is
nothing to stop. (If a client somehow existed, it would simply remove the named
subscription from the client's subscription map.)

## Response

Tool results are returned as stringified JSON text. With no active firehose
client — the normal case — the shape is illustrative:

```json
{
  "success": false,
  "message": "No active firehose client found",
  "subscription": {
    "id": "my-stream-1",
    "status": "not_found"
  }
}
```

## Errors

A missing or empty `subscriptionId` fails schema validation before execution.

## Related Tools

- **[start_streaming](./start-streaming.md)** — Start streaming (currently not
  implemented)
- **[get_streaming_status](./get-streaming-status.md)** — Report streaming
  status

## See Also

- [Experimental & Roadmap](../../guide/experimental.md)
