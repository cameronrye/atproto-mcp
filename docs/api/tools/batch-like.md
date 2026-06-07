# batch_like

Like multiple posts in a single operation. Supports up to 25 posts at once. Can
continue on errors or stop at first failure.

## Authentication

**Required** - This tool requires authentication to like posts.

## Parameters

| Parameter         | Type       | Required | Default | Description                                               |
| ----------------- | ---------- | -------- | ------- | --------------------------------------------------------- |
| `uris`            | `string[]` | Yes      | -       | Array of post AT-URIs to like. Must contain 1-25 entries. |
| `continueOnError` | `boolean`  | No       | `true`  | Whether to continue liking remaining posts if one fails.  |

Each entry must be a valid post AT-URI of the form
`at://did:plc:USER_DID/app.bsky.feed.post/POST_ID`, for example
`at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3k7qe4smwe22t`.

## Response

Tool results are returned as a stringified JSON text payload. The shape below is
illustrative:

```typescript
{
  success: boolean;
  results: Array<{
    uri: string;
    success: boolean;
    likeUri?: string;
    likeCid?: string;
    error?: string;
    alreadyLiked?: boolean;
  }>;
  summary: {
    total: number; // entries submitted
    processed: number; // entries actually attempted
    skipped: number; // entries not reached (e.g. stopped early)
    succeeded: number;
    failed: number;
    alreadyLiked: number;
  }
}
```

`success` is `true` only when no entries failed. Each post is checked against
the authoritative viewer state, so liking a post you have already liked is
reported with `alreadyLiked: true` rather than creating a duplicate like.

## Examples

### Like Multiple Posts

```json
{
  "uris": [
    "at://did:plc:abc123/app.bsky.feed.post/xyz1",
    "at://did:plc:abc123/app.bsky.feed.post/xyz2",
    "at://did:plc:def456/app.bsky.feed.post/xyz3"
  ],
  "continueOnError": true
}
```

### Like Posts (Stop on First Error)

```json
{
  "uris": [
    "at://did:plc:abc123/app.bsky.feed.post/xyz1",
    "at://did:plc:abc123/app.bsky.feed.post/xyz2"
  ],
  "continueOnError": false
}
```

## Continue on Error Behavior

- **`true` (default)**: Continues liking remaining posts even if some fail.
  Failed likes are marked in `results` with an `error` message. Best for bulk
  operations where you want maximum coverage.
- **`false`**: Stops at the first error. Unreached posts are counted in
  `summary.skipped`. Best when you need all-or-nothing behavior.

## Batch Limits

- **Maximum batch size**: 25 posts per request (enforced by the schema; larger
  arrays are rejected with a validation error).
- For easier error triage, smaller batches make it simpler to identify which
  likes succeeded.

## Error Handling

Common errors:

- **`AuthenticationRequired`**: Must be authenticated to use this tool.
- **`InvalidRequest`**: Invalid `uris` array (empty, more than 25, or invalid
  format).
- **`InvalidAtUri`**: One or more URIs are not valid AT-URIs.
- **`PostNotFound`**: One or more posts do not exist or are deleted.
- **`RateLimitExceeded`**: Too many requests in a short period (see below).

Already-liked is **not** an error — it is reported via `alreadyLiked` in
`results`.

## Rate Limiting

This tool is rate limited to **100 requests per minute** within the MCP server.
Each call to `batch_like` counts as one request regardless of how many posts are
in the batch. Bluesky also applies its own platform-level write limits, so very
large or rapid batches may still be throttled upstream.

## Related Tools

- **[like_post](./like-post.md)** - Like a single post
- **[unlike_post](./unlike-post.md)** - Unlike a single post
- **[batch_repost](./batch-repost.md)** - Repost multiple posts at once
- **[recommend_content](./recommend-content.md)** - Get personalized content
  recommendations
- **[discover_trending](./discover-trending.md)** - Surface trending posts from
  your home timeline

## See Also

- [Tools & Resources Guide](../../guide/tools-resources.md)
