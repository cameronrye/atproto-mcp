# Social Operations Examples

Practical examples for common social networking operations on AT Protocol.

These examples show how an LLM interacts with the AT Protocol MCP Server tools using JSON-formatted parameters.

## Creating Posts

### Simple Text Post

**User Request:**
```
"Create a post saying 'Hello from AT Protocol! 🚀'"
```

**Tool Call:** `create_post`

**Parameters (JSON):**
```json
{
  "text": "Hello from AT Protocol! 🚀"
}
```

**Response (JSON):**
```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz789",
  "cid": "bafyreiabc123...",
  "success": true,
  "message": "Post created successfully"
}
```

### Post with Multiple Languages

**User Request:**
```
"Create a bilingual post saying 'Hello world! Bonjour le monde!' in English and French"
```

**Tool Call:** `create_post`

**Parameters (JSON):**
```json
{
  "text": "Hello world! Bonjour le monde!",
  "langs": ["en", "fr"]
}
```

### Post with Images

**User Request:**
```
"Create a post with the text 'Check out this amazing photo!' and attach the sunset image"
```

**Tool Call:** `create_post`

**Parameters (JSON):**
```json
{
  "text": "Check out this amazing photo!",
  "embed": {
    "images": [
      {
        "alt": "A beautiful sunset over the ocean",
        "image": "<blob reference or base64 data>"
      }
    ]
  }
}
```

**Note:** Images are typically uploaded first using the `upload_image` tool, then referenced in the post.

### Post with Link Preview

**User Request:**
```
"Create a post about the AT Protocol overview article at https://atproto.com/guides/overview"
```

**Tool Call:** `create_post`

**Parameters (JSON):**
```json
{
  "text": "Interesting article about AT Protocol",
  "embed": {
    "external": {
      "uri": "https://atproto.com/guides/overview",
      "title": "AT Protocol Overview",
      "description": "Learn about the AT Protocol architecture and features"
    }
  }
}
```

## Threading and Replies

### Reply to a Post

**User Request:**
```
"Reply to the post at at://did:plc:abc123/app.bsky.feed.post/xyz789 saying 'Great point! I totally agree.'"
```

**Tool Call:** `reply_to_post`

**Parameters (JSON):**
```json
{
  "text": "Great point! I totally agree.",
  "root": "at://did:plc:abc123/app.bsky.feed.post/xyz789",
  "parent": "at://did:plc:abc123/app.bsky.feed.post/xyz789"
}
```

**Response (JSON):**
```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/reply456",
  "cid": "bafyreireply...",
  "success": true,
  "message": "Reply posted successfully"
}
```

### Reply to a Reply (Nested Thread)

**User Request:**
```
"Reply to the comment in the thread saying 'Thanks for the clarification!'"
```

**Tool Call:** `reply_to_post`

**Parameters (JSON):**
```json
{
  "text": "Thanks for the clarification!",
  "root": "at://did:plc:abc123/app.bsky.feed.post/thread-root",
  "parent": "at://did:plc:abc123/app.bsky.feed.post/previous-reply"
}
```

**Note:** `root` is the first post in the thread, `parent` is the immediate post being replied to.

### View Full Thread

**User Request:**
```
"Show me the full conversation thread for this post"
```

**Tool Call:** `get_thread`

**Parameters (JSON):**
```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz789",
  "depth": 6
}
```

**Response (JSON):**
```json
{
  "success": true,
  "thread": {
    "post": {
      "uri": "at://...",
      "record": {
        "text": "Root post content"
      }
    },
    "replies": [
      {
        "post": {
          "record": {
            "text": "First reply"
          }
        },
        "replies": []
      }
    ]
  }
}
```

## Engagement

### Like a Post

**User Request:**
```
"Like this post"
```

**Tool Call:** `like_post`

**Parameters (JSON):**
```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz789",
  "cid": "bafyreiabc123..."
}
```

**Response (JSON):**
```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.like/like456",
  "success": true,
  "message": "Post liked successfully"
}
```

**Note:** Store the returned `uri` to unlike the post later.

### Unlike a Post

**User Request:**
```
"Unlike the post I just liked"
```

**Tool Call:** `unlike_post`

**Parameters (JSON):**
```json
{
  "likeUri": "at://did:plc:abc123/app.bsky.feed.like/like456"
}
```

**Response (JSON):**
```json
{
  "success": true,
  "message": "Post unliked successfully"
}
```

### Repost Content

**User Request:**
```
"Repost this post"
```

**Tool Call:** `repost`

**Parameters (JSON):**
```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz789",
  "cid": "bafyreiabc123..."
}
```

**For Quote Post (repost with commentary):**

**User Request:**
```
"Repost this with the comment 'This is exactly what I was thinking! Great insights.'"
```

**Parameters (JSON):**
```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz789",
  "cid": "bafyreiabc123...",
  "text": "This is exactly what I was thinking! Great insights."
}
```

### Remove a Repost

**User Request:**
```
"Remove my repost"
```

**Tool Call:** `unrepost`

**Parameters (JSON):**
```json
{
  "repostUri": "at://did:plc:abc123/app.bsky.feed.repost/repost456"
}
```

## Following Users

### Follow a User

**User Request:**
```
"Follow @alice.bsky.social"
```

**Tool Call:** `follow_user`

**Parameters (JSON):**
```json
{
  "actor": "alice.bsky.social"
}
```

**Response (JSON):**
```json
{
  "uri": "at://did:plc:abc123/app.bsky.graph.follow/follow789",
  "success": true,
  "message": "Now following alice.bsky.social"
}
```

**Note:** Store the returned `uri` to unfollow the user later.

### Unfollow a User

**User Request:**
```
"Unfollow alice"
```

**Tool Call:** `unfollow_user`

**Parameters (JSON):**
```json
{
  "followUri": "at://did:plc:abc123/app.bsky.graph.follow/follow789"
}
```

**Response (JSON):**
```json
{
  "success": true,
  "message": "Unfollowed successfully"
}
```

### Get User Profile

**User Request:**
```
"Show me alice.bsky.social's profile"
```

**Tool Call:** `get_user_profile`

**Parameters (JSON):**
```json
{
  "actor": "alice.bsky.social"
}
```

**Response (JSON):**
```json
{
  "success": true,
  "profile": {
    "did": "did:plc:alice123",
    "handle": "alice.bsky.social",
    "displayName": "Alice Smith",
    "description": "Software engineer and coffee enthusiast",
    "followersCount": 1250,
    "followsCount": 340,
    "postsCount": 892,
    "viewer": {
      "following": "at://did:plc:abc123/app.bsky.graph.follow/follow789",
      "followedBy": "at://did:plc:alice123/app.bsky.graph.follow/follow456"
    }
  }
}
```

**Note:** The `viewer` field shows your relationship with this user (only when authenticated).

## Building a Social Bot

These examples show workflow sequences for automated social interactions.

### Auto-Reply Bot Workflow

**Concept:** Automatically reply to mentions

**Step 1: Get Notifications**

**Tool Call:** `get_notifications`

**Parameters (JSON):**
```json
{
  "limit": 20
}
```

**Step 2: Filter for Unread Mentions**

The LLM analyzes the response to identify notifications where:
- `reason` is `"mention"`
- `isRead` is `false`

**Step 3: Reply to Each Mention**

**Tool Call:** `reply_to_post` (for each mention)

**Parameters (JSON):**
```json
{
  "text": "Thanks for mentioning me! 🤖",
  "root": "at://did:plc:abc123/app.bsky.feed.post/mention-uri",
  "parent": "at://did:plc:abc123/app.bsky.feed.post/mention-uri"
}
```

**Implementation Note:** This workflow would be triggered periodically (e.g., every minute) by an external scheduler, not by the LLM itself.

### Engagement Bot Workflow

**Concept:** Automatically like posts about a specific topic

**Step 1: Search for Posts**

**Tool Call:** `search_posts`

**Parameters (JSON):**
```json
{
  "q": "atproto",
  "sort": "latest",
  "limit": 10
}
```

**Step 2: Like Each Post**

For each post in the results that hasn't been liked yet (check `viewer.like` field):

**Tool Call:** `like_post`

**Parameters (JSON):**
```json
{
  "uri": "at://did:plc:abc123/app.bsky.feed.post/xyz789",
  "cid": "bafyreiabc123..."
}
```

**Best Practice:** Wait 5 seconds between likes to avoid rate limits.

## Content Discovery

### Search for Posts

**User Request:**
```
"Search for top posts about machine learning in English"
```

**Tool Call:** `search_posts`

**Parameters (JSON):**
```json
{
  "q": "machine learning",
  "sort": "top",
  "lang": "en",
  "limit": 50
}
```

**Search by Author:**

**User Request:**
```
"Find alice's posts about TypeScript"
```

**Parameters (JSON):**
```json
{
  "q": "typescript",
  "author": "alice.bsky.social"
}
```

**Search with Date Range:**

**User Request:**
```
"Search for posts about atproto from January 2024"
```

**Parameters (JSON):**
```json
{
  "q": "atproto",
  "since": "2024-01-01T00:00:00Z",
  "until": "2024-01-31T23:59:59Z"
}
```

### Get Timeline

**User Request:**
```
"Show me my timeline"
```

**Tool Call:** `get_timeline`

**Parameters (JSON):**
```json
{
  "limit": 50
}
```

**Response (JSON):**
```json
{
  "success": true,
  "feed": [
    {
      "post": {
        "uri": "at://...",
        "author": {
          "displayName": "Alice",
          "handle": "alice.bsky.social"
        },
        "record": {
          "text": "Post content here"
        },
        "likeCount": 42,
        "repostCount": 15
      }
    }
  ],
  "cursor": "next-page-cursor"
}
```

**Paginate to Next Page:**

**Parameters (JSON):**
```json
{
  "limit": 50,
  "cursor": "next-page-cursor"
}
```

### Explore Custom Feeds

**User Request:**
```
"Show me posts from the tech feed"
```

**Tool Call:** `get_custom_feed`

**Parameters (JSON):**
```json
{
  "feed": "at://did:plc:abc123/app.bsky.feed.generator/tech-feed",
  "limit": 30
}
```

## Social Graph Analysis

### Get Followers

**User Request:**
```
"Show me alice.bsky.social's followers"
```

**Tool Call:** `get_followers`

**Parameters (JSON):**
```json
{
  "actor": "alice.bsky.social",
  "limit": 100
}
```

**Response (JSON):**
```json
{
  "success": true,
  "subject": {
    "did": "did:plc:alice123",
    "handle": "alice.bsky.social",
    "displayName": "Alice Smith"
  },
  "followers": [
    {
      "did": "did:plc:bob456",
      "handle": "bob.bsky.social",
      "displayName": "Bob Jones",
      "avatar": "https://..."
    }
  ],
  "cursor": "next-page-cursor"
}
```

**Analysis:** The LLM can analyze the response to count verified profiles (those with `displayName` and `avatar`).

### Get Following

**User Request:**
```
"Who does alice.bsky.social follow?"
```

**Tool Call:** `get_follows`

**Parameters (JSON):**
```json
{
  "actor": "alice.bsky.social",
  "limit": 100
}
```

**Response (JSON):**
```json
{
  "success": true,
  "subject": {
    "did": "did:plc:alice123",
    "handle": "alice.bsky.social"
  },
  "follows": [
    {
      "did": "did:plc:charlie789",
      "handle": "charlie.bsky.social",
      "displayName": "Charlie Brown"
    }
  ]
}
```

### Find Mutual Follows Workflow

**User Request:**
```
"Find mutual follows for alice.bsky.social"
```

**Step 1: Get Followers**

**Tool Call:** `get_followers`

**Parameters (JSON):**
```json
{
  "actor": "alice.bsky.social",
  "limit": 100
}
```

**Step 2: Get Following**

**Tool Call:** `get_follows`

**Parameters (JSON):**
```json
{
  "actor": "alice.bsky.social",
  "limit": 100
}
```

**Step 3: Analysis**

The LLM compares the two lists to find users who appear in both `followers` and `follows` arrays (matching by `did`).

## Best Practices

### Rate Limiting

**Concept:** Space out multiple operations to avoid rate limits

When performing multiple operations in sequence, wait between each call:

**Example: Creating Multiple Posts**

```
1. Create first post
2. Wait 1-2 seconds
3. Create second post
4. Wait 1-2 seconds
5. Create third post
```

**Tool Calls:**

```json
// First post
{
  "text": "Post 1"
}

// Wait 1-2 seconds, then second post
{
  "text": "Post 2"
}

// Wait 1-2 seconds, then third post
{
  "text": "Post 3"
}
```

**Rate Limit Guidelines:**
- **Posts:** Wait 1-2 seconds between posts
- **Likes:** Wait 0.5-1 seconds between likes
- **Follows:** Wait 1-2 seconds between follows
- **Searches:** Can be done more frequently, but monitor for rate limit errors

### Error Handling

**Handling Rate Limit Errors:**

When a tool returns a rate limit error:

**Error Response (JSON):**
```json
{
  "error": "Rate limit exceeded. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

**Recommended Action:**
1. Inform the user about the rate limit
2. Wait for the `retryAfter` duration (in seconds)
3. Retry the operation

**Example LLM Response:**
```
"I've hit the rate limit. I'll wait 60 seconds and try again."
```

**Handling Authentication Errors:**

**Error Response (JSON):**
```json
{
  "error": "Authentication required",
  "code": "AUTHENTICATION_FAILED"
}
```

**Recommended Action:**
Inform the user that authentication is required for this operation.

## See Also

- [Content Management Examples](./content-management.md)
- [Real-time Data Examples](./real-time-data.md)
- [Custom Integration Examples](./custom-integration.md)
- [API Reference](../api/)

