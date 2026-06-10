# find_influential_users

Find influential users in a topic or network. Search by topic/query and filter
by follower count. Returns users sorted by followers, engagement, or relevance.

## Authentication

**Enhanced** - This tool works without authentication but provides better
results when authenticated.

## Parameters

| Parameter      | Type     | Required | Default     | Description                                                                              |
| -------------- | -------- | -------- | ----------- | ---------------------------------------------------------------------------------------- |
| `topic`        | `string` | No\*     | -           | Topic to search for influential users. Either `topic` or `searchQuery` must be provided. |
| `searchQuery`  | `string` | No\*     | -           | Custom search query. Either `topic` or `searchQuery` must be provided.                   |
| `minFollowers` | `number` | No       | `100`       | Minimum follower count to be considered influential. Must be 0 or greater.               |
| `maxResults`   | `number` | No       | `20`        | Maximum number of users to return. Must be between 1 and 50.                             |
| `sortBy`       | `string` | No       | `followers` | Sort order: `followers`, `engagement`, or `relevance`.                                   |

\*At least one of `topic` or `searchQuery` must be provided.

## Response

Tool results are returned as stringified JSON text content. The shape below is
illustrative:

```typescript
{
  success: boolean;
  query: string;
  users: Array<{
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    followersCount: number;
    followsCount: number;
    postsCount: number;
    influenceScore: number;
    relevanceScore?: number;
  }>;
  insights: string[];
}
```

## Examples

### Find Influential Users in AI Topic

```json
{
  "topic": "artificial intelligence",
  "minFollowers": 500,
  "maxResults": 20,
  "sortBy": "followers"
}
```

### Find Relevant Influencers (Custom Query)

```json
{
  "searchQuery": "web development OR javascript OR typescript",
  "minFollowers": 1000,
  "sortBy": "relevance"
}
```

### Find Highly Engaged Influencers

```json
{
  "topic": "climate change",
  "minFollowers": 100,
  "maxResults": 30,
  "sortBy": "engagement"
}
```

## Error Handling

Common errors:

- **`InvalidRequest`**: Neither topic nor searchQuery provided, or invalid
  parameters
- **`RateLimitExceeded`**: Too many requests in a short period
- **`NoResultsFound`**: No users found matching the criteria

## How It Works

The tool runs a `searchPosts` query for your topic, collects the unique post
authors, fetches each author's profile, and keeps those at or above
`minFollowers`. Results are therefore drawn from accounts that have recently
posted about the topic, not from a global directory.

## Sort Options

- **`followers`**: Sort by raw follower count (highest first) - best for maximum
  reach.
- **`engagement`**: Sort by the computed `influenceScore` (see below). Note:
  despite the name, this does **not** measure per-post engagement
  (likes/reposts/replies); it reuses the follower-based influence score.
- **`relevance`**: Sort by `relevanceScore`, which is the count of the user's
  posts that matched the search query - best for finding topic-focused accounts.

## Influence Score

The influence score is a derived, follower-weighted heuristic. It is computed
from three profile fields only:

- **Follower count** - the primary term.
- **Follower-to-following ratio** - capped at 10 (a quality signal).
- **Post count** - an activity signal, capped via `min(postsCount / 100, 10)`.

The score is roughly `followers * (1 + ratio/10) * (1 + activity/20)`, rounded
to an integer. It does **not** analyze per-post engagement
(likes/reposts/replies), posting consistency over time, or network position
("followers of followers").

## Rate Limiting

Each tool is rate limited to 100 requests per minute per tool by this server.
Underlying AT Protocol / Bluesky API limits also apply; this tool fetches a
profile per candidate author, so a higher `maxResults` issues more upstream
calls.

## Related Tools

- **[find_similar_users](./find-similar-users.md)** - Find users with
  overlapping follow graphs
- **[discover_communities](./discover-communities.md)** - Discover communities
  around topics
- **[analyze_account](./analyze-account.md)** - Analyze your social network
  (`dimension: 'network'`)
- **[search_posts](./search-posts.md)** - Search for posts on specific topics
- **[get_user_profile](./get-user-profile.md)** - Get detailed user profile

## See Also

- [Analytics Tools Guide](../../guide/tools-resources.md#analytics--insights)
- [Content Discovery Guide](../../guide/tools-resources.md#content-discovery)
