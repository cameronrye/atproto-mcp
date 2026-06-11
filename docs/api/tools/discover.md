# discover

Surface content from your own home timeline. Replaces the former
`discover_trending` and `recommend_content` tools — select which to surface with
the `mode` parameter. For finding accounts similar to a given user use
[find_similar_users](./find-similar-users.md); for topic-based communities use
[discover_communities](./discover-communities.md).

## Authentication

**Required:** Yes (Private tool)

This tool is read-only and performs no writes. Both modes operate on the
authenticated user's home timeline.

## Parameters

### `mode` (required)

- **Type:** `string`
- **Values:** `"trending"` | `"recommended"`
- **Description:** What to surface from your timeline:
  - `"trending"` - trending topics/hashtags and notable posts (former
    `discover_trending`)
  - `"recommended"` - posts you're likely to engage with (former
    `recommend_content`)

### `limit` (optional)

- **Type:** `number`
- **Constraints:** 1-100
- **Description:** How many items to return (default per mode)

### `timeWindow` (optional)

- **Type:** `string`
- **Values:** `"1h"` | `"6h"` | `"12h"` | `"24h"` | `"7d"`
- **Default:** `"24h"`
- **Description:** Lookback window. Only used when `mode: "trending"`.

### `includeHashtags` (optional)

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Include trending hashtags. Only used when `mode: "trending"`.

### `includeTopics` (optional)

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Include trending topics/keywords. Only used when
  `mode: "trending"`.

### `includePosts` (optional)

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Include notable trending posts. Only used when
  `mode: "trending"`.

### `actor` (optional)

- **Type:** `string`
- **Description:** Optional account to tailor recommendations to. Only used when
  `mode: "recommended"`; defaults to the authenticated user.

### `topics` (optional)

- **Type:** `string[]`
- **Description:** Restrict recommendations to posts matching these topic
  keywords. Only used when `mode: "recommended"`.

### `minLikes` (optional)

- **Type:** `number`
- **Constraints:** >= 0
- **Default:** `5`
- **Description:** Minimum like count for a recommended post. Only used when
  `mode: "recommended"`.

### `maxAge` (optional)

- **Type:** `number`
- **Constraints:** >= 1
- **Default:** `24`
- **Description:** Maximum post age in hours for recommendations. Only used when
  `mode: "recommended"`.

### `excludeReposts` (optional)

- **Type:** `boolean`
- **Description:** Exclude reposts from recommendations. Only used when
  `mode: "recommended"`.

## Response

Tool results are returned as stringified JSON text. Every response includes
`success` and the `mode` that was run; the remaining shape varies by mode.

```typescript
{
  success: boolean;
  mode: 'trending' | 'recommended';
  // ...mode-specific insights
}
```

### `mode: "trending"`

```typescript
{
  success: boolean;
  mode: 'trending';
  timeWindow: string;
  trendingHashtags: Array<{ tag: string; count: number; recentPosts: number; growth: number }>;
  trendingTopics: Array<{ topic: string; keywords: string[]; postCount: number; engagementScore: number }>;
  trendingPosts: Array<{
    uri: string;
    cid: string;
    author: { did: string; handle: string; displayName?: string };
    text: string;
    createdAt: string;
    likeCount: number;
    repostCount: number;
    replyCount: number;
    trendingScore: number;
  }>;
  summary: {
    totalPostsAnalyzed: number;
    uniqueAuthors: number;
    timeRange: { start: string; end: string };
  };
}
```

### `mode: "recommended"`

```typescript
{
  success: boolean;
  mode: 'recommended';
  recommendations: Array<{
    uri: string;
    cid: string;
    author: { did: string; handle: string; displayName?: string; avatar?: string };
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

### Trending Topics in the Last 6 Hours

```json
{
  "mode": "trending",
  "timeWindow": "6h"
}
```

### Recommended Posts

```json
{
  "mode": "recommended",
  "limit": 20
}
```

## Notes

- Both modes sample the **caller's own home timeline** (roughly the most recent
  ~50-100 posts), not the network at large. Trending results reflect what is
  popular among the accounts you follow.
- `timeWindow`, `includeHashtags`, `includeTopics`, and `includePosts` only
  apply to `mode: "trending"`; `actor`, `topics`, `minLikes`, `maxAge`, and
  `excludeReposts` only apply to `mode: "recommended"`.

## Error Handling

### Common Errors

#### Authentication Required

```json
{
  "error": "Authentication required",
  "code": "AUTHENTICATION_FAILED"
}
```

## Related Tools

- **[find_similar_users](./find-similar-users.md)** - Find accounts similar to a
  given user
- **[discover_communities](./discover-communities.md)** - Discover communities
  around topics
- **[get_timeline](./get-timeline.md)** - Retrieve your raw home timeline

## See Also

- [Tools & Resources Guide](../../guide/tools-resources.md)
