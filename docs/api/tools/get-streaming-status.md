# get_streaming_status

Report the current status of firehose streaming and recent buffered events.

::: danger Not implemented

`get_streaming_status` is registered and visible to MCP clients but reports a
**non-functional** subsystem — firehose decoding is not implemented
(`FIREHOSE_DECODING_IMPLEMENTED = false`), so the firehose is never connected
and the event buffer is always empty. The response includes
`firehoseDecodingImplemented: false` and an explanatory `note`. See
[Experimental & Roadmap](../../guide/experimental.md).

:::

## Authentication

**Optional:** No authentication is performed.

## Parameters

None.

## Behavior

The tool reports the state of the shared firehose client and event buffer.
Because nothing ever connects, the buffer is always empty (`eventBufferSize: 0`,
`recentEvents: []`) and the connection status is always disconnected.

## Response

Tool results are returned as stringified JSON text. The shape is illustrative:

```json
{
  "success": true,
  "firehoseDecodingImplemented": false,
  "note": "AT Protocol firehose frame (CAR/DAG-CBOR) decoding is not implemented in this build, so no live events are ever decoded into the buffer. Empty results here mean \"streaming is not available\", not \"no activity\".",
  "firehoseStatus": {
    "connected": false,
    "lastSeq": null,
    "subscriptionCount": 0
  },
  "recentEvents": [],
  "eventBufferSize": 0
}
```

`recentEvents` would return up to the last 10 buffered events, but the buffer
never populates. The `note` field is present whenever
`firehoseDecodingImplemented` is `false`.

## Related Tools

- **[start_streaming](./start-streaming.md)** — Start streaming (currently not
  implemented)
- **[stop_streaming](./stop-streaming.md)** — Stop streaming
- **[get_recent_events](./get-recent-events.md)** — Read the (empty) event
  buffer

## See Also

- [Experimental & Roadmap](../../guide/experimental.md)
