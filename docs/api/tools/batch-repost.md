# batch_repost

Repost multiple posts in a single operation. Supports up to 25 posts at once.
Can continue on errors or stop at first failure.

## Authentication

**Required** - This tool requires authentication to repost posts.

## Parameters

| Parameter         | Type       | Required | Default | Description                                                 |
| ----------------- | ---------- | -------- | ------- | ----------------------------------------------------------- |
| `uris`            | `string[]` | Yes      | -       | Array of post AT-URIs to repost. Must contain 1-25 entries. |
| `continueOnError` | `boolean`  | No       | `true`  | Whether to continue reposting remaining posts if one fails. |

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
    repostUri?: string;
    repostCid?: string;
    error?: string;
    alreadyReposted?: boolean;
  }>;
  summary: {
    total: number; // entries submitted
    processed: number; // entries actually attempted
    skipped: number; // entries not reached (e.g. stopped early)
    succeeded: number;
    failed: number;
    alreadyReposted: number;
  }
}
```

`success` is `true` only when no entries failed. Each post is checked against
the authoritative viewer state, so reposting something you have already reposted
is reported with `alreadyReposted: true` rather than creating a duplicate
repost.

## Examples

### Repost Multiple Posts

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

### Repost Posts (Stop on First Error)

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

- **`true` (default)**: Continues reposting remaining posts even if some fail.
  Failed reposts are marked in `results` with an `error` message. Best for bulk
  operations where you want maximum coverage.
- **`false`**: Stops at the first error. Unreached posts are counted in
  `summary.skipped`. Best when you need all-or-nothing behavior.

## Repost vs Quote Post

- **Repost** (this tool): Shares the post without adding commentary.
- **Quote Post**: Shares the post with your own commentary — use
  [create_post](./create-post.md) with an embed instead.

## Batch Limits

- **Maximum batch size**: 25 posts per request (enforced by the schema; larger
  arrays are rejected with a validation error).
- For easier error triage, smaller batches make it simpler to identify which
  reposts succeeded.

## Error Handling

Common errors:

- **`AuthenticationRequired`**: Must be authenticated to use this tool.
- **`InvalidRequest`**: Invalid `uris` array (empty, more than 25, or invalid
  format).
- **`InvalidAtUri`**: One or more URIs are not valid AT-URIs.
- **`PostNotFound`**: One or more posts do not exist or are deleted.
- **`RateLimitExceeded`**: Too many requests in a short period (see below).

Already-reposted is **not** an error — it is reported via `alreadyReposted` in
`results`.

## Rate Limiting

This tool is rate limited to **100 requests per minute** within the MCP server.
Each call to `batch_repost` counts as one request regardless of how many posts
are in the batch. Bluesky also applies its own platform-level write limits, so
very large or rapid batches may still be throttled upstream.

## Related Tools

- **[repost](./repost.md)** - Repost a single post
- **[unrepost](./unrepost.md)** - Remove a repost
- **[batch_like](./batch-like.md)** - Like multiple posts at once
- **[create_post](./create-post.md)** - Create a quote post with commentary
- **[recommend_content](./recommend-content.md)** - Get personalized content
  recommendations
- **[discover_trending](./discover-trending.md)** - Surface trending posts from
  your home timeline

## See Also

- [Tools & Resources Guide](../../guide/tools-resources.md)
