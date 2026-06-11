# Tools & Resources

A comprehensive guide to MCP tools and resources available in the AT Protocol
MCP Server.

## Overview

The server provides three types of MCP primitives:

1. **Tools** (43) - Executable functions for AT Protocol operations
2. **Resources** (3) - Data sources for context
3. **Prompts** (2) - Templates for common tasks

## Tool Categories

### Public Tools (No Authentication Required)

These tools work in unauthenticated mode against public AT Protocol data. All
except `analyze_image` are ENHANCED-mode tools: they work without authentication
and provide richer viewer-specific data when authenticated.

#### Data Retrieval

- `get_user_profile` - Get public profile information
- `get_user_summary` - Get a profile with recent posts and engagement stats in
  one call
- `get_post_context` - Get a post with thread, author, engagement, and media
  data (replaces the former `get_thread` and `extract_media_from_post`)
- `search_actors` - Find accounts by handle or display name
- `get_author_feed` - List a specific user's posts
- `get_user_connections` - Get a user's followers or follows via
  `direction: 'followers' | 'follows'`
- `get_custom_feed` - Access custom feeds
- `get_list` - Get list details

#### Moderation & Analysis

- `analyze_moderation_status` - Check moderation status of content
- `find_influential_users` - Find influential users in a topic area
- `find_similar_users` - Find similar users by shared follows/followers (graph
  overlap only; does not analyze content or topics)
- `discover_communities` - Discover communities around topics

#### Rich Media

- `analyze_image` - Report an image blob's declared size and MIME type (PUBLIC
  mode; does not decode pixels, so no dimensions or aspect ratio)

**Note:** Most other tools require authentication. `search_posts`, in
particular, requires authentication (the AT Protocol search API changed in 2025
to require auth). App passwords are the supported auth path — set
`ATPROTO_IDENTIFIER` and `ATPROTO_PASSWORD` (generate an app password in Bluesky
Settings). See [Authentication](./authentication.md).

::: tip Planned

OAuth login is on the roadmap but not yet functional, so it is not exposed as a
tool. Use app-password authentication. See
[Experimental & Roadmap](./experimental.md).

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
- `get_notifications` - Get notifications (use `countOnly: true` for a cheap
  unread badge count)
- `mark_notifications_seen` - Mark notifications as seen up to a timestamp

#### Content Management

- `delete_post` - Delete your posts
- `update_profile` - Update your profile
- `upload_image` - Upload images
- `upload_video` - Upload videos
- `generate_link_preview` - Generate link preview cards

#### List Management

- `create_list` - Create user lists
- `add_to_list` - Add users to lists
- `remove_from_list` - Remove users from lists

#### Moderation

- `mute_user` / `unmute_user` - Mute and unmute users
- `block_user` / `unblock_user` - Block and unblock users
- `report_content` - Report inappropriate content
- `report_user` - Report users

#### Batch Operations

- `batch_action` - Apply one action across up to 25 targets in a single call via
  `action: 'follow' | 'like' | 'repost'`

#### Analytics & Insights

- `analyze_account` - Analyze a single account along one dimension via
  `dimension: 'engagement' | 'network' | 'strategy'` (engagement rate is
  engagement per hour since posting, a time-velocity measure)

#### Content Discovery

- `discover` - Surface timeline content via `mode: 'trending' | 'recommended'`,
  sampling the caller's own home timeline (~100 posts), not the whole network

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
- Example: `analyze_image` (the only PUBLIC-mode tool)

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

## Tool Annotations

Every tool advertises explicit
[MCP tool annotations](https://modelcontextprotocol.io/docs/concepts/tools#tool-annotations)
in `tools/list`, so clients can build confirmation UI and auto-approval policies
on them:

- **`openWorldHint: true`** on every tool — they all reach the live AT Protocol
  network.
- **`readOnlyHint: true`** on pure read tools (searches, feeds, profiles,
  lookups, `analyze_*`, `generate_link_preview`). These perform no writes.
- **Write tools always carry explicit `destructiveHint` and `idempotentHint`**
  (per the MCP spec, clients must assume the worst for omitted hints on
  non-read-only tools, so nothing is left implicit):
  - `destructiveHint: false` on purely additive, reversible writes
    (`create_post`, `like_post`, `follow_user`, `upload_image`, ...).
  - `destructiveHint: true` on tools that delete or overwrite existing
    data/state (`delete_post`, `unfollow_user`, `block_user`/`unblock_user`,
    `update_profile`, `report_content`/`report_user`, ...).
  - `idempotentHint: true` is claimed only where the implementation verifiably
    dedups or the underlying endpoint has set/clear semantics (e.g.
    `like_post`, `follow_user`, `mute_user`/`unmute_user`, `batch_action`,
    `update_profile`). Tools that create a new record on every call (e.g.
    `create_post`, `repost` with quote text, `report_content`) advertise
    `idempotentHint: false`.

A `destructiveHint: true` tool is a good candidate for a client-side
confirmation step; `readOnlyHint: true` tools are safe to auto-approve.

## Resources

Resources provide context data that LLMs can read. The server provides 3
resources; all of them require authentication. Resource contents are returned
as stringified JSON text; the shapes below are illustrative. Reading an unknown
resource URI returns JSON-RPC error `-32002` (Resource not found).

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

::: info Removed

Earlier releases also registered a placeholder
`atproto://conversation-context` resource. It has been unregistered: MCP has no
client-write mechanism for resources and no tool populated it, so it could only
ever return empty data. Do not rely on it to recall posts, threads, users,
searches, or actions from earlier in a conversation.

:::

## Prompts

Prompts help LLMs perform common tasks with better context. The server provides
2 prompts. They are pure text templates that never touch the AT Protocol
client, so they **work without authentication**.

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
