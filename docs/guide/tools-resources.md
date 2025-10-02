# Tools & Resources

A comprehensive guide to MCP tools and resources available in the AT Protocol MCP Server.

## Overview

The server provides three types of MCP primitives:

1. **Tools** (30+) - Executable functions for AT Protocol operations
2. **Resources** (3) - Data sources for context
3. **Prompts** (2) - Templates for common tasks

## Tool Categories

### 🔓 Public Tools (No Authentication Required)

These tools work without authentication, perfect for accessing public data:

#### Data Retrieval
- `search_posts` - Search for posts across the network
- `get_user_profile` - Get public profile information
- `get_user_profiles` - Get multiple profiles at once
- `get_followers` - Get follower lists
- `get_follows` - Get following lists
- `get_thread` - View post threads and conversations
- `get_custom_feed` - Access public custom feeds

### 🔐 Private Tools (Authentication Required)

These tools require authentication to perform write operations:

#### Social Operations
- `create_post` - Create new posts
- `reply_to_post` - Reply to existing posts
- `like_post` / `unlike_post` - Like and unlike posts
- `repost` / `unrepost` - Repost content
- `follow_user` / `unfollow_user` - Follow and unfollow users

#### Content Management
- `delete_post` - Delete your posts
- `update_profile` - Update your profile
- `upload_image` - Upload images
- `upload_video` - Upload videos
- `create_rich_text_post` - Create posts with rich formatting
- `generate_link_preview` - Generate link preview cards

#### List Management
- `create_list` - Create user lists
- `add_to_list` - Add users to lists
- `remove_from_list` - Remove users from lists
- `get_list` - Get list details

#### Timeline & Notifications
- `get_timeline` - Get personalized timeline
- `get_notifications` - Get notifications

#### Moderation
- `mute_user` / `unmute_user` - Mute and unmute users
- `block_user` / `unblock_user` - Block and unblock users
- `report_content` - Report inappropriate content
- `report_user` - Report users

#### OAuth Management
- `start_oauth_flow` - Initiate OAuth authentication
- `handle_oauth_callback` - Complete OAuth flow
- `refresh_oauth_tokens` - Refresh access tokens
- `revoke_oauth_tokens` - Revoke tokens and log out

#### Real-time Streaming
- `start_streaming` - Start real-time event stream
- `stop_streaming` - Stop event stream
- `get_streaming_status` - Check streaming status
- `get_recent_events` - Get recent streamed events

## Tool Usage Patterns

### Basic Tool Call

Through your LLM client:

```
"Search for posts about artificial intelligence"
```

The LLM will call `search_posts` with:
```json
{
  "q": "artificial intelligence",
  "limit": 25,
  "sort": "latest"
}
```

### Tool with Parameters

```
"Create a post saying 'Hello from AT Protocol!' in English"
```

The LLM will call `create_post` with:
```json
{
  "text": "Hello from AT Protocol!",
  "langs": ["en"]
}
```

### Chained Tool Calls

```
"Find the most popular post about AI and like it"
```

The LLM will:

1. Call `search_posts` with:
```json
{
  "q": "AI",
  "sort": "top",
  "limit": 1
}
```

2. Call `like_post` with:
```json
{
  "uri": "at://...",
  "cid": "bafyrei..."
}
```

## Tool Authentication Modes

Each tool has an authentication mode:

### PUBLIC Mode
- Works without authentication
- Access to public data only
- No rate limit on authentication
- Example: `search_posts`, `get_user_profile`

### PRIVATE Mode
- Requires authentication
- Can perform write operations
- Access to private data
- Example: `create_post`, `like_post`

### ENHANCED Mode
- Works without authentication
- Provides more data when authenticated
- Graceful degradation
- Example: `get_user_profile` (shows viewer relationship when authenticated)

## Resources

Resources provide context data that LLMs can read.

### atproto://timeline

Your personalized timeline feed.

**Content**:
```json
{
  "uri": "atproto://timeline",
  "timestamp": "2024-01-01T12:00:00Z",
  "posts": [
    {
      "uri": "at://...",
      "author": { "did": "...", "handle": "..." },
      "text": "Post content",
      "createdAt": "2024-01-01T11:00:00Z",
      "likeCount": 10,
      "repostCount": 5,
      "isLiked": false
    }
  ],
  "cursor": "..."
}
```

**Usage**:
```
"Summarize my timeline"
"What are people talking about in my feed?"
```

### atproto://profile

Your profile information and statistics.

**Content**:
```json
{
  "uri": "atproto://profile",
  "timestamp": "2024-01-01T12:00:00Z",
  "profile": {
    "did": "did:plc:...",
    "handle": "username.bsky.social",
    "displayName": "Your Name",
    "description": "Bio text",
    "followersCount": 100,
    "followsCount": 50,
    "postsCount": 200
  },
  "session": {
    "did": "did:plc:...",
    "handle": "username.bsky.social",
    "active": true
  }
}
```

**Usage**:
```
"Show me my profile stats"
"How many followers do I have?"
```

### atproto://notifications

Your recent notifications and mentions.

**Content**:
```json
{
  "uri": "atproto://notifications",
  "timestamp": "2024-01-01T12:00:00Z",
  "notifications": [
    {
      "uri": "at://...",
      "author": { "did": "...", "handle": "..." },
      "reason": "like",
      "isRead": false,
      "indexedAt": "2024-01-01T11:00:00Z"
    }
  ],
  "cursor": "...",
  "seenAt": "2024-01-01T10:00:00Z"
}
```

**Usage**:
```
"Check my notifications"
"Who liked my recent posts?"
```

## Prompts

Prompts help LLMs perform common tasks with better context.

### content_composition

Helps compose engaging social media posts.

**Arguments**:
- `topic` (optional) - Topic to write about
- `tone` (optional) - Desired tone (casual, professional, humorous, informative)
- `length` (optional) - Post length (short, medium, long)
- `include_hashtags` (optional) - Whether to include hashtags

**Usage**:
```
"Help me write a post about TypeScript"
```

The LLM will use the prompt to generate:
- Engaging content
- Appropriate tone
- Relevant hashtags
- Platform-appropriate length

### reply_template

Helps generate thoughtful replies to posts.

**Arguments**:
- `original_post` (optional) - The post being replied to
- `reply_type` (optional) - Type of reply (supportive, questioning, informative, humorous)
- `relationship` (optional) - Relationship to author (friend, colleague, stranger)

**Usage**:
```
"Help me reply to this post: [post content]"
```

The LLM will generate:
- Contextually appropriate reply
- Matching tone
- Engaging conversation starter

## Tool Discovery

### List Available Tools

Through your LLM client:
```
"What tools are available?"
"Show me all AT Protocol operations"
```

### Tool Documentation

```
"How do I create a post?"
"What parameters does search_posts accept?"
```

### Tool Capabilities

```
"Can I upload images?"
"What moderation tools are available?"
```

## Best Practices

### For Tool Usage

- ✅ Use descriptive natural language
- ✅ Provide context when needed
- ✅ Chain operations logically
- ✅ Handle errors gracefully
- ✅ Respect rate limits

### For Resource Access

- ✅ Access resources when context is needed
- ✅ Don't over-fetch data
- ✅ Cache resource data appropriately
- ✅ Refresh when data is stale

### For Prompt Usage

- ✅ Provide relevant arguments
- ✅ Customize for your use case
- ✅ Iterate on generated content
- ✅ Combine with tools for complete workflows

## Common Workflows

### Content Creation

```
1. Use content_composition prompt
   "Help me write a post about [topic]"
   
2. Review and refine
   "Make it more casual"
   
3. Create the post
   "Post this: [content]"
```

### Social Engagement

```
1. Check timeline
   "What's new in my feed?"
   
2. Find interesting content
   "Search for posts about [topic]"
   
3. Engage
   "Like and repost the top post"
```

### Community Management

```
1. Check notifications
   "Show my recent notifications"
   
2. Respond to mentions
   "Reply to [user] saying [message]"
   
3. Moderate if needed
   "Mute [user]" or "Report this content"
```

## Error Handling

Tools return structured errors:

```json
{
  "error": {
    "code": -32603,
    "message": "Authentication required",
    "data": {
      "tool": "create_post",
      "details": "This operation requires authentication"
    }
  }
}
```

Common error scenarios:
- **Authentication required** - Use authenticated mode
- **Rate limit exceeded** - Wait and retry
- **Invalid parameters** - Check parameter format
- **Not found** - Verify resource exists

## Next Steps

- **[API Reference](../api/tools.md)** - Detailed tool documentation
- **[Examples](../examples/basic-usage.md)** - See tools in action
- **[Error Handling](./error-handling.md)** - Handle errors properly

---

**Previous**: [AT Protocol](./at-protocol.md) ← | **Next**: [Error Handling](./error-handling.md) →

