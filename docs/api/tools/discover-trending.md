# discover_trending

Surface frequently-used hashtags and notable posts from a sample of **your own
home timeline**. This is not a network-wide trending feed: it analyzes up to the
most recent ~100 posts in your timeline (`getTimeline`), then ranks hashtags,
keyword topics, and posts found within that sample.

## Authentication

**Required** - This tool reads your home timeline, so it requires
authentication.

## Parameters

| Parameter         | Type      | Required | Default | Description                                                                                                          |
| ----------------- | --------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| `limit`           | `number`  | No       | `50`    | Number of timeline posts to fetch and analyze. Must be between 10 and 100.                                           |
| `timeWindow`      | `string`  | No       | `24h`   | Posts older than this window (by `createdAt`) are excluded from the sample. Options: `1h`, `6h`, `12h`, `24h`, `7d`. |
| `includeHashtags` | `boolean` | No       | `true`  | Whether to include ranked hashtags in results.                                                                       |
| `includeTopics`   | `boolean` | No       | `true`  | Whether to include keyword topics in results.                                                                        |
| `includePosts`    | `boolean` | No       | `true`  | Whether to include ranked posts in results.                                                                          |

::: tip Scope

`timeWindow` filters the sample that was already fetched; it does not page
further back through your timeline. If the requested window contains few recent
posts, results will be sparse. `growth` is a recency ratio _within the sample_
(share of a hashtag's posts created in the last ~6 hours), not real growth
measured over time.

:::

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

```typescript
{
  success: boolean;
  timeWindow: string;
  trendingHashtags: Array<{
    tag: string;
    count: number; // occurrences within the sample
    recentPosts: number; // occurrences in posts <= 6h old
    growth: number; // recentPosts / count
  }>;
  trendingTopics: Array<{
    topic: string; // extracted keyword
    keywords: string[]; // sample snippets that mention it
    postCount: number;
    engagementScore: number; // summed likes + reposts + replies
  }>;
  trendingPosts: Array<{
    uri: string;
    cid: string;
    author: {
      did: string;
      handle: string;
      displayName?: string;
    };
    text: string;
    createdAt: string;
    likeCount: number;
    repostCount: number;
    replyCount: number;
    trendingScore: number; // engagement * (1 + recency boost)
  }>;
  summary: {
    totalPostsAnalyzed: number;
    uniqueAuthors: number;
    timeRange: {
      start: string;
      end: string;
    }
  }
}
```

## Examples

### Analyze Your Timeline (Last 24 Hours)

```json
{
  "limit": 50,
  "timeWindow": "24h"
}
```

### Hashtags Only

```json
{
  "limit": 100,
  "timeWindow": "12h",
  "includeHashtags": true,
  "includeTopics": false,
  "includePosts": false
}
```

### Quick Check (Last Hour)

```json
{
  "limit": 30,
  "timeWindow": "1h"
}
```

### Wider Window

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
- **`RateLimitExceeded`**: Too many requests in a short period

## Understanding the Metrics

- **Count**: Number of times the hashtag appeared in the sampled posts
- **Recent Posts**: Occurrences in posts created in the last ~6 hours
- **Growth**: `recentPosts / count` — the share of a hashtag's posts that are
  recent. This is a ratio within the sample, not growth measured over time.
- **Engagement Score**: Summed likes, reposts, and replies across posts
  mentioning a keyword topic
- **Trending Score**: Post engagement multiplied by a recency boost (newer posts
  score higher)

## Rate Limiting

Calls are rate limited per tool: 100 requests per minute per tool. The tool
fetches your timeline in a single `getTimeline` call.

## Related Tools

- **[search_posts](./search-posts.md)** - Search for posts on specific topics
- **[recommend_content](./recommend-content.md)** - Get personalized
  recommendations from your timeline
- **[find_influential_users](./find-influential-users.md)** - Find influential
  users in a topic area
- **[get_timeline](./get-timeline.md)** - View your timeline

## See Also

- [Content Discovery Guide](../../guide/tools-resources.md#content-discovery)
- [Analytics Tools Guide](../../guide/tools-resources.md#analytics--insights)
