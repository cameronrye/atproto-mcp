# discover_trending

Discover trending topics and posts in your network. Analyzes recent activity to identify popular hashtags, topics, and posts.

## Authentication

**Required** - This tool requires authentication to analyze your network's trending content.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | `number` | No | `50` | Number of posts to analyze. Must be between 10 and 100. |
| `timeWindow` | `string` | No | `24h` | Time window for trend analysis. Options: `1h`, `6h`, `12h`, `24h`, `7d`. |
| `includeHashtags` | `boolean` | No | `true` | Whether to include trending hashtags in results. |
| `includeTopics` | `boolean` | No | `true` | Whether to include trending topics in results. |
| `includePosts` | `boolean` | No | `true` | Whether to include trending posts in results. |

## Response

```typescript
{
  success: boolean;
  timeWindow: string;
  trendingHashtags: Array<{
    tag: string;
    count: number;
    recentPosts: number;
    growth: number;
  }>;
  trendingTopics: Array<{
    topic: string;
    count: number;
    relevance: number;
    keywords: string[];
  }>;
  trendingPosts: Array<{
    uri: string;
    text: string;
    author: {
      did: string;
      handle: string;
      displayName?: string;
    };
    likeCount: number;
    repostCount: number;
    replyCount: number;
    trendScore: number;
    createdAt: string;
  }>;
  summary: {
    totalPostsAnalyzed: number;
    uniqueAuthors: number;
    timeRange: { start: string; end: string };
  };
}
```

## Examples

### Discover Trending Content (Last 24 Hours)

```json
{
  "limit": 50,
  "timeWindow": "24h"
}
```

### Find Trending Hashtags Only

```json
{
  "limit": 100,
  "timeWindow": "12h",
  "includeHashtags": true,
  "includeTopics": false,
  "includePosts": false
}
```

### Quick Trending Check (Last Hour)

```json
{
  "limit": 30,
  "timeWindow": "1h"
}
```

### Weekly Trend Analysis

```json
{
  "limit": 100,
  "timeWindow": "7d",
  "includeHashtags": true,
  "includeTopics": true,
  "includePosts": true
}
```

## Error Handling

Common errors:

- **`AuthenticationRequired`**: Must be authenticated to use this tool
- **`InvalidRequest`**: Invalid parameters
- **`InsufficientData`**: Not enough posts in the time window to identify trends
- **`RateLimitExceeded`**: Too many requests in a short period

## Best Practices

1. **Choose Appropriate Time Window**: Use shorter windows (1h, 6h) for real-time trends, longer (24h, 7d) for broader patterns
2. **Regular Monitoring**: Check trends daily to stay current with your network
3. **Act Quickly**: Engage with trending topics while they're hot
4. **Analyze Growth**: Pay attention to hashtags with high growth rates
5. **Verify Relevance**: Ensure trending topics align with your interests
6. **Engage Strategically**: Comment on trending posts to increase visibility
7. **Track Changes**: Monitor how trends evolve over different time windows

## Understanding Trend Metrics

- **Count**: Number of times the hashtag/topic appeared
- **Recent Posts**: Number of posts in the most recent portion of the time window
- **Growth**: Rate of increase in mentions (higher = faster growing trend)
- **Trend Score**: Composite score based on engagement, recency, and velocity
- **Relevance**: How relevant the topic is to your network

## Time Windows

- **`1h`**: Real-time trends, very recent activity
- **`6h`**: Short-term trends, current conversations
- **`12h`**: Half-day trends, sustained topics
- **`24h`**: Daily trends, popular topics of the day
- **`7d`**: Weekly trends, broader patterns and themes

## Rate Limiting

This tool is subject to AT Protocol API rate limits:

- 3,000 requests per hour for authenticated users
- May require multiple API calls depending on the limit parameter

## Related Tools

- **[search_posts](./search-posts.md)** - Search for posts on specific topics
- **[monitor_keywords](#monitor-keywords)** - Monitor keywords in real-time
- **[find_influential_users](#find-influential-users)** - Find influential users in trending topics
- **[recommend_content](#recommend-content)** - Get personalized content recommendations
- **[get_timeline](./get-timeline.md)** - View your timeline

## See Also

- [Content Discovery Guide](../../guide/tools-resources.md#content-discovery)
- [Analytics Tools Guide](../../guide/tools-resources.md#analytics--insights)

