# Basic Usage Examples

Learn how to use the AT Protocol MCP Server with practical examples.

## Understanding the Flow

**Important**: This MCP server is designed for **LLM consumption**, not direct human use. Here's how it works:

```
┌─────────────────────────────────────────────────────────────────┐
│                         The Complete Flow                        │
└─────────────────────────────────────────────────────────────────┘

1. YOU (User)
   ↓
   "Search for posts about AI from this week"
   ↓
2. LLM CLIENT (Claude Desktop, etc.)
   ↓
   Understands your request and decides to use the MCP server
   ↓
3. MCP PROTOCOL (JSON-RPC 2.0)
   ↓
   LLM calls: tools/call → search_posts({ q: "AI", ... })
   ↓
4. THIS SERVER (AT Protocol MCP Server)
   ↓
   Translates MCP call to AT Protocol API request
   ↓
5. AT PROTOCOL (Bluesky, etc.)
   ↓
   Returns search results
   ↓
6. BACK TO YOU
   ↓
   LLM presents results in natural language
```

**Key Points:**
- **You interact with your LLM client** (like Claude Desktop) in natural language
- **Your LLM client connects to this MCP server** via the MCP protocol
- **The MCP server translates** LLM requests into AT Protocol API calls
- **You never directly call** the MCP server's tools or write code

The examples below show what you say to your LLM client and what happens behind the scenes.

## Prerequisites

Before trying these examples, ensure you have:

- **An MCP-compatible LLM client** (e.g., Claude Desktop, or another MCP client)
- **The AT Protocol MCP Server configured** in your LLM client
- **(Optional) AT Protocol credentials** for authenticated operations (creating posts, etc.)

## Getting Started

### Configuring Your LLM Client

The MCP server is launched automatically by your LLM client. You just need to configure it.

**For Claude Desktop**, add this to your MCP configuration file:

```json
{
  "mcpServers": {
    "atproto": {
      "command": "npx",
      "args": ["atproto-mcp"],
      "env": {
        "ATPROTO_IDENTIFIER": "your-handle.bsky.social",
        "ATPROTO_PASSWORD": "your-app-password"
      }
    }
  }
}
```

**For unauthenticated mode** (public data only), omit the `env` section.

Once configured, restart your LLM client and you're ready to go!

## Public Data Access (No Authentication)

These examples show what you say to your LLM client and what happens behind the scenes. **No authentication required** for these:

### Example 1: Search Posts

**What You Say to Your LLM Client:**
```
"Search for posts about artificial intelligence from the last week"
```

**What Happens Behind the Scenes:**

Your LLM client understands your request and calls the `search_posts` tool via MCP:
```json
{
  "q": "artificial intelligence",
  "limit": 25,
  "sort": "latest",
  "since": "2024-01-08T00:00:00Z"
}
```

**What the MCP Server Returns:**
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

**What Your LLM Tells You:**
> "I found several posts about artificial intelligence from the last week. Here are some highlights: [summarizes the posts in natural language]"

### Example 2: View User Profile

**What You Say:**
```
"Show me the profile for @bsky.app"
```

**What Happens Behind the Scenes:**

Your LLM client calls the `get_user_profile` tool:
```json
{
  "actor": "bsky.app"
}
```

**What Your LLM Tells You:**
> "The @bsky.app account is the official Bluesky account with 50,000 followers. They've made 1,000 posts and follow 100 accounts. Their bio says: 'The official Bluesky account'"

### Example 3: Browse a Thread

**What You Say:**
```
"Show me the conversation thread for this post: at://..."
```

**What Happens Behind the Scenes:**

Your LLM client calls the `get_thread` tool:
```json
{
  "uri": "at://did:plc:abc123.../app.bsky.feed.post/xyz789"
}
```

**What Your LLM Tells You:**
> "This thread has 5 replies. The original post says... The top reply from @user mentions... [summarizes the conversation]"

## Authenticated Operations

These examples require authentication (configured in your LLM client's MCP settings):

### Example 4: Create a Post

**What You Say:**
```
"Create a post saying 'Hello from AT Protocol MCP Server! 🚀'"
```

**What Happens Behind the Scenes:**

Your LLM client calls the `create_post` tool via MCP:
```json
{
  "text": "Hello from AT Protocol MCP Server! 🚀",
  "langs": ["en"]
}
```

**What Your LLM Tells You:**
> "I've created your post on Bluesky! It's now live at [provides link or URI]"

### Example 5: Like a Post

**What You Say:**
```
"Like the most recent post from @bsky.app"
```

**What Happens Behind the Scenes:**

Your LLM client performs multiple steps:
1. Calls `get_user_profile` to get @bsky.app's information
2. Searches for their recent posts
3. Calls `like_post` with the post URI

```json
{
  "uri": "at://did:plc:abc123.../app.bsky.feed.post/xyz789"
}
```

**What Your LLM Tells You:**
> "I've liked the most recent post from @bsky.app. It was about [summarizes the post content]"

### Example 6: Follow a User

**What You Say:**
```
"Follow @atproto.com"
```

**What Happens Behind the Scenes:**

Your LLM client calls the `follow_user` tool:
```json
{
  "actor": "atproto.com"
}
```

**What Your LLM Tells You:**
> "You're now following @atproto.com!"

## Using Resources

MCP Resources provide context data that your LLM can read and understand:

### Example 7: Check Your Timeline

**What You Say:**
```
"Summarize what's happening in my timeline"
```

**What Happens Behind the Scenes:**

Your LLM client reads the `atproto://timeline` MCP resource, which fetches your personalized timeline from AT Protocol.

**What Your LLM Tells You:**
```
"Your timeline shows several interesting discussions:
1. AI developments - 5 posts about new AI models from @user1, @user2
2. Web3 topics - 3 posts about decentralization
3. Personal updates - Friends sharing their day
The most engaging post is from @user3 about [topic] with 150 likes..."
```

### Example 8: Check Notifications

**What You Say:**
```
"Do I have any new notifications?"
```

**What Happens Behind the Scenes:**

Your LLM client reads the `atproto://notifications` MCP resource.

**What Your LLM Tells You:**
```
"You have 3 new notifications:
1. @user1 liked your post about TypeScript
2. @user2 followed you
3. @user3 replied to your post saying 'Great insights!'
Would you like me to help you respond to any of these?"
```

## Using Prompts

MCP Prompts help your LLM perform common tasks with better context:

### Example 9: Compose a Post

**What You Say:**
```
"Help me write a post about TypeScript in a casual tone"
```

**What Happens Behind the Scenes:**

Your LLM client uses the `content_composition` MCP prompt with:
```json
{
  "topic": "TypeScript",
  "tone": "casual",
  "length": "medium",
  "include_hashtags": true
}
```

**What Your LLM Tells You:**
```
"Here's a casual post about TypeScript:

'Just spent the day refactoring with TypeScript and wow,
the type safety is a game changer! 🎯 No more runtime
surprises. If you're still on the fence, give it a try -
your future self will thank you. #TypeScript #WebDev #Coding'

Would you like me to post this for you?"
```

### Example 10: Generate a Reply

**What You Say:**
```
"Help me reply to this post: 'What's your favorite programming language?'"
```

**What Happens Behind the Scenes:**

Your LLM client uses the `reply_template` MCP prompt with:
```json
{
  "original_post": "What's your favorite programming language?",
  "reply_type": "informative",
  "relationship": "stranger"
}
```

**What Your LLM Tells You:**
```
"Here's a thoughtful reply:

'TypeScript has been my go-to lately! The type system catches
so many bugs before runtime, and the developer experience with
modern editors is fantastic. What drew you to ask about this?'

Would you like me to post this reply?"
```

## Chaining Operations

Your LLM can combine multiple MCP tool calls for complex workflows:

### Example 11: Find and Engage

**What You Say:**
```
"Find the top post about 'decentralization' and like it"
```

**What Happens Behind the Scenes:**

Your LLM client performs multiple steps:
1. Calls `search_posts({ q: "decentralization", sort: "top", limit: 1 })`
2. Extracts the post URI from the result
3. Calls `like_post({ uri: "..." })`

**What Your LLM Tells You:**
```
"I found the top post about decentralization by @user.bsky.social
with 150 likes. It discusses [summarizes content]. I've liked it for you!"
```

### Example 12: Create and Share

**What You Say:**
```
"Create a post about my new project and share it"
```

**What Happens Behind the Scenes:**

Your LLM client:
1. Uses `content_composition` prompt to draft the post
2. Shows you the draft for approval
3. Calls `create_post` to publish it
4. Returns the post URI for sharing

**What Your LLM Tells You:**
```
"I've drafted this post about your project:

'Excited to share my new project! [details]...'

Should I post this? I can also help you share it with specific users."
```

## Error Handling

### Example 13: Handling Authentication Errors

**What You Say:**
```
"Create a post" (without authentication configured)
```

**What Happens:**

The MCP server returns an authentication error, and your LLM explains:

**What Your LLM Tells You:**
```
"I can't create a post because authentication is required.
To enable this feature, you'll need to add your AT Protocol
credentials to my MCP configuration. Would you like help
setting that up?"
```

### Example 14: Handling Rate Limits

**What You Say:**
```
"Like all posts from @user" (many posts)
```

**What Happens:**

If the rate limit is hit, your LLM explains:

**What Your LLM Tells You:**
```
"I've liked 50 posts from @user, but I've hit the AT Protocol
rate limit. I'll need to wait about 15 minutes before I can
continue. Would you like me to:
1. Continue after the rate limit resets
2. Stop here
3. Try a different approach?"
```

## Best Practices

### 1. Be Specific with Your Requests

When talking to your LLM client:

❌ "Search for posts"
✅ "Search for posts about AI from the last week"

The more specific you are, the better your LLM can use the MCP tools.

### 2. Provide Context

❌ "Like it"
✅ "Like the post at at://..." or "Like the post we just found"

### 3. Use Natural Language Chains

✅ "Find posts about decentralization, then like the top one"
✅ "Search for @user's recent posts and summarize them"

Your LLM will chain multiple MCP tool calls automatically.

### 4. Let Your LLM Handle Errors

Your LLM client will receive error messages from the MCP server and explain them in natural language. You don't need to understand MCP protocol errors.

### 5. Leverage Resources for Context

✅ "Based on my timeline, suggest what to post about"
✅ "Summarize my notifications and draft replies"

Your LLM can read MCP resources to provide context-aware assistance.

## Next Steps

- **[Social Operations](./social-operations.md)** - Advanced social features
- **[Content Management](./content-management.md)** - Manage your content
- **[Real-time Data](./real-time-data.md)** - Streaming and live updates
- **[API Reference](../api/tools.md)** - Detailed tool documentation

---

**Previous**: [Deployment](../guide/deployment.md) ← | **Next**: [Social Operations](./social-operations.md) →

