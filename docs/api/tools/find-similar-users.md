# find_similar_users

Find users similar to a given user based on their content, followers, and engagement patterns. Analyzes mutual followers, content topics, and engagement to identify similar accounts.

## Authentication

**Enhanced** - This tool works without authentication but provides better results when authenticated.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `actor` | `string` | Yes | - | User DID or handle to find similar users for. |
| `maxResults` | `number` | No | `20` | Maximum number of similar users to return. Must be between 1 and 50. |
| `minFollowerCount` | `number` | No | `0` | Minimum follower count for similar users. Must be 0 or greater. |
| `includeMetrics` | `boolean` | No | `true` | Whether to include detailed similarity metrics. |

## Response

```typescript
{
  success: boolean;
  similarUsers: Array<{
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    avatar?: string;
    followersCount: number;
    followsCount: number;
    postsCount: number;
    similarityScore: number;
    similarityReasons: string[];
    metrics?: {
      mutualFollowers: number;
      contentSimilarity: number;
      engagementSimilarity: number;
    };
  }>;
  baseUser: {
    did: string;
    handle: string;
    displayName?: string;
  };
  insights: string[];
}
```

## Examples

### Find Similar Users

```json
{
  "actor": "alice.bsky.social",
  "maxResults": 20,
  "includeMetrics": true
}
```

### Find Similar Influencers (High Follower Count)

```json
{
  "actor": "influencer.bsky.social",
  "maxResults": 30,
  "minFollowerCount": 1000
}
```

### Quick Similarity Check (No Metrics)

```json
{
  "actor": "did:plc:xyz123",
  "maxResults": 10,
  "includeMetrics": false
}
```

## Error Handling

Common errors:

- **`InvalidRequest`**: Invalid actor or parameters
- **`ActorNotFound`**: Specified user does not exist
- **`InsufficientData`**: Not enough data to find similar users
- **`RateLimitExceeded`**: Too many requests in a short period

## Best Practices

1. **Use for Discovery**: Find new accounts to follow based on your interests
2. **Competitor Analysis**: Analyze similar accounts in your niche
3. **Network Expansion**: Discover users with similar audiences
4. **Content Inspiration**: Study what similar accounts post
5. **Collaboration Opportunities**: Find potential collaboration partners
6. **Adjust Follower Threshold**: Use `minFollowerCount` to filter by account size
7. **Review Similarity Reasons**: Understand why accounts are considered similar

## Similarity Calculation

Similarity is based on:
- **Mutual Followers**: Number of shared followers
- **Content Similarity**: Similar topics, hashtags, and posting style
- **Engagement Similarity**: Similar engagement rates and patterns
- **Network Position**: Similar follower-to-following ratios

## Similarity Score

- **80-100**: Very similar - nearly identical audience and content
- **60-79**: Highly similar - strong overlap in audience or content
- **40-59**: Moderately similar - some shared characteristics
- **20-39**: Somewhat similar - few shared characteristics
- **0-19**: Minimally similar - little in common

## Similarity Reasons

Common reasons include:
- "High mutual follower overlap (X mutual followers)"
- "Similar content topics and hashtags"
- "Similar engagement patterns"
- "Similar follower-to-following ratio"
- "Active in the same communities"

## Rate Limiting

This tool is subject to AT Protocol API rate limits:

- 3,000 requests per hour for authenticated users
- 300 requests per hour for unauthenticated users
- May require multiple API calls to analyze followers

## Related Tools

- **[find_influential_users](#find-influential-users)** - Find influential users in a topic area
- **[discover_communities](#discover-communities)** - Discover communities around topics
- **[recommend_content](#recommend-content)** - Get personalized content recommendations
- **[get_user_profile](./get-user-profile.md)** - Get detailed user profile
- **[get_followers](./get-followers.md)** - Get user's followers
- **[analyze_network](#analyze-network)** - Analyze social network

## See Also

- [Content Discovery Guide](../../guide/tools-resources.md#content-discovery)
- [User Operations Guide](../../guide/tools-resources.md#user-operations)

