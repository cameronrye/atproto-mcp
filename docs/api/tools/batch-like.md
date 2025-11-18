# batch_like

Like multiple posts in a single operation. Supports up to 25 posts at once. Can continue on errors or stop at first failure.

## Authentication

**Required** - This tool requires authentication to like posts.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `uris` | `string[]` | Yes | - | Array of post AT-URIs to like. Must contain 1-25 URIs. |
| `continueOnError` | `boolean` | No | `true` | Whether to continue liking remaining posts if one fails. |

## Response

```typescript
{
  success: boolean;
  message: string;
  results: Array<{
    uri: string;
    success: boolean;
    likeUri?: string;
    likeCid?: string;
    error?: string;
    alreadyLiked?: boolean;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    alreadyLiked: number;
  };
}
```

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

## Error Handling

Common errors:

- **`AuthenticationRequired`**: Must be authenticated to use this tool
- **`InvalidRequest`**: Invalid URIs array (empty, too many, or invalid format)
- **`InvalidAtUri`**: One or more URIs are not valid AT-URIs
- **`PostNotFound`**: One or more posts do not exist or are deleted
- **`AlreadyLiked`**: Already liked the post (not an error, marked in results)
- **`RateLimitExceeded`**: Too many like requests in a short period
- **`BlockedByAuthor`**: Cannot like posts from users who have blocked you

## Best Practices

1. **Batch Size**: Keep batches under 25 posts (API limit)
2. **Validate URIs**: Ensure all URIs are valid AT-URIs before submitting
3. **Continue on Error**: Set `continueOnError: true` to like as many posts as possible
4. **Check Results**: Review the results array to see which likes succeeded
5. **Handle Already Liked**: Check `alreadyLiked` flag to avoid duplicate attempts
6. **Rate Limiting**: Space out large batch operations to avoid rate limits
7. **Verify Posts**: Ensure posts exist and are accessible before attempting to like

## Batch Limits

- **Maximum batch size**: 25 posts per request
- **Recommended batch size**: 10-15 posts for better error handling
- **Rate limits**: Subject to AT Protocol like rate limits

## Continue on Error Behavior

- **`true` (default)**: Continues liking remaining posts even if some fail
  - Best for bulk operations where you want maximum coverage
  - Failed likes are marked in results with error messages
  
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

## Rate Limiting

This tool is subject to AT Protocol API rate limits:

- 3,000 requests per hour for authenticated users
- Each post in the batch counts as a separate operation
- Large batches may hit rate limits faster

## Related Tools

- **[like_post](./like-post.md)** - Like a single post
- **[unlike_post](./unlike-post.md)** - Unlike a single post
- **[batch_repost](#batch-repost)** - Repost multiple posts at once
- **[recommend_content](#recommend-content)** - Get personalized content recommendations
- **[discover_trending](#discover-trending)** - Discover trending posts to like

## See Also

- [Batch Operations Guide](../../guide/tools-resources.md#batch-operations)
- [Content Management Guide](../../guide/tools-resources.md#content-management)

