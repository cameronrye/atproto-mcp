# analyze_account

Analyze a single account along one dimension. Replaces the former
`analyze_engagement`, `analyze_network`, and `suggest_content_strategy` tools —
select which analysis to run with the `dimension` parameter. For
topic/search-based influencer discovery use
[find_influential_users](./find-influential-users.md) instead.

## Authentication

**Required:** Yes (Private tool)

This tool is read-only and performs no writes.

## Parameters

### `dimension` (required)

- **Type:** `string`
- **Values:** `"engagement"` | `"network"` | `"strategy"`
- **Description:** Which analysis to run:
  - `"engagement"` - recent-post performance (former `analyze_engagement`)
  - `"network"` - follower/following graph health (former `analyze_network`)
  - `"strategy"` - posting recommendations (former `suggest_content_strategy`)

### `actor` (optional)

- **Type:** `string`
- **Description:** Handle or DID to analyze. Defaults to the authenticated user
  when omitted.

### `limit` (optional)

- **Type:** `number`
- **Default:** `50`
- **Constraints:** 1-100
- **Description:** How many recent posts to sample for engagement analysis
  (`dimension: "engagement"`)

### `maxSampleSize` (optional)

- **Type:** `number`
- **Constraints:** 1-100
- **Description:** How many connections to sample for network analysis
  (`dimension: "network"`)

### `includeReplies` (optional)

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Engagement: include replies in the sampled author feed

### `includeFollowers` (optional)

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Network: sample the followers graph

### `includeFollows` (optional)

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Network: sample the follows graph

### `analyzePosts` (optional)

- **Type:** `number`
- **Default:** `50`
- **Constraints:** 10-100
- **Description:** Strategy: how many recent posts to analyze

### `includeTimingAnalysis` (optional)

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Strategy: include best-posting-time analysis

### `includeTopicAnalysis` (optional)

- **Type:** `boolean`
- **Default:** `true`
- **Description:** Strategy: include topic/keyword analysis

## Response

Tool results are returned as stringified JSON text. Every response includes
`success` and the `dimension` that was run; the remaining shape varies by
dimension.

```typescript
{
  success: boolean;
  dimension: 'engagement' | 'network' | 'strategy';
  // ...dimension-specific insights
}
```

### `dimension: "engagement"`

```typescript
{
  success: boolean;
  dimension: 'engagement';
  summary: {
    totalPosts: number;
    totalLikes: number;
    totalReposts: number;
    totalReplies: number;
    averageLikes: number;
    averageReposts: number;
    averageReplies: number;
    averageEngagementRate: number; // engagement per hour since posting
  };
  topPosts: Array<{ uri: string; cid: string; text: string; totalEngagement: number; /* ... */ }>;
  insights: {
    bestPerformingType: string;
    optimalTextLength: { min: number; max: number };
    mediaImpact: { withMedia: number; withoutMedia: number };
    hashtagImpact: { withHashtags: number; withoutHashtags: number };
    topHashtags: Array<{ tag: string; avgEngagement: number; count: number }>;
  };
  recommendations: string[];
}
```

### `dimension: "network"`

```typescript
{
  success: boolean;
  dimension: 'network';
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
    topFollowers?: Array<{ did: string; handle: string; followersCount: number }>;
    topFollows?: Array<{ did: string; handle: string; followersCount: number }>;
  };
  insights: string[];
}
```

### `dimension: "strategy"`

```typescript
{
  success: boolean;
  dimension: 'strategy';
  actor: string;
  analysis: {
    totalPostsAnalyzed: number;
    avgEngagementRate: number;
    bestPerformingPosts: Array<{ uri: string; text: string; engagement: number; createdAt: string }>;
    worstPerformingPosts: Array<{ uri: string; text: string; engagement: number; createdAt: string }>;
  };
  recommendations: {
    bestPostingTimes?: string[];
    contentTypes?: Array<{ type: string; avgEngagement: number; recommendation: string }>;
    topics?: Array<{ topic: string; frequency: number; avgEngagement: number }>;
    optimizationTips: string[];
  };
}
```

## Examples

### Engagement Analysis (Authenticated User)

```json
{
  "dimension": "engagement",
  "limit": 50
}
```

### Network Health of Another Account

```json
{
  "dimension": "network",
  "actor": "alice.bsky.social"
}
```

### Content Strategy Recommendations

```json
{
  "dimension": "strategy",
  "analyzePosts": 50,
  "includeTimingAnalysis": true,
  "includeTopicAnalysis": true
}
```

## Notes

- **Engagement rate** is engagement per hour since posting (a time-velocity
  measure), **not** engagement relative to follower count.
- A single call may issue multiple AT Protocol requests (e.g. `getAuthorFeed`,
  `getProfile`, `getFollowers`, `getFollows`, `getProfiles`).

## Error Handling

### Common Errors

#### Authentication Required

```json
{
  "error": "Authentication required",
  "code": "AUTHENTICATION_FAILED"
}
```

#### No Actor Resolved

```json
{
  "error": "No actor specified and no authenticated session found",
  "code": "VALIDATION_ERROR"
}
```

## Related Tools

- **[find_influential_users](./find-influential-users.md)** - Topic/search-based
  influencer discovery
- **[get_user_summary](./get-user-summary.md)** - Profile plus recent posts and
  engagement stats
- **[discover](./discover.md)** - Surface trending or recommended timeline
  content

## See Also

- [Tools & Resources Guide](../../guide/tools-resources.md)
