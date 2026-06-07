# Tools & Resources

A comprehensive guide to MCP tools and resources available in the AT Protocol
MCP Server.

## Overview

The server provides three types of MCP primitives:

1. **Tools** (60) - Executable functions for AT Protocol operations
2. **Resources** (4) - Data sources for context
3. **Prompts** (2) - Templates for common tasks

## Tool Categories

### Public Tools (No Authentication Required)

These tools work in unauthenticated mode against public AT Protocol data:

#### Data Retrieval

- `get_user_profile` - Get public profile information (ENHANCED mode: provides
  additional viewer-specific data when authenticated)
- `get_followers` - Get a user's follower list (ENHANCED mode: works without
  authentication, richer viewer data when authenticated)
- `get_follows` - Get a user's following list (ENHANCED mode: works without
  authentication, richer viewer data when authenticated)

**Note:** Most other tools require authentication. `search_posts`, in
particular, requires authentication (the AT Protocol search API changed in 2025
to require auth). App passwords are the supported auth path — set
`ATPROTO_IDENTIFIER` and `ATPROTO_PASSWORD` (generate an app password in Bluesky
Settings). See [Authentication](./authentication.md).

#### OAuth Management

OAuth is **experimental** and the flow is currently a dead end (callback
exchange is not implemented). See [Experimental & Roadmap](./experimental.md).

- `start_oauth_flow` - Build a PKCE authorization URL (experimental — see below)
- `handle_oauth_callback` - **Not implemented** (always throws
  `OAUTH_NOT_IMPLEMENTED`)
- `refresh_oauth_tokens` - **Not implemented** (always throws
  `OAUTH_NOT_IMPLEMENTED`)
- `revoke_oauth_tokens` - **Not implemented** (always throws
  `OAUTH_NOT_IMPLEMENTED`)

::: warning Experimental

`start_oauth_flow` only builds a heuristic PKCE authorization URL (no
authorization-server metadata discovery or PAR). Because `handle_oauth_callback`
is not implemented, the OAuth flow cannot be completed — use app-password
authentication instead. See [Experimental & Roadmap](./experimental.md).

:::

### Private Tools (Authentication Required)

These tools require authentication to perform write operations:

#### Social Operations

- `create_post` - Create new posts
- `create_thread` - Create multi-post threads in one call
- `reply_to_post` - Reply to existing posts
- `like_post` / `unlike_post` - Like and unlike posts
- `repost` / `unrepost` - Repost content
- `follow_user` / `unfollow_user` - Follow and unfollow users

#### Data Retrieval

- `search_posts` - Search for posts across the network (requires authentication;
  the AT Protocol search API changed in 2025 to require auth)
- `get_timeline` - Get personalized timeline
- `get_notifications` - Get notifications
- `get_thread` - View post threads
- `get_custom_feed` - Access custom feeds

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

#### Moderation

- `mute_user` / `unmute_user` - Mute and unmute users
- `block_user` / `unblock_user` - Block and unblock users
- `report_content` - Report inappropriate content
- `report_user` - Report users
- `analyze_moderation_status` - Check moderation status of content

#### Real-time Streaming & Intelligence

::: danger Not implemented

The 6 streaming tools below are registered and visible to MCP clients but are
**not functional** — firehose decoding is gated off, so `start_streaming` opens
no connection (returns `status: 'not_implemented'`) and the event-buffer tools
always return an empty buffer. See [Experimental & Roadmap](./experimental.md).

:::

- `start_streaming` - **Not implemented** — returns `success: false`,
  `status: 'not_implemented'`; opens no firehose connection
- `stop_streaming` - **Not implemented** — no active stream to stop
- `get_streaming_status` - **Not implemented** — reports streaming as inactive
- `get_recent_events` - **Not implemented** — always returns an empty event
  buffer
- `monitor_keywords` - **Not implemented** — always returns an empty event
  buffer
- `track_users` - **Not implemented** — always returns an empty event buffer

#### Batch Operations

- `batch_follow` - Follow multiple users at once (up to 25)
- `batch_like` - Like multiple posts at once (up to 25)
- `batch_repost` - Repost multiple posts at once (up to 25)

#### Analytics & Insights

- `analyze_engagement` - Analyze engagement patterns across posts (engagement
  rate is engagement per hour since posting, a time-velocity measure)
- `analyze_network` - Analyze user's network and connections
- `suggest_content_strategy` - Get content strategy recommendations based on
  performance
- `find_influential_users` - Find influential users in a topic area

#### Content Discovery

- `discover_trending` - Surface trending topics by sampling the caller's own
  home timeline (~100 posts), not the whole network
- `find_similar_users` - Find similar users by shared follows/followers (graph
  overlap only; does not analyze content or topics)
- `recommend_content` - Get personalized content recommendations
- `discover_communities` - Discover communities around topics

#### Composite Operations

- `get_user_summary` - Get complete user profile with stats and analysis
- `get_post_context` - Get post with thread, author, and engagement data

#### Rich Media

- `generate_alt_text` - **Placeholder** — does not analyze image pixels; returns
  alt-text writing guidance / a template only (no vision model). See
  [Experimental & Roadmap](./experimental.md).
- `analyze_image` - Report an image blob's declared size and MIME type (does not
  decode pixels, so no dimensions or aspect ratio)
- `extract_media_from_post` - Extract media references from a post (passes
  through the embed-declared aspect ratio, which may be undefined)

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
- Example: `get_user_profile`, `analyze_image`

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

Resources provide context data that LLMs can read. The server provides 4
resources. Resource contents are returned as stringified JSON text; the shapes
below are illustrative.

### atproto://timeline

Your personalized timeline feed. **Requires authentication.**

**Content** (illustrative):

```json
{
  "uri": "atproto://timeline",
  "timestamp": "2026-06-06T12:00:00Z",
  "posts": [
    {
      "uri": "at://...",
      "author": { "did": "...", "handle": "..." },
      "text": "Post content",
      "createdAt": "2026-06-06T11:00:00Z",
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

Your profile information and statistics. **Requires authentication.**

**Content** (illustrative):

```json
{
  "uri": "atproto://profile",
  "timestamp": "2026-06-06T12:00:00Z",
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

Your recent notifications and mentions. **Requires authentication.**

**Content** (illustrative):

```json
{
  "uri": "atproto://notifications",
  "timestamp": "2026-06-06T12:00:00Z",
  "notifications": [
    {
      "uri": "at://...",
      "author": { "did": "...", "handle": "..." },
      "reason": "like",
      "isRead": false,
      "indexedAt": "2026-06-06T11:00:00Z"
    }
  ],
  "cursor": "...",
  "seenAt": "2026-06-06T10:00:00Z"
}
```

**Usage**:

```
"Check my notifications"
"Who liked my recent posts?"
```

### atproto://conversation-context

A scratchpad for conversation state. **Always available (no authentication
required).**

::: warning Placeholder

This resource is **registered and readable, but the server does not
auto-populate it** during tool calls. It exists as a placeholder/scratchpad:
unless a client explicitly writes to it, every array is empty. Treat empty
arrays as "not tracked", not "nothing happened".

:::

The resource always returns the structure below. The `context` arrays
(`recentlyDiscussedPosts`, `activeThreads`, `mentionedUsers`, `searchHistory`,
`recentActions`) are present but empty by default, and the `summary` counts are
all `0`:

```json
{
  "uri": "atproto://conversation-context",
  "timestamp": "2026-06-06T12:00:00Z",
  "context": {
    "recentlyDiscussedPosts": [],
    "activeThreads": [],
    "mentionedUsers": [],
    "searchHistory": [],
    "recentActions": []
  },
  "summary": {
    "discussedPostsCount": 0,
    "activeThreadsCount": 0,
    "mentionedUsersCount": 0,
    "searchHistoryCount": 0,
    "recentActionsCount": 0
  }
}
```

Because the server never writes to this resource on your behalf, do not rely on
it to recall posts, threads, users, searches, or actions from earlier in a
conversation.

## Prompts

Prompts help LLMs perform common tasks with better context. The server provides
2 prompts. Both **require authentication** to be available.

### content_composition

Helps compose engaging social media posts.

**Arguments**:

- `topic` (required) - The main topic or subject for the post
- `tone` (optional) - Desired tone (casual, professional, humorous, informative)
- `length` (optional) - Post length (short, medium, long)
- `include_hashtags` (optional) - Whether to include relevant hashtags

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

- `original_post` (required) - The original post content to reply to
- `reply_type` (optional) - Type of reply (supportive, questioning, informative,
  humorous)
- `relationship` (optional) - Relationship to the original poster (friend,
  colleague, stranger)

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

- Use descriptive natural language
- Provide context when needed
- Chain operations logically
- Handle errors gracefully
- Respect rate limits (the server allows 100 requests per minute per tool)

### For Resource Access

- Access resources when context is needed
- Don't over-fetch data
- Cache resource data appropriately
- Refresh when data is stale

### For Prompt Usage

- Provide relevant arguments
- Customize for your use case
- Iterate on generated content
- Combine with tools for complete workflows

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

- **[API Reference](../api/index.md)** - Detailed tool documentation
- **[Examples](../examples/basic-usage.md)** - See tools in action
- **[Error Handling](./error-handling.md)** - Handle errors properly

---

**Previous**: [AT Protocol](./at-protocol.md) ← | **Next**:
[Error Handling](./error-handling.md) →
