# API Reference

Complete API reference for the AT Protocol MCP Server, including all tools,
resources, and types.

## Overview

The AT Protocol MCP Server provides a comprehensive set of tools and resources
for interacting with the AT Protocol ecosystem. This reference documentation
covers:

- **[Tools](#tools)** - 51 MCP tools for performing operations
- **[Resources](#resources)** - 3 MCP resources plus 2 parameterized resource
  templates for accessing data
- **[Prompts](#prompts)** - 2 MCP prompts for guided content generation
- **[Types](#types)** - TypeScript type definitions

OAuth login is on the roadmap but not yet functional, so it is not exposed as a
tool. Real-time firehose streaming is not planned as tools. See the
[Experimental & Roadmap](../guide/experimental.md) page for details.

## Tools

Tools are the primary way to interact with the AT Protocol through the MCP
server. Each tool performs a specific operation and returns structured data.

### Core Social Operations

Essential tools for social networking operations:

- **[create_post](./tools/create-post.md)** - Create posts with text, richtext
  facets, replies, image/external embeds, and quote posts
- **[create_thread](./tools/create-thread.md)** - Create multi-post threads in
  one call
- **[reply_to_post](./tools/reply-to-post.md)** - Reply to existing posts with
  threading
- **[like_post](./tools/like-post.md)** - Like a post
- **[unlike_post](./tools/unlike-post.md)** - Remove a like from a post
- **[repost](./tools/repost.md)** - Repost content with optional quotes
- **[unrepost](./tools/unrepost.md)** - Remove a repost

### User Operations

Tools for managing user relationships and profiles:

- **[follow_user](./tools/follow-user.md)** - Follow a user
- **[unfollow_user](./tools/unfollow-user.md)** - Unfollow a user
- **[get_user_profile](./tools/get-user-profile.md)** - Retrieve user profile
  information
- **[search_actors](./tools/search-actors.md)** - Find accounts by handle or
  display name

### Data Retrieval

Tools for searching and retrieving data:

- **[search_posts](./tools/search-posts.md)** - Search for posts and content
- **[get_timeline](./tools/get-timeline.md)** - Retrieve personalized timeline
- **[get_author_feed](./tools/get-author-feed.md)** - List a specific user's
  posts
- **[get_user_connections](./tools/get-user-connections.md)** - Get follower or
  following lists via `direction: 'followers' | 'follows'`
- **[get_notifications](./tools/get-notifications.md)** - Access notification
  feeds (use `countOnly: true` for a cheap unread count)
- **[mark_notifications_seen](./tools/mark-notifications-seen.md)** - Mark
  notifications as seen up to a timestamp (defaults to now)

### Direct Messages

Tools for Bluesky direct messages (`chat.bsky.convo`, proxied to the Bluesky
chat service). They require an app password created with **"Allow access to
your direct messages"** enabled:

- **[list_conversations](./tools/list-conversations.md)** - List your DM
  conversations (filter by `status: 'request' | 'accepted'`)
- **[get_conversation_messages](./tools/get-conversation-messages.md)** - Read
  a conversation's message history
- **[send_direct_message](./tools/send-direct-message.md)** - Send a direct
  message to a conversation

### Bookmarks

Tools for private, account-scoped bookmarks (other users cannot see them):

- **[add_bookmark](./tools/add-bookmark.md)** - Privately bookmark a post
- **[remove_bookmark](./tools/remove-bookmark.md)** - Remove a bookmark
- **[get_bookmarks](./tools/get-bookmarks.md)** - List your bookmarks

### Content Management

Tools for managing content and media:

- **[delete_post](./tools/delete-post.md)** - Remove posts
- **[update_profile](./tools/update-profile.md)** - Modify profile settings
- **[upload_image](./tools/upload-image.md)** - Upload image content
- **[upload_video](./tools/upload-video.md)** - Upload video content
- **[generate_link_preview](./tools/generate-link-preview.md)** - Generate link
  preview cards

### Moderation

Tools for content and user moderation:

- **[mute_user](./tools/mute-user.md)** - Mute a user
- **[unmute_user](./tools/unmute-user.md)** - Unmute a user
- **[block_user](./tools/block-user.md)** - Block a user
- **[unblock_user](./tools/unblock-user.md)** - Unblock a user
- **[report_content](./tools/report-content.md)** - Report content
- **[report_user](./tools/report-user.md)** - Report a user
- **[analyze_moderation_status](./tools/analyze-moderation-status.md)** - Check
  moderation status of content

### Advanced Social Features

Tools for advanced social networking:

- **[create_list](./tools/create-list.md)** - Create user lists
- **[add_to_list](./tools/add-to-list.md)** - Add users to lists
- **[remove_from_list](./tools/remove-from-list.md)** - Remove users from lists
- **[get_list](./tools/get-list.md)** - Retrieve list information
- **[get_custom_feed](./tools/get-custom-feed.md)** - Access custom feeds

### Batch Operations

Tools for performing multiple operations at once:

- **[batch_action](./tools/batch-action.md)** - Apply one action (`follow`,
  `like`, or `repost`) across up to 25 targets in a single call

### Analytics & Insights

Tools for analyzing engagement and network patterns:

- **[analyze_account](./tools/analyze-account.md)** - Analyze a single account
  along one dimension (`engagement`, `network`, or `strategy`); engagement rate
  is engagement per hour since posting, not per follower
- **[find_influential_users](./tools/find-influential-users.md)** - Find
  influential users in a topic area

### Content Discovery

Tools for discovering content and users:

- **[discover](./tools/discover.md)** - Surface timeline content via
  `mode: 'trending' | 'recommended'`, sampling the caller's own home timeline
  (not network-wide)
- **[find_similar_users](./tools/find-similar-users.md)** - Find users similar
  to a given user via shared follows/followers (graph-only; not content/topic
  similarity)
- **[discover_communities](./tools/discover-communities.md)** - Discover
  communities around topics
- **[search_starter_packs](./tools/search-starter-packs.md)** - Search Bluesky
  starter packs by keyword (works without authentication)
- **[get_starter_pack](./tools/get-starter-pack.md)** - Fetch a starter pack's
  details by AT-URI or bsky.app link (works without authentication)

### Composite Operations

Tools that combine multiple operations:

- **[get_user_summary](./tools/get-user-summary.md)** - Get complete user
  profile with stats and analysis
- **[get_post_context](./tools/get-post-context.md)** - Get a post with thread,
  author, engagement, and media data (replaces the former `get_thread` and
  `extract_media_from_post`)

### Rich Media

Tools for working with images and media:

- **[analyze_image](./tools/analyze-image.md)** - Report an image blob's
  declared size and MIME type (does not decode pixels, so no dimensions or
  aspect ratio)

## Resources

The server exposes 3 static resources that provide read-only access to the
authenticated user's AT Protocol data through the MCP protocol:

- **[Timeline Resource](./resources/timeline.md)** - Current user's timeline
  feed (requires authentication; calls the real API)
- **[Profile Resource](./resources/profile.md)** - Current user's profile
  information (requires authentication; calls the real API)
- **[Notifications Resource](./resources/notifications.md)** - Current user's
  notifications (requires authentication; calls the real API)

It also advertises 2 parameterized resource templates
(`resources/templates/list`) that expose **any** actor's public data and work
**without authentication** (they fall back to the public API when no session is
active):

- **`atproto://profile/{actor}`** - Public profile and statistics for any
  actor, addressed by handle (e.g. `alice.bsky.social`) or DID
- **`atproto://feed/{actor}`** - Recent public posts by any actor

The `{actor}` variable supports `completion/complete` (the server offers the
authenticated user's own handle as a candidate).

The placeholder Conversation Context resource
(`atproto://conversation-context`) from earlier releases has been removed — it
was never auto-populated and could only return empty content. Reading a URI
that matches neither a static resource nor a template returns JSON-RPC error
`-32002` (Resource not found).

## Prompts

The server provides 2 prompts for guided content generation. They are pure text
templates and work without authentication:

- **`content_composition`** - Compose a post from a topic. Arguments: `topic`,
  `tone`, `length`, `include_hashtags`.
- **`reply_template`** - Draft a contextual reply. Arguments: `original_post`,
  `reply_type`, `relationship`.

Prompt arguments support `completion/complete`: enumerable arguments (such as
`tone` or `reply_type`) return candidate values, while free-text arguments
complete to an empty list.

## Types

TypeScript type definitions used throughout the server:

- **[Core Types](./types/core.md)** - Branded types and AT Protocol identifiers
- **[Configuration Types](./types/configuration.md)** - Server and
  authentication configuration
- **[Parameter Types](./types/parameters.md)** - Tool parameter schemas
- **[Error Types](./types/errors.md)** - Error classes and handling
- **[Utility Types](./types/utilities.md)** - Helper types and interfaces

## Authentication

Most tools require authentication.

### App Passwords (Supported)

App passwords are the supported authentication path. Generate an app password in
your Bluesky **Settings → Privacy and security → App passwords**, then set:

```bash
export ATPROTO_IDENTIFIER="your-handle.bsky.social"
export ATPROTO_PASSWORD="your-app-password"
```

### OAuth (Planned)

OAuth login is on the roadmap but **not yet functional**, so it is not exposed
as a configuration path or a tool. Use app passwords (above) for authentication.
See the [Authentication Guide](../guide/authentication.md) and
[Experimental & Roadmap](../guide/experimental.md).

### Unauthenticated Mode

The server runs without credentials, but only public/enhanced tools work. In
practice this is limited to:

- `get_user_profile` / `get_user_summary` - Public profile lookup (returns
  additional viewer-specific data when authenticated)
- `search_actors` - Find accounts by handle or display name
- `get_author_feed` - List a user's posts
- `get_user_connections` - Follower/following lists (ENHANCED mode: works
  without auth, enriches the underlying API call when authenticated)
- `search_starter_packs` / `get_starter_pack` - Starter pack search and lookup
- `get_post_context`, `analyze_image`, and other PUBLIC/ENHANCED rich-media and
  composite tools

All other tools — including `search_posts`, `get_timeline`, and
`get_custom_feed` — require authentication. (`search_posts` previously worked
unauthenticated, but the AT Protocol search API changed in 2025 to require
auth.)

## Error Handling

All tools follow consistent error handling patterns. See the
[Error Handling Guide](../guide/error-handling.md) for details.

## Rate Limiting

The server applies a per-tool rate limit of 100 requests per minute. Requests
that exceed the limit for a given tool are rejected until the window resets. See
the [Configuration Guide](../guide/configuration.md) for details.

## Examples

For practical examples of using these tools, see:

- [Basic Usage Examples](../examples/basic-usage.md)
- [Social Operations Examples](../examples/social-operations.md)
- [Content Management Examples](../examples/content-management.md)
- [Custom Integration Examples](../examples/custom-integration.md)

## Support

- [Documentation](https://cameronrye.github.io/atproto-mcp)
- [Issue Tracker](https://github.com/cameronrye/atproto-mcp/issues)
- [Discussions](https://github.com/cameronrye/atproto-mcp/discussions)
