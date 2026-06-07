# track_users

Scan the in-memory firehose event buffer for activity from specific users.

::: danger Not implemented

`track_users` is registered and visible to MCP clients but scans a buffer that
is **never populated** — firehose decoding is not implemented
(`FIREHOSE_DECODING_IMPLEMENTED = false`), so there is never any user activity
to match. The response includes `firehoseDecodingImplemented: false` and an
explanatory `note`. See [Experimental & Roadmap](../../guide/experimental.md).

:::

## Authentication

**Optional:** No authentication is performed.

## Parameters

| Parameter    | Type       | Required | Default    | Description                                                                                   |
| ------------ | ---------- | -------- | ---------- | --------------------------------------------------------------------------------------------- |
| `users`      | `string[]` | Yes      | —          | User identifiers to track (at least one required). Matched against each event's `repo` (DID). |
| `limit`      | `number`   | No       | `20`       | Maximum number of events to return (1–100).                                                   |
| `eventTypes` | `string[]` | No       | `['post']` | Event types to include: `post`, `like`, `repost`, `follow`, `profile`.                        |

::: tip Matching is by DID

Users are matched against the event's `repo` field, which is a DID. Handles
(e.g. `alice.bsky.social`) are not resolved to DIDs, so to match in principle
you would pass a DID. This is moot while the buffer is empty.

:::

## Event Types

Each event type maps to a collection:

- `post` → `app.bsky.feed.post`
- `like` → `app.bsky.feed.like`
- `repost` → `app.bsky.feed.repost`
- `follow` → `app.bsky.graph.follow`
- `profile` → `app.bsky.actor.profile`

## Behavior

The tool scans the shared in-memory event buffer (max 100 events, FIFO) for
events whose `repo` is one of the tracked users and whose collection matches the
requested event types. Because the firehose never decodes any frames, the buffer
is always empty and there are never any events.

## Response

Tool results are returned as stringified JSON text. The shape is illustrative:

```json
{
  "success": true,
  "firehoseDecodingImplemented": false,
  "note": "AT Protocol firehose frame (CAR/DAG-CBOR) decoding is not implemented in this build, so no live events are ever decoded into the buffer. Empty results here mean \"streaming is not available\", not \"no activity\".",
  "users": ["did:plc:xyz123"],
  "events": [],
  "totalEvents": 0,
  "totalScanned": 0
}
```

`events` is always empty and `totalScanned` is always `0`. The `note` field is
present whenever `firehoseDecodingImplemented` is `false`.

## Errors

An empty `users` array fails schema validation before execution.

## Related Tools

- **[start_streaming](./start-streaming.md)** — Start streaming (currently not
  implemented)
- **[get_recent_events](./get-recent-events.md)** — Read the (empty) event
  buffer
- **[monitor_keywords](./monitor-keywords.md)** — Scan the buffer for keywords
- **[get_user_profile](./get-user-profile.md)** — Get a user's profile (a
  functional alternative)

## See Also

- [Experimental & Roadmap](../../guide/experimental.md)
