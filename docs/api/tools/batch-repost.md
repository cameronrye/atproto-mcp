# batch_repost

Repost multiple posts in a single operation. Supports up to 25 posts at once. Can continue on errors or stop at first failure.

## Authentication

**Required** - This tool requires authentication to repost posts.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `uris` | `string[]` | Yes | - | Array of post AT-URIs to repost. Must contain 1-25 URIs. |
| `continueOnError` | `boolean` | No | `true` | Whether to continue reposting remaining posts if one fails. |

## Response

```typescript
{
  success: boolean;
  message: string;
  results: Array<{
    uri: string;
    success: boolean;
    repostUri?: string;
    repostCid?: string;
    error?: string;
    alreadyReposted?: boolean;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    alreadyReposted: number;
  };
}
```

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

## Error Handling

Common errors:

- **`AuthenticationRequired`**: Must be authenticated to use this tool
- **`InvalidRequest`**: Invalid URIs array (empty, too many, or invalid format)
- **`InvalidAtUri`**: One or more URIs are not valid AT-URIs
- **`PostNotFound`**: One or more posts do not exist or are deleted
- **`AlreadyReposted`**: Already reposted the post (not an error, marked in results)
- **`RateLimitExceeded`**: Too many repost requests in a short period
- **`BlockedByAuthor`**: Cannot repost posts from users who have blocked you

## Best Practices

1. **Batch Size**: Keep batches under 25 posts (API limit)
2. **Validate URIs**: Ensure all URIs are valid AT-URIs before submitting
3. **Continue on Error**: Set `continueOnError: true` to repost as many posts as possible
4. **Check Results**: Review the results array to see which reposts succeeded
5. **Handle Already Reposted**: Check `alreadyReposted` flag to avoid duplicate attempts
6. **Rate Limiting**: Space out large batch operations to avoid rate limits
7. **Verify Posts**: Ensure posts exist and are accessible before attempting to repost
8. **Add Context**: Consider using quote posts instead for adding commentary

## Batch Limits

- **Maximum batch size**: 25 posts per request
- **Recommended batch size**: 10-15 posts for better error handling
- **Rate limits**: Subject to AT Protocol repost rate limits

## Continue on Error Behavior

- **`true` (default)**: Continues reposting remaining posts even if some fail
  - Best for bulk operations where you want maximum coverage
  - Failed reposts are marked in results with error messages
  
- **`false`**: Stops at the first error
  - Best when order matters or you need all-or-nothing behavior
  - Remaining posts are not processed

## AT-URI Format

AT-URIs must follow this format:
```
at://did:plc:USER_DID/app.bsky.feed.post/POST_ID
```

Example:
```
at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3k7qe4smwe22t
```

## Repost vs Quote Post

- **Repost** (this tool): Shares the post without adding commentary
- **Quote Post**: Shares the post with your own commentary (use `create_post` with embed)

## Rate Limiting

This tool is subject to AT Protocol API rate limits:

- 3,000 requests per hour for authenticated users
- Each post in the batch counts as a separate operation
- Large batches may hit rate limits faster

## Related Tools

- **[repost](./repost.md)** - Repost a single post
- **[unrepost](./unrepost.md)** - Remove a repost
- **[batch_like](#batch-like)** - Like multiple posts at once
- **[create_post](./create-post.md)** - Create a quote post with commentary
- **[recommend_content](#recommend-content)** - Get personalized content recommendations
- **[discover_trending](#discover-trending)** - Discover trending posts to repost

## See Also

- [Batch Operations Guide](../../guide/tools-resources.md#batch-operations)
- [Content Management Guide](../../guide/tools-resources.md#content-management)

