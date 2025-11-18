# recommend_content

Recommend posts based on user interests and engagement history. Analyzes your timeline, engagement patterns, and network to suggest relevant content.

## Authentication

**Required** - This tool requires authentication to analyze your engagement history and generate personalized recommendations.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `maxResults` | `number` | No | `20` | Maximum number of recommended posts to return. Must be between 1 and 100. |
| `minLikes` | `number` | No | `5` | Minimum like count for recommended posts. Must be 0 or greater. |
| `maxAge` | `number` | No | `24` | Maximum age of posts in hours. Must be between 1 and 168 (7 days). |
| `topics` | `string[]` | No | - | Optional array of topics to filter recommendations. |
| `excludeReposts` | `boolean` | No | `false` | Whether to exclude reposted content from recommendations. |

## Response

```typescript
{
  success: boolean;
  recommendations: Array<{
    uri: string;
    cid: string;
    author: {
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
    };
    text: string;
    likeCount: number;
    replyCount: number;
    repostCount: number;
    indexedAt: string;
    recommendationScore: number;
    recommendationReasons: string[];
    topics?: string[];
  }>;
  insights: string[];
}
```

## Examples

### Get Personalized Recommendations

```json
{
  "maxResults": 20,
  "minLikes": 5,
  "maxAge": 24
}
```

### Find High-Quality Recent Content

```json
{
  "maxResults": 30,
  "minLikes": 20,
  "maxAge": 12,
  "excludeReposts": true
}
```

### Topic-Specific Recommendations

```json
{
  "maxResults": 25,
  "topics": ["technology", "AI", "programming"],
  "minLikes": 10
}
```

### Discover Older Content

```json
{
  "maxResults": 50,
  "maxAge": 168,
  "minLikes": 15
}
```

## Error Handling

Common errors:

- **`AuthenticationRequired`**: Must be authenticated to use this tool
- **`InvalidRequest`**: Invalid parameters
- **`InsufficientData`**: Not enough engagement history to generate recommendations
- **`RateLimitExceeded`**: Too many requests in a short period

## Best Practices

1. **Regular Discovery**: Run daily to discover new content
2. **Adjust Filters**: Experiment with different `minLikes` and `maxAge` values
3. **Use Topics**: Filter by topics when looking for specific content
4. **Review Reasons**: Understand why content is recommended
5. **Engage with Recommendations**: Like, reply, or repost to improve future recommendations
6. **Exclude Reposts**: Set `excludeReposts: true` for original content only
7. **Vary Time Windows**: Try different `maxAge` values to discover both fresh and evergreen content

## Recommendation Score

The recommendation score (0-100) is calculated based on:
- **Engagement**: Likes, reposts, and replies
- **Author Preference**: Posts from authors you frequently engage with
- **Topic Relevance**: Match with your interests and specified topics
- **Recency**: Newer posts score higher (within the time window)
- **Network Overlap**: Posts from your network or similar users

## Recommendation Reasons

Common reasons include:
- "High engagement (X likes)"
- "From an author you frequently engage with"
- "Matches your topic interests"
- "Popular in your network"
- "Similar to posts you've liked"

## Rate Limiting

This tool is subject to AT Protocol API rate limits:

- 3,000 requests per hour for authenticated users
- May require multiple API calls to analyze timeline and engagement

## Related Tools

- **[discover_trending](#discover-trending)** - Discover trending topics and posts
- **[find_similar_users](#find-similar-users)** - Find users with similar interests
- **[discover_communities](#discover-communities)** - Discover communities around topics
- **[search_posts](./search-posts.md)** - Search for specific posts
- **[get_timeline](./get-timeline.md)** - View your timeline
- **[analyze_engagement](#analyze-engagement)** - Analyze your engagement patterns

## See Also

- [Content Discovery Guide](../../guide/tools-resources.md#content-discovery)
- [Analytics Tools Guide](../../guide/tools-resources.md#analytics--insights)

