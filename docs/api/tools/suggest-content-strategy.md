# suggest_content_strategy

Analyze past post performance and suggest content strategy including best
posting times, engaging content types, topic recommendations, and optimization
tips.

## Authentication

**Required** - This tool requires authentication to analyze post performance and
generate recommendations.

## Parameters

| Parameter               | Type      | Required | Default              | Description                                                                     |
| ----------------------- | --------- | -------- | -------------------- | ------------------------------------------------------------------------------- |
| `actor`                 | `string`  | No       | (authenticated user) | User DID or handle to analyze. Defaults to authenticated user if not specified. |
| `analyzePosts`          | `number`  | No       | `50`                 | Number of recent posts to analyze. Must be between 10 and 100.                  |
| `includeTimingAnalysis` | `boolean` | No       | `true`               | Whether to analyze best posting times.                                          |
| `includeTopicAnalysis`  | `boolean` | No       | `true`               | Whether to analyze topic performance.                                           |

## Response

Tool results are returned as stringified JSON text content. The shape below is
illustrative:

```typescript
{
  success: boolean;
  actor: string;
  analysis: {
    totalPostsAnalyzed: number;
    // mean of per-post engagement velocity (see below)
    avgEngagementRate: number;
    bestPerformingPosts: Array<{
      uri: string;
      text: string;
      engagement: number;
      createdAt: string;
    }>;
    worstPerformingPosts: Array<{
      uri: string;
      text: string;
      engagement: number;
      createdAt: string;
    }>;
  };
  recommendations: {
    bestPostingTimes?: string[];
    contentTypes?: Array<{
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
- **`InsufficientData`**: Not enough posts to generate meaningful
  recommendations
- **`RateLimitExceeded`**: Too many requests in a short period

## Understanding Strategy Recommendations

Per-post engagement is computed as a weighted sum,
`likes + (replies x 2) + (reposts x 3)`. The **engagement rate** used throughout
is that engagement divided by the number of hours since the post was created (an
engagement **velocity**, not engagement relative to follower count).
`avgEngagementRate` is the mean of those per-post rates.

- **Best Posting Times**: Up to three hours (in local time of the post
  timestamps) with the highest average engagement velocity. Only present when
  `includeTimingAnalysis` is true.
- **Content Types**: Average engagement velocity per category (see below), each
  with a recommendation that flags whether the category is above or below the
  overall average.
- **Topics**: Keywords (4+ letters) and hashtags appearing in at least two
  posts, ranked by average engagement velocity. Only present when
  `includeTopicAnalysis` is true.
- **Optimization Tips**: Actionable notes derived from timing, average post
  length, and the share of posts that include media.

## Content Types Analyzed

Each post is bucketed into exactly one category:

- **withMedia**: Posts whose record carries an embed.
- **threads**: Non-media posts whose text contains an `@` mention (a heuristic
  for replies/conversations).
- **textOnly**: Remaining plain-text posts.
- **withLinks**: Tracked internally but only surfaced when posts fall into this
  bucket.

## Rate Limiting

Each tool is rate limited to 100 requests per minute per tool by this server.
Underlying AT Protocol / Bluesky API limits also apply; analyzing more posts via
`analyzePosts` may issue additional upstream calls.

## Related Tools

- **[analyze_engagement](./analyze-engagement.md)** - Analyze engagement
  patterns across posts
- **[analyze_network](./analyze-network.md)** - Analyze your social network and
  connections
- **[discover_trending](./discover-trending.md)** - Discover trending topics and
  posts
- **[find_influential_users](./find-influential-users.md)** - Find influential
  users to engage with
- **[get_timeline](./get-timeline.md)** - View your timeline posts

## See Also

- [Analytics Tools Guide](../../guide/tools-resources.md#analytics--insights)
- [Content Discovery Guide](../../guide/tools-resources.md#content-discovery)
