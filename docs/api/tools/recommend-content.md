# recommend_content

Recommend posts from your **home timeline** based on engagement and your
inferred preferences. Fetches your timeline, infers liked authors and hashtags
from posts you have already liked, then filters and ranks the remaining posts.

## Authentication

**Required** - This tool reads your timeline and your `viewer.like` state, so it
requires authentication.

## Parameters

| Parameter        | Type       | Required | Default | Description                                                                      |
| ---------------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------- |
| `maxResults`     | `number`   | No       | `20`    | Maximum number of recommended posts to return. Must be between 1 and 100.        |
| `minLikes`       | `number`   | No       | `5`     | Minimum like count for a post to be considered. Must be 0 or greater.            |
| `maxAge`         | `number`   | No       | `24`    | Maximum age of posts in hours. Must be between 1 and 168 (7 days).               |
| `topics`         | `string[]` | No       | -       | Optional topics to filter by. Matched against hashtags extracted from each post. |
| `excludeReposts` | `boolean`  | No       | `false` | Whether to exclude reposted content.                                             |

::: tip Scope

Candidates come only from your fetched timeline (`getTimeline`), not from a
network-wide search. "Topic" matching is hashtag-based: a post's hashtags are
compared against your liked hashtags and against the `topics` filter. Posts you
have already liked are excluded.

:::

## How It Works

1. Fetches your timeline.
2. Infers preferences from posts you have already liked in that timeline: their
   authors (liked authors) and their hashtags (liked topics). The AT Protocol
   has no "get my likes" endpoint, so this is limited to like state visible on
   the timeline.
3. Filters out already-liked posts, posts older than `maxAge`, posts below
   `minLikes`, reposts (when `excludeReposts` is set), and posts that fail the
   `topics` filter.
4. Scores the rest by engagement, author preference, hashtag overlap, recency,
   and reply activity.

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

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
    topics?: string[];  // hashtags extracted from the post
  }>;
  insights: string[];
}
```

## Examples

### Get Recommendations

```json
{
  "maxResults": 20,
  "minLikes": 5,
  "maxAge": 24
}
```

### Recent, High-Engagement Originals

```json
{
  "maxResults": 30,
  "minLikes": 20,
  "maxAge": 12,
  "excludeReposts": true
}
```

### Topic Filter

```json
{
  "maxResults": 25,
  "topics": ["technology", "AI", "programming"],
  "minLikes": 10
}
```

### Wider Time Window

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
- **`RateLimitExceeded`**: Too many requests in a short period

When nothing matches, `recommendations` is empty and `insights` suggests
lowering `minLikes`, increasing `maxAge`, or removing the topic filter.

## Recommendation Score

The score is a sum of:

- **Engagement**: Likes, replies (weighted higher), and reposts, capped at 100.
- **Author preference**: A bonus when the post is from an author you have
  already liked.
- **Topic overlap**: A bonus per matching hashtag between the post and your
  liked hashtags.
- **Recency**: A bonus for posts under ~6 hours old.
- **Active discussion**: A bonus when the post has several replies.

## Recommendation Reasons

The reasons attached to each result are drawn from the scoring signals above.
Possible values:

- `"High engagement (X likes)"`
- `"From an author you frequently engage with"`
- `"Matches X of your interests"`
- `"Recent post"`
- `"Active discussion"`
- `"Popular in your network"` (default when no other reason applies)

## Rate Limiting

Calls are rate limited per tool: 100 requests per minute per tool. This tool
fetches your timeline once per request.

## Related Tools

- **[discover_trending](./discover-trending.md)** - Surface hashtags and posts
  from your timeline
- **[find_similar_users](./find-similar-users.md)** - Find users with similar
  follow graphs
- **[discover_communities](./discover-communities.md)** - Discover communities
  around topics
- **[search_posts](./search-posts.md)** - Search for specific posts
- **[get_timeline](./get-timeline.md)** - View your timeline
- **[analyze_engagement](./analyze-engagement.md)** - Analyze your engagement
  patterns

## See Also

- [Content Discovery Guide](../../guide/tools-resources.md#content-discovery)
- [Analytics Tools Guide](../../guide/tools-resources.md#analytics--insights)
