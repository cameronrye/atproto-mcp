# Timeline Resource

MCP resource that exposes the authenticated user's timeline feed as JSON.

## Resource URI

```
atproto://timeline
```

## Authentication

**Required:** Yes

This resource requires authentication to access the user's personalized
timeline.

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
  "timestamp": "2026-01-15T10:30:00.000Z",
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
      "text": "Just deployed a new feature!",
      "createdAt": "2026-01-15T10:25:00.000Z",
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
      "createdAt": "2026-01-15T10:20:00.000Z",
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

Each read returns a fresh snapshot, so re-read the resource when you need newer
posts. The interval below is a suggestion for a client application — the server
does not poll on your behalf or push updates.

```javascript
// Re-read the timeline periodically (client-side choice, not server behavior)
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

- Display the user's personalized timeline and engagement metrics
- Monitor the timeline for keywords, mentions, or replies
- Drive automation such as auto-liking or replying to relevant posts
- Analyze posting patterns and content types

## Best Practices

These are suggestions for client applications; none are enforced by this server.

- Treat each read as a point-in-time snapshot and re-read when you need newer
  data
- Store the `cursor` if you need to page back through older posts
- Parse the JSON defensively and handle missing optional fields
- Handle deleted posts gracefully, since they may appear briefly

## Limitations

- Data is a snapshot at fetch time, not a real-time stream; re-read for updates
- Each read returns up to 50 posts (hardcoded server-side); use the `cursor` to
  fetch more
- Cursors are forward-only and may expire over time
- Content is the algorithm-filtered home feed and may include recommended posts

## Related Resources

- **[Profile Resource](./profile.md)** - User profile information
- **[Notifications Resource](./notifications.md)** - User notifications

## Related Tools

- **[get_timeline](../tools/get-timeline.md)** - Get timeline with more control

## See Also

- [MCP Protocol Guide](../../guide/mcp-protocol.md)
- [Resource Access Patterns](../../guide/tools-resources.md#resources)
