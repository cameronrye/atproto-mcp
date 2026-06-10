# discover_communities

Discover clusters of users who interact around a topic. Searches recent posts
for the topic, groups the authors by reply interactions, and returns each
cluster that meets the minimum size.

## Authentication

**Enhanced** - This tool works without authentication but returns richer results
when authenticated.

## Parameters

| Parameter          | Type      | Required | Default | Description                                                                         |
| ------------------ | --------- | -------- | ------- | ----------------------------------------------------------------------------------- |
| `topic`            | `string`  | Yes      | -       | Topic to discover communities around (used as the post search query).               |
| `maxResults`       | `number`  | No       | `20`    | Maximum number of communities to return. Must be between 1 and 50.                  |
| `minCommunitySize` | `number`  | No       | `5`     | Minimum number of members a cluster must have to be returned. Must be 2 or greater. |
| `includeMetrics`   | `boolean` | No       | `true`  | Whether to include the `metrics` object on each community.                          |

## How It Works

1. Searches recent posts matching `topic` (`app.bsky.feed.searchPosts`, up to
   100 posts).
2. Groups posts by author, tracking each author's post count and engagement.
3. Reads reply parents to build interaction edges between authors.
4. Clusters authors that reply to one another, keeping clusters that meet
   `minCommunitySize`.

::: tip Derived labels

A community's `name` is a generated label (`"<topic> Community N"`), and its
`description` is a generated sentence built from real cluster data (member count
and the top contributors' handles). They are summaries of the discovered
cluster, not group names that exist on Bluesky.

:::

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

```typescript
{
  success: boolean;
  communities: Array<{
    name: string;     // generated label, e.g. "web development Community 1"
    topic: string;
    size: number;     // number of members in the cluster
    coreMembers: Array<{
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
      followersCount: number;  // from the search result's author profile
      postsCount: number;      // posts about the topic in this sample
      relevanceScore: number;  // engagement + postCount-weighted
    }>;
    activityLevel: 'high' | 'medium' | 'low';  // from avg posts per member
    description: string;  // generated summary sentence
    metrics?: {
      avgFollowerCount: number;
      totalPosts: number;
      interconnectedness: number;  // reply interactions / member count
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

### Larger Clusters Only

```json
{
  "topic": "climate change",
  "maxResults": 10,
  "minCommunitySize": 10,
  "includeMetrics": true
}
```

### Quick Discovery (No Metrics)

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
- **`RateLimitExceeded`**: Too many requests in a short period

When no clusters meet the criteria, `communities` is empty and `insights`
suggests trying a more popular topic or lowering `minCommunitySize`.

## Community Metrics

- **Size**: Number of members in the cluster.
- **Activity Level**: Derived from average posts per member within the sample.
  - **High**: average >= 3 posts per member
  - **Medium**: average between 1.5 and 3
  - **Low**: average < 1.5
- **Interconnectedness**: Reply interactions divided by member count. A larger
  value means members reply to one another more within the sample. (This is a
  ratio, not a 0-100 percentage.)
- **Relevance Score**: Per-member ranking from topic engagement plus post count;
  used to order `coreMembers`.

## Core Members

`coreMembers` lists the top members of a cluster (up to 10), ranked by relevance
score. Membership and engagement are derived from the sampled topic posts, so
they reflect this snapshot rather than long-term community activity.

## Rate Limiting

Calls are rate limited per tool: 100 requests per minute per tool. This tool
performs one post search per request.

## Related Tools

- **[find_influential_users](./find-influential-users.md)** - Find influential
  users in a topic area
- **[find_similar_users](./find-similar-users.md)** - Find users similar to a
  given user
- **[discover](./discover.md)** - Surface trending or recommended posts from your
  timeline (`mode: 'trending' | 'recommended'`)
- **[search_posts](./search-posts.md)** - Search for posts on specific topics

## See Also

- [Content Discovery Guide](../../guide/tools-resources.md#content-discovery)
- [Social Operations Guide](../../guide/tools-resources.md#social-operations)
