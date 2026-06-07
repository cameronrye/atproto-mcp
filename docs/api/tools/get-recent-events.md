# get_recent_events

Read recent events from the firehose stream buffer.

::: danger Not implemented

`get_recent_events` is registered and visible to MCP clients but reads a buffer
that is **never populated** — firehose decoding is not implemented
(`FIREHOSE_DECODING_IMPLEMENTED = false`), so no events are ever decoded. The
response includes `firehoseDecodingImplemented: false` and an explanatory
`note`. See [Experimental & Roadmap](../../guide/experimental.md).

:::

## Authentication

**Optional:** No authentication is performed.

## Parameters

### `limit` (optional)

- **Type:** `number`
- **Default:** `20`
- **Constraints:** 1–100
- **Description:** Maximum number of events to return.

### `collection` (optional)

- **Type:** `string`
- **Description:** Filter events by collection, e.g. `"app.bsky.feed.post"`.
  Sets `filtered: true` in the response.

## Behavior

The tool reads from a shared in-memory event buffer (max 100 events, FIFO).
Because the firehose never decodes any frames, the buffer is always empty and
the tool returns no events.

## Response

Tool results are returned as stringified JSON text. The shape is illustrative:

```json
{
  "success": true,
  "firehoseDecodingImplemented": false,
  "note": "AT Protocol firehose frame (CAR/DAG-CBOR) decoding is not implemented in this build, so no live events are ever decoded into the buffer. Empty results here mean \"streaming is not available\", not \"no activity\".",
  "events": [],
  "totalBuffered": 0,
  "filtered": false
}
```

`events` is always empty and `totalBuffered` is always `0`. The `note` field is
present whenever `firehoseDecodingImplemented` is `false`.

## Related Tools

- **[start_streaming](./start-streaming.md)** — Start streaming (currently not
  implemented)
- **[get_streaming_status](./get-streaming-status.md)** — Report streaming
  status
- **[stop_streaming](./stop-streaming.md)** — Stop streaming

## See Also

- [Experimental & Roadmap](../../guide/experimental.md)
