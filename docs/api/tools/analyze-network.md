# analyze_network

Analyze a user's social network including follower/following ratios, engagement patterns, mutual connections, and network quality metrics.

## Authentication

**Required** - This tool requires authentication to analyze network data.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `actor` | `string` | No | (authenticated user) | User DID or handle to analyze. Defaults to authenticated user if not specified. |
| `includeFollowers` | `boolean` | No | `true` | Whether to analyze follower data. |
| `includeFollows` | `boolean` | No | `true` | Whether to analyze following data. |
| `maxSampleSize` | `number` | No | `50` | Maximum number of followers/follows to sample for analysis. Must be between 10 and 100. |

## Response

```typescript
{
  success: boolean;
  actor: string;
  network: {
    followersCount: number;
    followsCount: number;
    postsCount: number;
    followerToFollowingRatio: number;
  };
  analysis: {
    networkType: 'broadcaster' | 'connector' | 'balanced' | 'new_user';
    engagementQuality: 'high' | 'medium' | 'low';
    mutualConnectionsCount?: number;
    topFollowers?: Array<{
      did: string;
      handle: string;
      displayName?: string;
      followersCount: number;
    }>;
    topFollows?: Array<{
      did: string;
      handle: string;
      displayName?: string;
      followersCount: number;
    }>;
  };
  insights: string[];
}
```

## Examples

### Analyze Your Own Network

```json
{
  "includeFollowers": true,
  "includeFollows": true,
  "maxSampleSize": 50
}
```

### Analyze Another User's Network

```json
{
  "actor": "influencer.bsky.social",
  "maxSampleSize": 100
}
```

### Quick Network Overview (Followers Only)

```json
{
  "includeFollowers": true,
  "includeFollows": false,
  "maxSampleSize": 25
}
```

## Error Handling

Common errors:

- **`AuthenticationRequired`**: Must be authenticated to use this tool
- **`InvalidRequest`**: Invalid actor or parameters
- **`ActorNotFound`**: Specified user does not exist
- **`RateLimitExceeded`**: Too many requests in a short period

## Best Practices

1. **Regular Analysis**: Run monthly to track network growth and changes
2. **Adjust Sample Size**: Larger samples provide more accurate insights but take longer
3. **Study Top Followers**: Engage with your most influential followers
4. **Monitor Network Type**: Track changes in your network type over time
5. **Act on Insights**: Use recommendations to improve your network strategy
6. **Compare with Peers**: Analyze similar accounts to benchmark your network
7. **Balance Your Network**: Aim for a healthy follower-to-following ratio

## Network Types

- **Broadcaster**: More followers than following - content reaches many people
- **Connector**: More following than followers - actively building connections
- **Balanced**: Similar followers and following - healthy two-way engagement
- **New User**: Few followers and following - just starting out

## Engagement Quality

- **High**: Followers include influential accounts with high reach potential
- **Medium**: Mix of influential and regular accounts
- **Low**: Mostly accounts with low follower counts

## Rate Limiting

This tool is subject to AT Protocol API rate limits:

- 3,000 requests per hour for authenticated users
- May require multiple API calls depending on sample size

## Related Tools

- **[analyze_engagement](#analyze-engagement)** - Analyze engagement patterns across posts
- **[suggest_content_strategy](#suggest-content-strategy)** - Get content strategy recommendations
- **[find_influential_users](#find-influential-users)** - Find influential users in a topic area
- **[get_followers](./get-followers.md)** - Get detailed follower list
- **[get_follows](./get-follows.md)** - Get detailed following list
- **[get_user_summary](#get-user-summary)** - Get complete user profile with stats

## See Also

- [Analytics Tools Guide](../../guide/tools-resources.md#analytics--insights)
- [Network Growth Strategies](../../guide/tools-resources.md#user-operations)

