# batch_follow

Follow multiple users in a single operation. Supports up to 25 users at once. Can continue on errors or stop at first failure.

## Authentication

**Required** - This tool requires authentication to follow users.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `actors` | `string[]` | Yes | - | Array of user DIDs or handles to follow. Must contain 1-25 users. |
| `continueOnError` | `boolean` | No | `true` | Whether to continue following remaining users if one fails. |

## Response

```typescript
{
  success: boolean;
  message: string;
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
    total: number;
    successful: number;
    failed: number;
    alreadyFollowing: number;
  };
}
```

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

```json
{
  "actors": [
    "did:plc:abc123",
    "did:plc:def456",
    "did:plc:ghi789"
  ]
}
```

## Error Handling

Common errors:

- **`AuthenticationRequired`**: Must be authenticated to use this tool
- **`InvalidRequest`**: Invalid actors array (empty, too many, or invalid format)
- **`ActorNotFound`**: One or more specified users do not exist
- **`AlreadyFollowing`**: Already following the user (not an error, marked in results)
- **`RateLimitExceeded`**: Too many follow requests in a short period
- **`BlockedByUser`**: Cannot follow a user who has blocked you

## Best Practices

1. **Batch Size**: Keep batches under 25 users (API limit)
2. **Use DIDs**: DIDs are permanent, handles can change
3. **Continue on Error**: Set `continueOnError: true` to follow as many users as possible
4. **Check Results**: Review the results array to see which follows succeeded
5. **Handle Already Following**: Check `alreadyFollowing` flag to avoid duplicate attempts
6. **Rate Limiting**: Space out large batch operations to avoid rate limits
7. **Verify Users**: Ensure users exist before attempting to follow

## Batch Limits

- **Maximum batch size**: 25 users per request
- **Recommended batch size**: 10-15 users for better error handling
- **Rate limits**: Subject to AT Protocol follow rate limits

## Continue on Error Behavior

- **`true` (default)**: Continues following remaining users even if some fail
  - Best for bulk operations where you want maximum coverage
  - Failed follows are marked in results with error messages
  
- **`false`**: Stops at the first error
  - Best when order matters or you need all-or-nothing behavior
  - Remaining users are not processed

## Rate Limiting

This tool is subject to AT Protocol API rate limits:

- 3,000 requests per hour for authenticated users
- Each user in the batch counts as a separate operation
- Large batches may hit rate limits faster

## Related Tools

- **[follow_user](./follow-user.md)** - Follow a single user
- **[unfollow_user](./unfollow-user.md)** - Unfollow a single user
- **[get_follows](./get-follows.md)** - Get list of users you follow
- **[find_similar_users](#find-similar-users)** - Find users to follow based on similarity
- **[find_influential_users](#find-influential-users)** - Find influential users to follow
- **[discover_communities](#discover-communities)** - Discover communities to join

## See Also

- [Batch Operations Guide](../../guide/tools-resources.md#batch-operations)
- [User Operations Guide](../../guide/tools-resources.md#user-operations)

