# batch_action

Apply the same action across up to 25 targets in a single call. Replaces the
former `batch_follow`, `batch_like`, and `batch_repost` tools — select the
operation with the `action` parameter.

## Authentication

**Required:** Yes (Private tool)

This tool performs real writes (follows/likes/reposts) to the network on the
caller's behalf.

## Parameters

### `action` (required)

- **Type:** `string`
- **Values:** `"follow"` | `"like"` | `"repost"`
- **Description:** The action to apply to every target

### `targets` (required)

- **Type:** `string[]`
- **Constraints:** 1-25 items
- **Description:** For `action: "follow"`, handles or DIDs. For `action: "like"`
  or `action: "repost"`, post AT-URIs.

### `continueOnError` (optional)

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Continue processing the remaining targets after an individual
  failure. When `false`, processing stops at the first failure and remaining
  targets are reported as skipped.

## Response

```typescript
{
  success: boolean; // True when every processed target succeeded (failed === 0)
  action: 'follow' | 'like' | 'repost'; // The action that was applied
  results: Array<{
    // For follow: { actor, success, uri?, cid?, did?, handle?, error?, alreadyFollowing? }
    // For like:   { uri, success, likeUri?, likeCid?, error?, alreadyLiked? }
    // For repost: { uri, success, repostUri?, repostCid?, error?, alreadyReposted? }
  }>;
  summary: {
    total: number; // Number of targets supplied
    processed: number; // How many were actually processed
    skipped: number; // total - processed (non-zero only when stopped early)
    succeeded: number; // How many succeeded (includes already-applied)
    failed: number; // How many failed
    // Plus one of: alreadyFollowing | alreadyLiked | alreadyReposted
  };
}
```

Targets that were already followed/liked/reposted count as successes and are
flagged with the corresponding `already*` field.

## Examples

### Batch Follow

```json
{
  "action": "follow",
  "targets": ["alice.bsky.social", "bob.bsky.social", "did:plc:abc123"]
}
```

**Response:**

```json
{
  "success": true,
  "action": "follow",
  "results": [
    {
      "actor": "alice.bsky.social",
      "success": true,
      "uri": "at://did:plc:me/app.bsky.graph.follow/abc",
      "did": "did:plc:alice",
      "handle": "alice.bsky.social",
      "alreadyFollowing": false
    }
  ],
  "summary": {
    "total": 3,
    "processed": 3,
    "skipped": 0,
    "succeeded": 3,
    "failed": 0,
    "alreadyFollowing": 0
  }
}
```

### Batch Like

```json
{
  "action": "like",
  "targets": [
    "at://did:plc:abc/app.bsky.feed.post/p1",
    "at://did:plc:abc/app.bsky.feed.post/p2"
  ]
}
```

### Batch Repost, Stopping on First Error

```json
{
  "action": "repost",
  "targets": [
    "at://did:plc:abc/app.bsky.feed.post/p1",
    "at://did:plc:abc/app.bsky.feed.post/p2"
  ],
  "continueOnError": false
}
```

## Error Handling

### Common Errors

#### Authentication Required

```json
{
  "error": "Authentication required",
  "code": "AUTHENTICATION_FAILED"
}
```

#### Too Many Targets

```json
{
  "error": "targets must contain between 1 and 25 items",
  "code": "VALIDATION_ERROR"
}
```

Individual target failures are captured per-item in `results[].error` rather
than failing the whole call (unless `continueOnError` is `false`).

## Best Practices

- Keep batches to 25 or fewer targets per call (the hard limit)
- Use `continueOnError: true` (the default) for best-effort bulk operations, or
  `false` to abort on the first failure
- Inspect `summary.failed` and the per-target `error` fields to retry only the
  targets that did not succeed
- Respect rate limits when issuing multiple batches

## Related Tools

- **[follow_user](./follow-user.md)** - Follow a single user
- **[like_post](./like-post.md)** - Like a single post
- **[repost](./repost.md)** - Repost a single post

## See Also

- [Social Operations Examples](../../examples/social-operations.md)
- [Authentication Guide](../../guide/authentication.md)
