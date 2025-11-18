# get_user_summary

Get complete user profile with stats and analysis. Combines profile data, recent posts, and engagement statistics in a single call.

## Authentication

**Required** - This tool requires authentication to retrieve comprehensive user data.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `actor` | `string` | Yes | - | User DID or handle to get summary for. |
| `includeRecentPosts` | `boolean` | No | `true` | Whether to include recent posts in the summary. |
| `postLimit` | `number` | No | `10` | Number of recent posts to include. Must be between 1 and 50. |
| `includeEngagementStats` | `boolean` | No | `true` | Whether to calculate engagement statistics. |

## Response

```typescript
{
  success: boolean;
  profile: {
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    avatar?: string;
    banner?: string;
    followersCount: number;
    followsCount: number;
    postsCount: number;
    createdAt?: string;
  };
  recentPosts?: Array<{
    uri: string;
    cid: string;
    text: string;
    likeCount: number;
    repostCount: number;
    replyCount: number;
    createdAt: string;
  }>;
  engagementStats?: {
    averageLikes: number;
    averageReposts: number;
    averageReplies: number;
    totalEngagement: number;
    engagementRate: number;
    mostEngagedPost?: {
      uri: string;
      text: string;
      totalEngagement: number;
    };
  };
  insights: string[];
}
```

## Examples

### Get Complete User Summary

```json
{
  "actor": "alice.bsky.social",
  "includeRecentPosts": true,
  "postLimit": 10,
  "includeEngagementStats": true
}
```

### Get Profile with Recent Posts Only

```json
{
  "actor": "influencer.bsky.social",
  "includeRecentPosts": true,
  "postLimit": 20,
  "includeEngagementStats": false
}
```

### Quick Profile Overview

```json
{
  "actor": "did:plc:xyz123",
  "includeRecentPosts": false,
  "includeEngagementStats": false
}
```

## Error Handling

Common errors:

- **`AuthenticationRequired`**: Must be authenticated to use this tool
- **`InvalidRequest`**: Invalid actor or parameters
- **`ActorNotFound`**: Specified user does not exist
- **`RateLimitExceeded`**: Too many requests in a short period

## Best Practices

1. **Use for Research**: Get comprehensive overview before engaging with a user
2. **Include Engagement Stats**: Set `includeEngagementStats: true` for complete picture
3. **Adjust Post Limit**: Use higher `postLimit` for more thorough analysis
4. **Review Insights**: Pay attention to the insights array for key observations
5. **Cache Results**: Store summaries to avoid repeated API calls
6. **Compare Users**: Generate summaries for multiple users to compare
7. **Track Changes**: Run periodically to monitor user growth and activity

## Insights

The insights array provides automated observations such as:
- Account age and activity level
- Follower-to-following ratio analysis
- Engagement quality assessment
- Posting frequency patterns
- Content performance highlights
- Network growth indicators

## Engagement Rate Calculation

Engagement rate is calculated as:
```
(Total Likes + Total Reposts + Total Replies) / (Followers Count × Posts Analyzed)
```

This provides a normalized metric for comparing engagement across accounts of different sizes.

## Use Cases

- **Influencer Research**: Evaluate potential collaboration partners
- **Competitor Analysis**: Monitor competitors' performance
- **User Discovery**: Learn about new accounts before following
- **Network Analysis**: Understand your followers and following
- **Content Strategy**: Study successful accounts in your niche

## Rate Limiting

This tool is subject to AT Protocol API rate limits:

- 3,000 requests per hour for authenticated users
- May require multiple API calls depending on parameters
- Higher `postLimit` values require more API calls

## Related Tools

- **[get_user_profile](./get-user-profile.md)** - Get basic user profile
- **[analyze_engagement](#analyze-engagement)** - Detailed engagement analysis
- **[analyze_network](#analyze-network)** - Network analysis
- **[get_timeline](./get-timeline.md)** - Get user's timeline
- **[find_similar_users](#find-similar-users)** - Find similar users

## See Also

- [Composite Operations Guide](../../guide/tools-resources.md#composite-operations)
- [User Operations Guide](../../guide/tools-resources.md#user-operations)
- [Analytics Tools Guide](../../guide/tools-resources.md#analytics--insights)

