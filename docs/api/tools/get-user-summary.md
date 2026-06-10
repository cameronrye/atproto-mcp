# get_user_summary

Get a comprehensive user profile in a single call. Combines profile data, recent
posts, and aggregate engagement statistics.

## Authentication

**Enhanced** - This tool works without authentication for public data and
includes additional viewer context when authenticated.

## Parameters

| Parameter                | Type      | Required | Default | Description                                                  |
| ------------------------ | --------- | -------- | ------- | ------------------------------------------------------------ |
| `actor`                  | `string`  | Yes      | -       | User DID or handle to get summary for.                       |
| `includeRecentPosts`     | `boolean` | No       | `true`  | Whether to include recent posts in the summary.              |
| `postLimit`              | `number`  | No       | `10`    | Number of recent posts to include. Must be between 1 and 50. |
| `includeEngagementStats` | `boolean` | No       | `true`  | Whether to calculate engagement statistics.                  |

## Response

Tool results are returned as stringified JSON text. The shape below is
illustrative.

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
    indexedAt?: string;
    // viewer context (mute/block/following) is present when authenticated
    viewer?: { muted?: boolean; blocking?: string; following?: string; followedBy?: string };
  };
  recentPosts?: Array<Post>; // full transformed post objects
  engagementStats?: {
    totalPosts: number;
    totalLikes: number;
    totalReposts: number;
    totalReplies: number;
    averageLikesPerPost: number;
    averageRepostsPerPost: number;
    averageRepliesPerPost: number;
    mostLikedPost?: Post;
    mostRepostedPost?: Post;
  };
  summary: {
    handle: string;
    displayName?: string;
    followersCount: number;
    followsCount: number;
    postsCount: number;
    isAuthenticated: boolean;
  };
}
```

`engagementStats` is computed only when `includeEngagementStats` is true and the
author has at least one post (fetched with the `posts_no_replies` filter, capped
by `postLimit`). There is no follower-normalized "engagement rate" and no
automated `insights` array.

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

- **Invalid actor**: The `actor` is not a valid DID or handle
- **Actor not found**: The specified user does not exist
- Errors are returned as MCP error objects; the exact wording may vary.

## Engagement Statistics

When requested, the tool fetches up to `postLimit` recent posts (replies
excluded) and aggregates:

- `totalLikes`, `totalReposts`, `totalReplies` and the corresponding
  `averageLikesPerPost`, `averageRepostsPerPost`, `averageRepliesPerPost`
- `mostLikedPost` and `mostRepostedPost`

These are raw aggregates over the sampled posts. They are not normalized against
follower counts.

## Use Cases

- **Influencer Research**: Evaluate potential collaboration partners
- **Competitor Analysis**: Monitor competitors' performance
- **User Discovery**: Learn about new accounts before following
- **Network Analysis**: Understand your followers and following
- **Content Strategy**: Study successful accounts in your niche

## Rate Limiting

Subject to the server's per-tool limit of 100 requests per minute. A single call
issues a `getProfile` request plus one `getAuthorFeed` request when recent posts
or engagement stats are requested.

## Related Tools

- **[get_user_profile](./get-user-profile.md)** - Get basic user profile
- **[get_author_feed](./get-author-feed.md)** - List a user's posts
- **[analyze_account](./analyze-account.md)** - Detailed engagement, network, or
  strategy analysis (`dimension`)
- **[get_timeline](./get-timeline.md)** - Get user's timeline
- **[find_similar_users](./find-similar-users.md)** - Find similar users

## See Also

- [Composite Operations Guide](../../guide/tools-resources.md#composite-operations)
- [Data Retrieval Guide](../../guide/tools-resources.md#data-retrieval)
- [Analytics Tools Guide](../../guide/tools-resources.md#analytics--insights)
