# analyze_network

Analyze a user's social network including follower/following ratios, engagement
patterns, mutual connections, and network quality metrics.

## Authentication

**Required** - This tool requires authentication to analyze network data.

## Parameters

| Parameter          | Type      | Required | Default              | Description                                                                             |
| ------------------ | --------- | -------- | -------------------- | --------------------------------------------------------------------------------------- |
| `actor`            | `string`  | No       | (authenticated user) | User DID or handle to analyze. Defaults to authenticated user if not specified.         |
| `includeFollowers` | `boolean` | No       | `true`               | Whether to analyze follower data.                                                       |
| `includeFollows`   | `boolean` | No       | `true`               | Whether to analyze following data.                                                      |
| `maxSampleSize`    | `number`  | No       | `50`                 | Maximum number of followers/follows to sample for analysis. Must be between 10 and 100. |

## Response

Tool results are returned as stringified JSON text content. The shape below is
illustrative:

```typescript
{
  success: boolean;
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
    topFollowers?: Array<{
      did: string;
      handle: string;
      displayName?: string;
      followersCount: number;
    }>;
    topFollows?: Array<{
      did: string;
      handle: string;
      displayName?: string;
      followersCount: number;
    }>;
  };
  insights: string[];
}
```

## Examples

### Analyze Your Own Network

```json
{
  "includeFollowers": true,
  "includeFollows": true,
  "maxSampleSize": 50
}
```

### Analyze Another User's Network

```json
{
  "actor": "influencer.bsky.social",
  "maxSampleSize": 100
}
```

### Quick Network Overview (Followers Only)

```json
{
  "includeFollowers": true,
  "includeFollows": false,
  "maxSampleSize": 25
}
```

## Error Handling

Common errors:

- **`AuthenticationRequired`**: Must be authenticated to use this tool
- **`InvalidRequest`**: Invalid actor or parameters
- **`ActorNotFound`**: Specified user does not exist
- **`RateLimitExceeded`**: Too many requests in a short period

## How Sampling Works

`followersCount`, `followsCount`, and `postsCount` come directly from the
actor's profile. The `topFollowers` and `topFollows` lists are derived by
sampling up to `maxSampleSize` followers/follows, then hydrating the first 25 of
that sample through `getProfiles` to obtain real follower counts before ranking.
The top 10 by follower count are returned. `mutualConnectionsCount` is the
overlap between the sampled `topFollowers` and `topFollows` (it is not a full
mutual-connection count for the whole network).

## Network Types

- **Broadcaster**: More followers than following - content reaches many people
- **Connector**: More following than followers - actively building connections
- **Balanced**: Similar followers and following - healthy two-way engagement
- **New User**: Few followers and following - just starting out

## Engagement Quality

This is a heuristic derived from the **average follower count of the sampled top
followers** (after `getProfiles` hydration), not from any direct engagement
measurement:

- **High**: Sampled top followers average more than 1,000 followers each.
- **Medium**: Default when no clear signal (or no follower sample available).
- **Low**: Sampled top followers average fewer than 100 followers each.

## Rate Limiting

Each tool is rate limited to 100 requests per minute per tool by this server.
Underlying AT Protocol / Bluesky API limits also apply; a larger `maxSampleSize`
issues additional upstream calls (`getFollowers`/`getFollows` plus a
`getProfiles` hydration call).

## Related Tools

- **[analyze_engagement](./analyze-engagement.md)** - Analyze engagement
  patterns across posts
- **[suggest_content_strategy](./suggest-content-strategy.md)** - Get content
  strategy recommendations
- **[find_influential_users](./find-influential-users.md)** - Find influential
  users in a topic area
- **[get_followers](./get-followers.md)** - Get detailed follower list
- **[get_follows](./get-follows.md)** - Get detailed following list
- **[get_user_summary](./get-user-summary.md)** - Get complete user profile with
  stats

## See Also

- [Analytics Tools Guide](../../guide/tools-resources.md#analytics--insights)
- [Social Operations Guide](../../guide/tools-resources.md#social-operations)
