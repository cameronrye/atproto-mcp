# monitor_keywords

Scan the in-memory firehose event buffer for posts containing specific keywords.

::: danger Not implemented

`monitor_keywords` is registered and visible to MCP clients but scans a buffer
that is **never populated** — firehose decoding is not implemented
(`FIREHOSE_DECODING_IMPLEMENTED = false`), so there are never any posts to
match. The response includes `firehoseDecodingImplemented: false` and an
explanatory `note`. See [Experimental & Roadmap](../../guide/experimental.md).

:::

## Authentication

**Optional:** No authentication is performed.

## Parameters

| Parameter       | Type       | Required | Default | Description                                                                                                       |
| --------------- | ---------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `keywords`      | `string[]` | Yes      | —       | Keywords to match (at least one required).                                                                        |
| `limit`         | `number`   | No       | `20`    | Maximum number of matches to return (1–100).                                                                      |
| `caseSensitive` | `boolean`  | No       | `false` | Whether matching is case-sensitive. When `false`, keywords and post text are lowercased before a substring match. |

## Behavior

The tool scans the shared in-memory event buffer (max 100 events, FIFO) for
`app.bsky.feed.post` create events and matches keywords as substrings of the
post text. Because the firehose never decodes any frames, the buffer is always
empty and there are never any matches.

## Response

Tool results are returned as stringified JSON text. The shape is illustrative:

```json
{
  "success": true,
  "firehoseDecodingImplemented": false,
  "note": "AT Protocol firehose frame (CAR/DAG-CBOR) decoding is not implemented in this build, so no live events are ever decoded into the buffer. Empty results here mean \"streaming is not available\", not \"no activity\".",
  "keywords": ["bluesky"],
  "matches": [],
  "totalMatches": 0,
  "totalScanned": 0
}
```

`matches` is always empty and `totalScanned` is always `0`. The `note` field is
present whenever `firehoseDecodingImplemented` is `false`.

## Errors

An empty `keywords` array fails schema validation before execution.

## Related Tools

- **[start_streaming](./start-streaming.md)** — Start streaming (currently not
  implemented)
- **[get_recent_events](./get-recent-events.md)** — Read the (empty) event
  buffer
- **[track_users](./track-users.md)** — Scan the buffer for activity from
  specific users
- **[search_posts](./search-posts.md)** — Search historical posts (a functional
  alternative)

## See Also

- [Experimental & Roadmap](../../guide/experimental.md)
