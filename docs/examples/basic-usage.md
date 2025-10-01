# Basic Usage Examples

Learn how to use the AT Protocol MCP Server with practical examples.

## Prerequisites

Before running these examples, ensure you have:

- AT Protocol MCP Server installed and running
- An MCP-compatible LLM client (e.g., Claude Desktop)
- (Optional) AT Protocol credentials for authenticated operations

## Getting Started

### Starting the Server

```bash
# Unauthenticated mode (public data only)
atproto-mcp

# Authenticated mode (full functionality)
export ATPROTO_IDENTIFIER="your-handle.bsky.social"
export ATPROTO_PASSWORD="your-app-password"
atproto-mcp
```

### Connecting Your LLM Client

Configure your LLM client to connect to the server. For Claude Desktop:

```json
{
  "mcpServers": {
    "atproto": {
      "command": "atproto-mcp",
      "env": {
        "ATPROTO_IDENTIFIER": "your-handle.bsky.social",
        "ATPROTO_PASSWORD": "your-app-password"
      }
    }
  }
}
```

## Public Data Access (No Authentication)

These examples work without authentication:

### Example 1: Search Posts

**Natural Language**:
```
"Search for posts about artificial intelligence from the last week"
```

**What Happens**:
The LLM calls the `search_posts` tool:
```typescript
{
  q: "artificial intelligence",
  limit: 25,
  sort: "latest",
  since: "2024-01-08T00:00:00Z"
}
```

**Result**:
```json
{
  "success": true,
  "posts": [
    {
      "uri": "at://did:plc:abc123.../app.bsky.feed.post/xyz789",
      "text": "Exciting developments in AI...",
      "author": {
        "handle": "user.bsky.social",
        "displayName": "User Name"
      },
      "likeCount": 42,
      "repostCount": 15,
      "createdAt": "2024-01-14T10:30:00Z"
    }
  ],
  "hasMore": true,
  "cursor": "..."
}
```

### Example 2: View User Profile

**Natural Language**:
```
"Show me the profile for @bsky.app"
```

**What Happens**:
The LLM calls the `get_user_profile` tool:
```typescript
{
  actor: "bsky.app"
}
```

**Result**:
```json
{
  "success": true,
  "profile": {
    "did": "did:plc:z72i7hdynmk6r22z27h6tvur",
    "handle": "bsky.app",
    "displayName": "Bluesky",
    "description": "The official Bluesky account",
    "followersCount": 50000,
    "followsCount": 100,
    "postsCount": 1000
  }
}
```

### Example 3: Browse a Thread

**Natural Language**:
```
"Show me the conversation thread for this post: at://..."
```

**What Happens**:
The LLM calls the `get_thread` tool:
```typescript
{
  uri: "at://did:plc:abc123.../app.bsky.feed.post/xyz789"
}
```

**Result**:
```json
{
  "success": true,
  "thread": {
    "post": { /* root post */ },
    "replies": [
      {
        "post": { /* reply 1 */ },
        "replies": [ /* nested replies */ ]
      }
    ]
  }
}
```

## Authenticated Operations

These examples require authentication:

### Example 4: Create a Post

**Natural Language**:
```
"Create a post saying 'Hello from AT Protocol MCP Server! 🚀'"
```

**What Happens**:
The LLM calls the `create_post` tool:
```typescript
{
  text: "Hello from AT Protocol MCP Server! 🚀",
  langs: ["en"]
}
```

**Result**:
```json
{
  "success": true,
  "uri": "at://did:plc:abc123.../app.bsky.feed.post/xyz789",
  "cid": "bafyreiabc123...",
  "message": "Post created successfully"
}
```

### Example 5: Like a Post

**Natural Language**:
```
"Like the most recent post from @bsky.app"
```

**What Happens**:
The LLM:
1. Calls `get_user_profile` to get the user's DID
2. Searches for their recent posts
3. Calls `like_post` with the post URI

```typescript
{
  uri: "at://did:plc:abc123.../app.bsky.feed.post/xyz789"
}
```

**Result**:
```json
{
  "success": true,
  "uri": "at://did:plc:abc123.../app.bsky.feed.like/abc456",
  "message": "Post liked successfully"
}
```

### Example 6: Follow a User

**Natural Language**:
```
"Follow @atproto.com"
```

**What Happens**:
The LLM calls the `follow_user` tool:
```typescript
{
  actor: "atproto.com"
}
```

**Result**:
```json
{
  "success": true,
  "uri": "at://did:plc:abc123.../app.bsky.graph.follow/xyz789",
  "message": "Now following atproto.com"
}
```

## Using Resources

Resources provide context data to the LLM:

### Example 7: Check Your Timeline

**Natural Language**:
```
"Summarize what's happening in my timeline"
```

**What Happens**:
The LLM reads the `atproto://timeline` resource and summarizes the content.

**Result**:
```
"Your timeline shows several interesting discussions:
1. AI developments - 5 posts about new AI models
2. Web3 topics - 3 posts about decentralization
3. Personal updates - Friends sharing their day
..."
```

### Example 8: Check Notifications

**Natural Language**:
```
"Do I have any new notifications?"
```

**What Happens**:
The LLM reads the `atproto://notifications` resource.

**Result**:
```
"You have 3 new notifications:
1. @user1 liked your post about TypeScript
2. @user2 followed you
3. @user3 replied to your post
..."
```

## Using Prompts

Prompts help the LLM perform common tasks:

### Example 9: Compose a Post

**Natural Language**:
```
"Help me write a post about TypeScript in a casual tone"
```

**What Happens**:
The LLM uses the `content_composition` prompt with:
```typescript
{
  topic: "TypeScript",
  tone: "casual",
  length: "medium",
  include_hashtags: true
}
```

**Result**:
```
"Just spent the day refactoring with TypeScript and wow, 
the type safety is a game changer! 🎯 No more runtime 
surprises. If you're still on the fence, give it a try - 
your future self will thank you. #TypeScript #WebDev #Coding"
```

### Example 10: Generate a Reply

**Natural Language**:
```
"Help me reply to this post: 'What's your favorite programming language?'"
```

**What Happens**:
The LLM uses the `reply_template` prompt with:
```typescript
{
  original_post: "What's your favorite programming language?",
  reply_type: "informative",
  relationship: "stranger"
}
```

**Result**:
```
"TypeScript has been my go-to lately! The type system catches 
so many bugs before runtime, and the developer experience with 
modern editors is fantastic. What drew you to ask about this?"
```

## Chaining Operations

Combine multiple operations for complex workflows:

### Example 11: Find and Engage

**Natural Language**:
```
"Find the top post about 'decentralization' and like it"
```

**What Happens**:
The LLM:
1. Calls `search_posts({ q: "decentralization", sort: "top", limit: 1 })`
2. Extracts the post URI from the result
3. Calls `like_post({ uri: "..." })`

**Result**:
```
"Found the top post about decentralization by @user.bsky.social 
with 150 likes. I've liked it for you!"
```

### Example 12: Create and Share

**Natural Language**:
```
"Create a post about my new project and share it"
```

**What Happens**:
The LLM:
1. Uses `content_composition` prompt to draft the post
2. Shows you the draft for approval
3. Calls `create_post` to publish it
4. Returns the post URI for sharing

## Error Handling

### Example 13: Handling Authentication Errors

**Natural Language**:
```
"Create a post" (without authentication)
```

**What Happens**:
The LLM receives an authentication error and explains:

**Result**:
```
"I can't create a post because authentication is required. 
To enable this feature, please set your AT Protocol credentials:

export ATPROTO_IDENTIFIER='your-handle.bsky.social'
export ATPROTO_PASSWORD='your-app-password'

Then restart the server."
```

### Example 14: Handling Rate Limits

**Natural Language**:
```
"Like all posts from @user" (many posts)
```

**What Happens**:
If rate limit is hit, the LLM explains:

**Result**:
```
"I've liked 50 posts but hit the rate limit. I'll need to 
wait a few minutes before continuing. Would you like me to 
continue after the rate limit resets?"
```

## Best Practices

### 1. Be Specific

❌ "Search for posts"
✅ "Search for posts about AI from the last week"

### 2. Provide Context

❌ "Like it"
✅ "Like the post at at://..."

### 3. Chain Logically

✅ "Find posts about X, then like the top one"

### 4. Handle Errors Gracefully

✅ Ask the LLM to explain errors and suggest solutions

### 5. Use Resources for Context

✅ "Based on my timeline, suggest what to post about"

## Next Steps

- **[Social Operations](./social-operations.md)** - Advanced social features
- **[Content Management](./content-management.md)** - Manage your content
- **[Real-time Data](./real-time-data.md)** - Streaming and live updates
- **[API Reference](../api/tools.md)** - Detailed tool documentation

---

**Previous**: [Deployment](../guide/deployment.md) ← | **Next**: [Social Operations](./social-operations.md) →

