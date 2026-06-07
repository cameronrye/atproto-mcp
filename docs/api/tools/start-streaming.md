# start_streaming

Intended to start real-time streaming of AT Protocol firehose events.

::: danger Not implemented

`start_streaming` is registered and visible to MCP clients but is **not
functional** — AT Protocol firehose frame (CAR/DAG-CBOR) decoding is not
implemented in this build (`FIREHOSE_DECODING_IMPLEMENTED = false`), so the tool
opens no WebSocket and delivers no events. See
[Experimental & Roadmap](../../guide/experimental.md).

:::

## Authentication

**Optional:** No authentication is performed (the tool returns before
connecting).

## Parameters

### `subscriptionId` (required)

- **Type:** `string`
- **Description:** Unique identifier for the requested subscription. Echoed back
  in the response.

### `collections` (optional)

- **Type:** `string[]`
- **Default:** `[]`
- **Description:** Collections the subscription would filter by, e.g.
  `["app.bsky.feed.post"]`. Echoed back in the response but has no effect while
  streaming is unavailable.

## Behavior

Because firehose decoding is not implemented, the tool short-circuits before
opening a socket and returns a `not_implemented` status. No connection is made,
no subscription is created, and the shared event buffer stays empty.

## Response

Tool results are returned as stringified JSON text. The shape is illustrative:

```json
{
  "success": false,
  "message": "Real-time streaming is not available. AT Protocol firehose frame (CAR/DAG-CBOR) decoding is not implemented in this build, so no live events are ever decoded into the buffer. Empty results here mean \"streaming is not available\", not \"no activity\".",
  "subscription": {
    "id": "my-stream-1",
    "collections": [],
    "status": "not_implemented"
  },
  "firehoseStatus": {
    "connected": false,
    "lastSeq": null,
    "subscriptionCount": 0
  }
}
```

`status` is always `not_implemented`, `connected` is always `false`, `lastSeq`
is always `null`, and `subscriptionCount` is always `0`.

## Errors

A missing or empty `subscriptionId` fails schema validation before execution.

## Related Tools

- **[stop_streaming](./stop-streaming.md)** — Stop a subscription (no-op while
  streaming is unavailable)
- **[get_streaming_status](./get-streaming-status.md)** — Report streaming
  status
- **[get_recent_events](./get-recent-events.md)** — Read the (empty) event
  buffer

## See Also

- [Experimental & Roadmap](../../guide/experimental.md)
