# find_similar_users

Find users similar to a given user based on **shared follow-graph connections**:
accounts that are followed by the same people the base user follows, and
accounts that follow the same people. Ranking also factors in
follower/following-ratio similarity.

::: warning Graph-only

This tool analyzes the **follow graph only**. It does **not** read or compare
post content, so there is no analysis of similar topics, hashtags, or posting
style. Two accounts are "similar" here because of who follows/is-followed-by
whom, not because of what they post.

:::

## Authentication

**Enhanced** - This tool works without authentication but returns richer results
when authenticated.

## Parameters

| Parameter          | Type      | Required | Default | Description                                                                                                     |
| ------------------ | --------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `actor`            | `string`  | Yes      | -       | User DID or handle to find similar users for.                                                                   |
| `maxResults`       | `number`  | No       | `20`    | Maximum number of similar users to return. Must be between 1 and 50.                                            |
| `minFollowerCount` | `number`  | No       | `0`     | Minimum follower count for similar users (applied after candidate profiles are hydrated). Must be 0 or greater. |
| `includeMetrics`   | `boolean` | No       | `true`  | Whether to include detailed similarity metrics.                                                                 |

## How It Works

1. Loads the base user's profile, plus a sample of their followers, follows, and
   recent posts.
2. Walks the follow graph to gather candidates: accounts followed by the people
   the base user follows (2nd-degree follows), and accounts that follow the
   people the base user follows.
3. Hydrates candidate profiles via `getProfiles` so follower counts and ratios
   use real numbers.
4. Scores each candidate from graph-connection counts, follower/following-ratio
   similarity, and whether they are a mutual follower of the base user.

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

```typescript
{
  success: boolean;
  similarUsers: Array<{
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    avatar?: string;
    followersCount: number;
    followsCount: number;
    postsCount: number;
    similarityScore: number;
    similarityReasons: string[];
    metrics?: {
      mutualFollowers: number;          // 1 if the candidate also follows the base user, else 0
      followerRatioSimilarity: number;  // 0-1, closeness of follower/following ratios
    };
  }>;
  baseUser: {
    did: string;
    handle: string;
    displayName?: string;
  };
  insights: string[];
}
```

## Examples

### Find Similar Users

```json
{
  "actor": "alice.bsky.social",
  "maxResults": 20,
  "includeMetrics": true
}
```

### Filter by Account Size

```json
{
  "actor": "influencer.bsky.social",
  "maxResults": 30,
  "minFollowerCount": 1000
}
```

### Quick Check (No Metrics)

```json
{
  "actor": "did:plc:xyz123",
  "maxResults": 10,
  "includeMetrics": false
}
```

## Error Handling

Common errors:

- **`InvalidRequest`**: Invalid actor or parameters
- **`ActorNotFound`**: Specified user does not exist
- **`RateLimitExceeded`**: Too many requests in a short period

## Similarity Calculation

Similarity is computed from follow-graph signals only:

- **Graph connections**: How many of the base user's follows also follow the
  candidate, and how many of the candidate's followers are also followed by the
  base user.
- **Follower/following-ratio similarity**: How close the candidate's
  follower-to-following ratio is to the base user's (0-1).
- **Mutual follower**: Whether the candidate also follows the base user.

There is no content, topic, or hashtag comparison in the score.

## Similarity Reasons

The reasons attached to each result come from the graph signals above. Possible
values:

- `"Followed by X accounts you follow"`
- `"Follows X accounts you follow"`
- `"Mutual follower"`
- `"Similar follower/following ratio"`

## Rate Limiting

Calls are rate limited per tool: 100 requests per minute per tool. This tool
issues several `getFollowers`/`getFollows`/`getProfiles` calls per request, so
it consumes the per-minute budget faster than single-call tools.

## Related Tools

- **[find_influential_users](./find-influential-users.md)** - Find influential
  users in a topic area
- **[discover_communities](./discover-communities.md)** - Discover communities
  around topics
- **[get_user_profile](./get-user-profile.md)** - Get detailed user profile
- **[get_user_connections](./get-user-connections.md)** - Get a user's followers
  or follows
- **[analyze_account](./analyze-account.md)** - Analyze social network structure
  (`dimension: 'network'`)

## See Also

- [Content Discovery Guide](../../guide/tools-resources.md#content-discovery)
- [Social Operations Guide](../../guide/tools-resources.md#social-operations)
