# batch_follow

Follow multiple users in a single operation. Supports up to 25 users at once.
Can continue on errors or stop at first failure.

## Authentication

**Required** - This tool requires authentication to follow users.

## Parameters

| Parameter         | Type       | Required | Default | Description                                                         |
| ----------------- | ---------- | -------- | ------- | ------------------------------------------------------------------- |
| `actors`          | `string[]` | Yes      | -       | Array of user DIDs or handles to follow. Must contain 1-25 entries. |
| `continueOnError` | `boolean`  | No       | `true`  | Whether to continue following remaining users if one fails.         |

## Response

Tool results are returned as a stringified JSON text payload. The shape below is
illustrative:

```typescript
{
  success: boolean;
  results: Array<{
    actor: string;
    success: boolean;
    uri?: string;
    cid?: string;
    did?: string;
    handle?: string;
    error?: string;
    alreadyFollowing?: boolean;
  }>;
  summary: {
    total: number; // entries submitted
    processed: number; // entries actually attempted
    skipped: number; // entries not reached (e.g. stopped early)
    succeeded: number;
    failed: number;
    alreadyFollowing: number;
  }
}
```

`success` is `true` only when no entries failed. Each user is checked against
the authoritative viewer state, so re-following someone you already follow is
reported with `alreadyFollowing: true` rather than creating a duplicate record.

## Examples

### Follow Multiple Users

```json
{
  "actors": ["alice.bsky.social", "bob.bsky.social", "charlie.bsky.social"],
  "continueOnError": true
}
```

### Follow Users (Stop on First Error)

```json
{
  "actors": ["user1.bsky.social", "user2.bsky.social"],
  "continueOnError": false
}
```

### Follow Using DIDs

DIDs are permanent identifiers, while handles can change — prefer DIDs when you
already have them.

```json
{
  "actors": ["did:plc:abc123", "did:plc:def456", "did:plc:ghi789"]
}
```

## Continue on Error Behavior

- **`true` (default)**: Continues following remaining users even if some fail.
  Failed follows are marked in `results` with an `error` message. Best for bulk
  operations where you want maximum coverage.
- **`false`**: Stops at the first error. Unreached users are counted in
  `summary.skipped`. Best when you need all-or-nothing behavior.

## Batch Limits

- **Maximum batch size**: 25 users per request (enforced by the schema; larger
  arrays are rejected with a validation error).
- For easier error triage, smaller batches make it simpler to identify which
  follows succeeded.

## Error Handling

Common errors:

- **`AuthenticationRequired`**: Must be authenticated to use this tool.
- **`InvalidRequest`**: Invalid `actors` array (empty, more than 25, or invalid
  format).
- **`ActorNotFound`**: One or more specified users do not exist.
- **`RateLimitExceeded`**: Too many requests in a short period (see below).

Already-following is **not** an error — it is reported via `alreadyFollowing` in
`results`.

## Rate Limiting

This tool is rate limited to **100 requests per minute** within the MCP server.
Each call to `batch_follow` counts as one request regardless of how many users
are in the batch. Bluesky also applies its own platform-level write limits, so
very large or rapid batches may still be throttled upstream.

## Related Tools

- **[follow_user](./follow-user.md)** - Follow a single user
- **[unfollow_user](./unfollow-user.md)** - Unfollow a single user
- **[get_follows](./get-follows.md)** - Get the list of users you follow
- **[find_similar_users](./find-similar-users.md)** - Find users by shared
  follows/followers
- **[find_influential_users](./find-influential-users.md)** - Find influential
  users in a topic area
- **[discover_communities](./discover-communities.md)** - Discover communities
  around topics

## See Also

- [Tools & Resources Guide](../../guide/tools-resources.md)
