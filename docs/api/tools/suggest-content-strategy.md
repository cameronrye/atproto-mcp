# suggest_content_strategy

Analyze past post performance and suggest content strategy including best posting times, engaging content types, topic recommendations, and optimization tips.

## Authentication

**Required** - This tool requires authentication to analyze post performance and generate recommendations.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `actor` | `string` | No | (authenticated user) | User DID or handle to analyze. Defaults to authenticated user if not specified. |
| `analyzePosts` | `number` | No | `50` | Number of recent posts to analyze. Must be between 10 and 100. |
| `includeTimingAnalysis` | `boolean` | No | `true` | Whether to analyze best posting times. |
| `includeTopicAnalysis` | `boolean` | No | `true` | Whether to analyze topic performance. |

## Response

```typescript
{
  success: boolean;
  actor: string;
  strategy: {
    bestPostingTimes?: string[];
    contentTypes: Array<{
      type: string;
      avgEngagement: number;
      recommendation: string;
    }>;
    topics?: Array<{
      topic: string;
      frequency: number;
      avgEngagement: number;
    }>;
    optimizationTips: string[];
  };
  summary: {
    postsAnalyzed: number;
    avgEngagementRate: number;
    timeRange: { start: string; end: string };
  };
}
```

## Examples

### Get Complete Content Strategy

```json
{
  "analyzePosts": 50,
  "includeTimingAnalysis": true,
  "includeTopicAnalysis": true
}
```

### Analyze Another User's Strategy

```json
{
  "actor": "influencer.bsky.social",
  "analyzePosts": 100
}
```

### Quick Strategy Overview (No Timing Analysis)

```json
{
  "analyzePosts": 30,
  "includeTimingAnalysis": false
}
```

## Error Handling

Common errors:

- **`AuthenticationRequired`**: Must be authenticated to use this tool
- **`InvalidRequest`**: Invalid actor or parameters
- **`ActorNotFound`**: Specified user does not exist
- **`InsufficientData`**: Not enough posts to generate meaningful recommendations
- **`RateLimitExceeded`**: Too many requests in a short period

## Best Practices

1. **Analyze Sufficient Data**: Use at least 50 posts for reliable recommendations
2. **Regular Updates**: Run monthly to adapt to changing audience preferences
3. **Test Recommendations**: Implement suggestions gradually and measure results
4. **Track Changes**: Compare strategies over time to measure improvement
5. **Combine with Engagement Analysis**: Use alongside `analyze_engagement` for deeper insights
6. **Act on Timing**: Schedule important posts during recommended times
7. **Diversify Content**: Balance different content types based on performance

## Understanding Strategy Recommendations

- **Best Posting Times**: Hours when your posts get highest engagement (based on historical data)
- **Content Types**: Performance comparison of text-only, media, links, and thread posts
- **Topics**: Keywords and hashtags that drive the most engagement
- **Optimization Tips**: Actionable recommendations to improve content performance

## Content Types Analyzed

- **withMedia**: Posts with images or videos
- **withLinks**: Posts containing external links
- **textOnly**: Plain text posts without media or links
- **threads**: Multi-post threads or conversations

## Rate Limiting

This tool is subject to AT Protocol API rate limits:

- 3,000 requests per hour for authenticated users
- May require multiple API calls depending on the number of posts analyzed

## Related Tools

- **[analyze_engagement](#analyze-engagement)** - Analyze engagement patterns across posts
- **[analyze_network](#analyze-network)** - Analyze your social network and connections
- **[discover_trending](#discover-trending)** - Discover trending topics and posts
- **[find_influential_users](#find-influential-users)** - Find influential users to engage with
- **[get_timeline](./get-timeline.md)** - View your timeline posts

## See Also

- [Analytics Tools Guide](../../guide/tools-resources.md#analytics--insights)
- [Content Strategy Guide](../../guide/tools-resources.md#content-discovery)

