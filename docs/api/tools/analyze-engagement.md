# analyze_engagement

Analyze engagement patterns across a user's posts. Provides insights into likes, reposts, replies, and content performance.

## Authentication

**Required** - This tool requires authentication to analyze post engagement data.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `actor` | `string` | No | (authenticated user) | User DID or handle to analyze. Defaults to authenticated user if not specified. |
| `limit` | `number` | No | `50` | Number of recent posts to analyze. Must be between 1 and 100. |
| `includeReplies` | `boolean` | No | `true` | Whether to include reply posts in the analysis. |

## Response

```typescript
{
  success: boolean;
  summary: {
    totalPosts: number;
    totalLikes: number;
    totalReposts: number;
    totalReplies: number;
    averageLikes: number;
    averageReposts: number;
    averageReplies: number;
    averageEngagementRate: number;
  };
  topPosts: Array<{
    uri: string;
    text: string;
    likeCount: number;
    repostCount: number;
    replyCount: number;
    engagementRate: number;
    createdAt: string;
  }>;
  insights: {
    bestPerformingType: string;
    optimalTextLength: { min: number; max: number };
    mediaImpact: { withMedia: number; withoutMedia: number };
    hashtagImpact: { withHashtags: number; withoutHashtags: number };
    topHashtags: Array<{ tag: string; avgEngagement: number; count: number }>;
  };
}
```

## Examples

### Analyze Your Own Engagement

```json
{
  "limit": 50,
  "includeReplies": true
}
```

### Analyze Another User's Engagement

```json
{
  "actor": "influencer.bsky.social",
  "limit": 100,
  "includeReplies": false
}
```

### Quick Analysis (Recent Posts Only)

```json
{
  "limit": 20
}
```

## Error Handling

Common errors:

- **`AuthenticationRequired`**: Must be authenticated to use this tool
- **`InvalidRequest`**: Invalid actor or parameters
- **`ActorNotFound`**: Specified user does not exist
- **`RateLimitExceeded`**: Too many requests in a short period

## Best Practices

1. **Analyze Sufficient Data**: Use at least 30-50 posts for meaningful insights
2. **Include Replies**: Set `includeReplies: true` for complete engagement picture
3. **Regular Analysis**: Run weekly or monthly to track trends over time
4. **Compare Periods**: Analyze different time periods to measure growth
5. **Act on Insights**: Use the insights to optimize your content strategy
6. **Track Top Posts**: Study your best-performing posts to understand what works
7. **Monitor Hashtags**: Pay attention to which hashtags drive engagement

## Understanding Engagement Metrics

- **Engagement Rate**: Total engagement (likes + reposts + replies) divided by follower count
- **Best Performing Type**: Content type with highest average engagement (text, media, threads, etc.)
- **Optimal Text Length**: Character range that performs best for your content
- **Media Impact**: Engagement difference between posts with and without media
- **Hashtag Impact**: Engagement difference between posts with and without hashtags

## Rate Limiting

This tool is subject to AT Protocol API rate limits:

- 3,000 requests per hour for authenticated users
- 300 requests per hour for unauthenticated users (not applicable for this tool)

## Related Tools

- **[suggest_content_strategy](#suggest-content-strategy)** - Get content strategy recommendations based on engagement
- **[analyze_network](#analyze-network)** - Analyze your social network and connections
- **[get_user_summary](#get-user-summary)** - Get complete user profile with stats
- **[get_timeline](./get-timeline.md)** - View your timeline posts
- **[search_posts](./search-posts.md)** - Search for specific posts

## See Also

- [Analytics Tools Guide](../../guide/tools-resources.md#analytics--insights)
- [Content Strategy Guide](../../guide/tools-resources.md#content-discovery)

