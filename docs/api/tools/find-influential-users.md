# find_influential_users

Find influential users in a topic or network. Search by topic/query and filter by follower count. Returns users sorted by followers, engagement, or relevance.

## Authentication

**Enhanced** - This tool works without authentication but provides better results when authenticated.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `topic` | `string` | No* | - | Topic to search for influential users. Either `topic` or `searchQuery` must be provided. |
| `searchQuery` | `string` | No* | - | Custom search query. Either `topic` or `searchQuery` must be provided. |
| `minFollowers` | `number` | No | `100` | Minimum follower count to be considered influential. Must be 0 or greater. |
| `maxResults` | `number` | No | `20` | Maximum number of users to return. Must be between 1 and 50. |
| `sortBy` | `string` | No | `followers` | Sort order: `followers`, `engagement`, or `relevance`. |

*At least one of `topic` or `searchQuery` must be provided.

## Response

```typescript
{
  success: boolean;
  query: string;
  users: Array<{
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    followersCount: number;
    followsCount: number;
    postsCount: number;
    influenceScore: number;
    relevanceScore?: number;
  }>;
  insights: string[];
}
```

## Examples

### Find Influential Users in AI Topic

```json
{
  "topic": "artificial intelligence",
  "minFollowers": 500,
  "maxResults": 20,
  "sortBy": "followers"
}
```

### Find Relevant Influencers (Custom Query)

```json
{
  "searchQuery": "web development OR javascript OR typescript",
  "minFollowers": 1000,
  "sortBy": "relevance"
}
```

### Find Highly Engaged Influencers

```json
{
  "topic": "climate change",
  "minFollowers": 100,
  "maxResults": 30,
  "sortBy": "engagement"
}
```

## Error Handling

Common errors:

- **`InvalidRequest`**: Neither topic nor searchQuery provided, or invalid parameters
- **`RateLimitExceeded`**: Too many requests in a short period
- **`NoResultsFound`**: No users found matching the criteria

## Best Practices

1. **Be Specific**: Use specific topics or queries for better results
2. **Adjust Follower Threshold**: Lower `minFollowers` for niche topics, raise for mainstream topics
3. **Sort Appropriately**: Use `relevance` for topic-specific influencers, `followers` for reach
4. **Engagement Matters**: High follower count doesn't always mean high engagement
5. **Verify Relevance**: Review user descriptions to ensure they match your needs
6. **Build Relationships**: Engage authentically with influencers you discover
7. **Track Over Time**: Re-run searches periodically to find new influencers

## Sort Options

- **`followers`**: Sort by follower count (highest first) - best for maximum reach
- **`engagement`**: Sort by engagement rate - best for active, engaged audiences
- **`relevance`**: Sort by topic relevance - best for finding topic experts

## Influence Score

The influence score is calculated based on:
- Follower count (weighted heavily)
- Engagement rate (likes, reposts, replies per post)
- Post frequency and consistency
- Network position (followers of followers)

## Rate Limiting

This tool is subject to AT Protocol API rate limits:

- 3,000 requests per hour for authenticated users
- 300 requests per hour for unauthenticated users

## Related Tools

- **[find_similar_users](#find-similar-users)** - Find users similar to a given user
- **[discover_communities](#discover-communities)** - Discover communities around topics
- **[analyze_network](#analyze-network)** - Analyze your social network
- **[search_posts](./search-posts.md)** - Search for posts on specific topics
- **[get_user_profile](./get-user-profile.md)** - Get detailed user profile

## See Also

- [Analytics Tools Guide](../../guide/tools-resources.md#analytics--insights)
- [Content Discovery Guide](../../guide/tools-resources.md#content-discovery)

