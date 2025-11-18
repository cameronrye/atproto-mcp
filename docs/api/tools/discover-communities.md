# discover_communities

Discover communities and groups of users around specific topics or interests. Identifies clusters of users who frequently interact around a topic.

## Authentication

**Enhanced** - This tool works without authentication but provides better results when authenticated.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `topic` | `string` | Yes | - | Topic to discover communities around. |
| `maxResults` | `number` | No | `20` | Maximum number of communities to return. Must be between 1 and 50. |
| `minCommunitySize` | `number` | No | `5` | Minimum number of core members in a community. Must be 2 or greater. |
| `includeMetrics` | `boolean` | No | `true` | Whether to include detailed community metrics. |

## Response

```typescript
{
  success: boolean;
  communities: Array<{
    name: string;
    topic: string;
    size: number;
    coreMembers: Array<{
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
      followersCount: number;
      postsCount: number;
      relevanceScore: number;
    }>;
    activityLevel: 'high' | 'medium' | 'low';
    description: string;
    metrics?: {
      avgFollowerCount: number;
      totalPosts: number;
      interconnectedness: number;
    };
  }>;
  insights: string[];
}
```

## Examples

### Discover Tech Communities

```json
{
  "topic": "web development",
  "maxResults": 20,
  "minCommunitySize": 5
}
```

### Find Large Active Communities

```json
{
  "topic": "climate change",
  "maxResults": 10,
  "minCommunitySize": 10,
  "includeMetrics": true
}
```

### Quick Community Discovery

```json
{
  "topic": "photography",
  "maxResults": 15,
  "includeMetrics": false
}
```

## Error Handling

Common errors:

- **`InvalidRequest`**: Invalid topic or parameters
- **`NoCommunitiesFound`**: No communities found for the specified topic
- **`RateLimitExceeded`**: Too many requests in a short period

## Best Practices

1. **Use Specific Topics**: More specific topics yield better-defined communities
2. **Adjust Community Size**: Lower `minCommunitySize` for niche topics, raise for mainstream topics
3. **Review Core Members**: Check core members to verify community relevance
4. **Join Conversations**: Engage with community members to become part of the community
5. **Track Activity Level**: Focus on high-activity communities for more engagement
6. **Monitor Interconnectedness**: Higher interconnectedness indicates stronger communities
7. **Explore Multiple Topics**: Discover communities across different interests

## Community Metrics

- **Size**: Total number of core members in the community
- **Activity Level**: Based on posting frequency and engagement
  - **High**: Very active, frequent posts and interactions
  - **Medium**: Moderately active, regular engagement
  - **Low**: Less active, occasional posts
- **Interconnectedness**: How connected community members are (0-100)
  - Higher values indicate members frequently interact with each other
- **Relevance Score**: How relevant each member is to the topic (0-100)

## Core Members

Core members are identified based on:
- Frequent posting about the topic
- High engagement with topic-related content
- Connections with other topic-focused users
- Influence within the topic area

## Rate Limiting

This tool is subject to AT Protocol API rate limits:

- 3,000 requests per hour for authenticated users
- 300 requests per hour for unauthenticated users
- May require multiple API calls to analyze communities

## Related Tools

- **[find_influential_users](#find-influential-users)** - Find influential users in a topic area
- **[find_similar_users](#find-similar-users)** - Find users similar to a given user
- **[discover_trending](#discover-trending)** - Discover trending topics
- **[recommend_content](#recommend-content)** - Get personalized content recommendations
- **[search_posts](./search-posts.md)** - Search for posts on specific topics

## See Also

- [Content Discovery Guide](../../guide/tools-resources.md#content-discovery)
- [User Operations Guide](../../guide/tools-resources.md#user-operations)

