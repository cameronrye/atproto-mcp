# analyze_engagement

Analyze engagement patterns across a user's posts. Provides insights into likes,
reposts, replies, and content performance.

## Authentication

**Required** - This tool requires authentication to analyze post engagement
data.

## Parameters

| Parameter        | Type      | Required | Default              | Description                                                                     |
| ---------------- | --------- | -------- | -------------------- | ------------------------------------------------------------------------------- |
| `actor`          | `string`  | No       | (authenticated user) | User DID or handle to analyze. Defaults to authenticated user if not specified. |
| `limit`          | `number`  | No       | `50`                 | Number of recent posts to analyze. Must be between 1 and 100.                   |
| `includeReplies` | `boolean` | No       | `true`               | Whether to include reply posts in the analysis.                                 |

## Response

Tool results are returned as stringified JSON text content. The shape below is
illustrative:

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
    totalEngagement: number;
    engagementRate: number;
    createdAt: string;
  }>;
  insights: {
    // 'replies' or 'original posts'
    bestPerformingType: string;
    optimalTextLength: { min: number; max: number };
    mediaImpact: { withMedia: number; withoutMedia: number };
    hashtagImpact: { withHashtags: number; withoutHashtags: number };
    topHashtags: Array<{ tag: string; avgEngagement: number; count: number }>;
  };
  recommendations: string[];
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

## Understanding Engagement Metrics

- **Engagement Rate**: Total engagement (likes + reposts + replies) divided by
  the number of hours since the post was created. This is an engagement
  **velocity** (engagement per hour), not engagement relative to follower count.
  The summary's `averageEngagementRate` is the mean of these per-post rates.
- **Best Performing Type**: Either `replies` or `original posts`, whichever has
  the higher average total engagement.
- **Optimal Text Length**: Character range covered by the top 20% of posts (by
  total engagement).
- **Media Impact**: Average total engagement for posts with vs. without media
  (images/video embeds).
- **Hashtag Impact**: Average total engagement for posts with vs. without
  hashtags.
- **Top Hashtags**: Up to five hashtags ranked by average engagement.

## Rate Limiting

Each tool is rate limited to 100 requests per minute per tool by this server.
Underlying AT Protocol / Bluesky API limits also apply; analyzing a large
`limit` may issue multiple upstream calls.

## Related Tools

- **[suggest_content_strategy](./suggest-content-strategy.md)** - Get content
  strategy recommendations based on engagement
- **[analyze_network](./analyze-network.md)** - Analyze your social network and
  connections
- **[get_user_summary](./get-user-summary.md)** - Get complete user profile with
  stats
- **[get_timeline](./get-timeline.md)** - View your timeline posts
- **[search_posts](./search-posts.md)** - Search for specific posts

## See Also

- [Analytics Tools Guide](../../guide/tools-resources.md#analytics--insights)
- [Content Discovery Guide](../../guide/tools-resources.md#content-discovery)
