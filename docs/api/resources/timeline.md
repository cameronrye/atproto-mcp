# Timeline Resource

MCP resource that exposes the authenticated user's timeline feed as JSON.

## Resource URI

```
atproto://timeline
```

## Authentication

**Required:** Yes

This resource requires authentication to access the user's personalized timeline.

## Resource Information

- **Name:** User Timeline
- **Description:** Current user's timeline feed with recent posts
- **MIME Type:** `application/json`

## Data Structure

```typescript
{
  uri: string;              // Resource URI
  timestamp: string;        // ISO 8601 timestamp when data was fetched
  posts: Array<{
    uri: string;            // Post URI
    cid: string;            // Post CID
    author: {
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
    };
    text: string;           // Post text content
    createdAt: string;      // Post creation timestamp
    replyCount: number;     // Number of replies
    repostCount: number;    // Number of reposts
    likeCount: number;      // Number of likes
    isLiked: boolean;       // Whether current user liked
    isReposted: boolean;    // Whether current user reposted
    embed?: any;            // Embedded content
    reply?: {               // Reply information
      root: { uri: string; cid: string };
      parent: { uri: string; cid: string };
    };
  }>;
  cursor?: string;          // Pagination cursor
}
```

## Example Response

```json
{
  "uri": "atproto://timeline",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "posts": [
    {
      "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz789",
      "cid": "bafyreiabc123...",
      "author": {
        "did": "did:plc:abc123",
        "handle": "alice.bsky.social",
        "displayName": "Alice Smith",
        "avatar": "https://cdn.bsky.app/img/avatar/..."
      },
      "text": "Just deployed a new feature! 🚀",
      "createdAt": "2024-01-15T10:25:00.000Z",
      "replyCount": 5,
      "repostCount": 12,
      "likeCount": 48,
      "isLiked": false,
      "isReposted": false
    },
    {
      "uri": "at://did:plc:def456/app.bsky.feed.post/abc123",
      "cid": "bafyreidef456...",
      "author": {
        "did": "did:plc:def456",
        "handle": "bob.bsky.social",
        "displayName": "Bob Johnson"
      },
      "text": "Great article on AT Protocol architecture",
      "createdAt": "2024-01-15T10:20:00.000Z",
      "replyCount": 2,
      "repostCount": 8,
      "likeCount": 25,
      "isLiked": true,
      "isReposted": false,
      "embed": {
        "$type": "app.bsky.embed.external",
        "external": {
          "uri": "https://example.com/article",
          "title": "Understanding AT Protocol",
          "description": "A deep dive into the architecture"
        }
      }
    }
  ],
  "cursor": "next_page_cursor"
}
```

## Usage in MCP

### Accessing the Resource

MCP clients can access this resource through the standard MCP resource protocol:

```javascript
// Request the timeline resource
const resource = await mcpClient.readResource('atproto://timeline');
const timelineData = JSON.parse(resource.text);

console.log(`Fetched ${timelineData.posts.length} posts`);
console.log(`Timestamp: ${timelineData.timestamp}`);
```

### Polling for Updates

```javascript
// Poll timeline every 30 seconds
setInterval(async () => {
  const resource = await mcpClient.readResource('atproto://timeline');
  const timeline = JSON.parse(resource.text);
  
  // Process new posts
  for (const post of timeline.posts) {
    if (isNewPost(post)) {
      await handleNewPost(post);
    }
  }
}, 30000);
```

## Use Cases

### Feed Display
- Display user's personalized timeline
- Show posts from followed users
- Render embedded content
- Display engagement metrics

### Content Monitoring
- Monitor timeline for keywords
- Track mentions and replies
- Detect trending topics
- Analyze engagement patterns

### Automation
- Auto-like relevant posts
- Auto-reply to mentions
- Repost interesting content
- Track conversation threads

### Analytics
- Measure timeline engagement
- Track posting patterns
- Analyze content types
- Monitor follower activity

## Best Practices

### Caching
- Cache timeline data for 30-60 seconds
- Invalidate cache on user actions
- Store cursor for pagination
- Implement stale-while-revalidate

### Performance
- Limit fetch frequency (max once per 10 seconds)
- Process posts asynchronously
- Implement virtual scrolling for UI
- Prefetch next page

### User Experience
- Show loading states
- Implement pull-to-refresh
- Display relative timestamps
- Handle deleted posts gracefully

### Data Handling
- Parse JSON safely
- Validate data structure
- Handle missing fields
- Log parsing errors

## Limitations

### Data Freshness
- Data is a snapshot at fetch time
- Not real-time (use streaming for real-time)
- May include deleted posts briefly
- Engagement counts may be slightly stale

### Pagination
- Limited to 50 posts per fetch
- Use cursor for additional posts
- Cursor may expire after time
- No backward pagination

### Content
- Only includes posts from followed users
- Algorithm-filtered content
- May include recommended posts
- Respects user's content preferences

## Related Resources

- **[Profile Resource](./profile.md)** - User profile information
- **[Notifications Resource](./notifications.md)** - User notifications

## Related Tools

- **[get_timeline](../tools/get-timeline.md)** - Get timeline with more control
- **[start_streaming](../tools/start-streaming.md)** - Real-time timeline updates

## See Also

- [MCP Protocol Guide](../../guide/mcp-protocol.md)
- [Resource Access Patterns](../../guide/tools-resources.md#resources)

