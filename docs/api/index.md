# API Reference

Complete API reference for the AT Protocol MCP Server, including all tools,
resources, and types.

## Overview

The AT Protocol MCP Server provides a comprehensive set of tools and resources
for interacting with the AT Protocol ecosystem. This reference documentation
covers:

- **[Tools](#tools)** - 60 MCP tools for performing operations
- **[Resources](#resources)** - 4 MCP resources for accessing data
- **[Prompts](#prompts)** - 2 MCP prompts for guided content generation
- **[Types](#types)** - TypeScript type definitions

Some tools are registered and visible to MCP clients but are **not yet
functional** (streaming, OAuth callback completion) or are
**placeholders/experimental**. These are marked inline below and described in
detail on the [Experimental & Roadmap](../guide/experimental.md) page.

## Tools

Tools are the primary way to interact with the AT Protocol through the MCP
server. Each tool performs a specific operation and returns structured data.

### Core Social Operations

Essential tools for social networking operations:

- **[create_post](./tools/create-post.md)** - Create new posts with rich text
  support
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

### Data Retrieval

Tools for searching and retrieving data:

- **[search_posts](./tools/search-posts.md)** - Search for posts and content
- **[get_timeline](./tools/get-timeline.md)** - Retrieve personalized timeline
- **[get_followers](./tools/get-followers.md)** - Get follower lists
- **[get_follows](./tools/get-follows.md)** - Get following lists
- **[get_notifications](./tools/get-notifications.md)** - Access notification
  feeds

### Content Management

Tools for managing content and media:

- **[delete_post](./tools/delete-post.md)** - Remove posts
- **[update_profile](./tools/update-profile.md)** - Modify profile settings
- **[upload_image](./tools/upload-image.md)** - Upload image content
- **[upload_video](./tools/upload-video.md)** - Upload video content
- **[create_rich_text_post](./tools/create-rich-text-post.md)** - Create posts
  with rich formatting
- **[generate_link_preview](./tools/generate-link-preview.md)** - Generate link
  preview cards

### OAuth Authentication

Tools for OAuth authentication flows. App passwords are the supported auth path
today (see [Authentication](#authentication)); the OAuth flow is incomplete.

- **[start_oauth_flow](./tools/start-oauth-flow.md)** - Initiate OAuth
  authentication _(EXPERIMENTAL: builds a heuristic PKCE authorization URL but
  the callback exchange is unimplemented, so the flow is a dead end)_
- **[handle_oauth_callback](./tools/handle-oauth-callback.md)** - Complete OAuth
  flow _(NOT IMPLEMENTED: always throws `OAUTH_NOT_IMPLEMENTED`)_
- **[refresh_oauth_tokens](./tools/refresh-oauth-tokens.md)** - Refresh
  authentication tokens _(NOT IMPLEMENTED: always throws
  `OAUTH_NOT_IMPLEMENTED`)_
- **[revoke_oauth_tokens](./tools/revoke-oauth-tokens.md)** - Revoke OAuth
  tokens _(NOT IMPLEMENTED: always throws `OAUTH_NOT_IMPLEMENTED`)_

### Moderation

Tools for content and user moderation:

- **[mute_user](./tools/mute-user.md)** - Mute a user
- **[unmute_user](./tools/unmute-user.md)** - Unmute a user
- **[block_user](./tools/block-user.md)** - Block a user
- **[unblock_user](./tools/unblock-user.md)** - Unblock a user
- **[report_content](./tools/report-content.md)** - Report content
- **[report_user](./tools/report-user.md)** - Report a user

### Real-time Streaming & Intelligence

Tools for real-time data streams. Firehose decoding is gated off, so these tools
are registered but **not yet functional** — they open no socket and never return
real events. See [Experimental & Roadmap](../guide/experimental.md).

- **[start_streaming](./tools/start-streaming.md)** - Start real-time data
  streaming with filtering _(NOT IMPLEMENTED: returns `success: false`,
  `status: 'not_implemented'`)_
- **[stop_streaming](./tools/stop-streaming.md)** - Stop streaming _(NOT
  IMPLEMENTED)_
- **[get_streaming_status](./tools/get-streaming-status.md)** - Check streaming
  status _(NOT IMPLEMENTED)_
- **[get_recent_events](./tools/get-recent-events.md)** - Retrieve recent stream
  events _(NOT IMPLEMENTED: always returns an empty event buffer)_
- **[monitor_keywords](./tools/monitor-keywords.md)** - Monitor firehose for
  specific keywords _(NOT IMPLEMENTED: always returns an empty event buffer)_
- **[track_users](./tools/track-users.md)** - Track activity from specific users
  _(NOT IMPLEMENTED: always returns an empty event buffer)_

### Advanced Social Features

Tools for advanced social networking:

- **[create_list](./tools/create-list.md)** - Create user lists
- **[add_to_list](./tools/add-to-list.md)** - Add users to lists
- **[remove_from_list](./tools/remove-from-list.md)** - Remove users from lists
- **[get_list](./tools/get-list.md)** - Retrieve list information
- **[get_thread](./tools/get-thread.md)** - View post threads
- **[get_custom_feed](./tools/get-custom-feed.md)** - Access custom feeds

### Batch Operations

Tools for performing multiple operations at once:

- **[batch_follow](./tools/batch-follow.md)** - Follow multiple users at once
  (up to 25)
- **[batch_like](./tools/batch-like.md)** - Like multiple posts at once (up
  to 25)
- **[batch_repost](./tools/batch-repost.md)** - Repost multiple posts at once
  (up to 25)

### Analytics & Insights

Tools for analyzing engagement and network patterns:

- **[analyze_engagement](./tools/analyze-engagement.md)** - Analyze engagement
  patterns across posts (engagement rate is engagement per hour since posting,
  not per follower)
- **[analyze_network](./tools/analyze-network.md)** - Analyze user's network and
  connections
- **[suggest_content_strategy](./tools/suggest-content-strategy.md)** - Get
  content strategy recommendations based on performance
- **[find_influential_users](./tools/find-influential-users.md)** - Find
  influential users in a topic area

### Content Discovery

Tools for discovering content and users:

- **[discover_trending](./tools/discover-trending.md)** - Surface trending
  topics and posts by sampling the caller's own home timeline (not network-wide)
- **[find_similar_users](./tools/find-similar-users.md)** - Find users similar
  to a given user via shared follows/followers (graph-only; not content/topic
  similarity)
- **[recommend_content](./tools/recommend-content.md)** - Get personalized
  content recommendations
- **[discover_communities](./tools/discover-communities.md)** - Discover
  communities around topics

### Composite Operations

Tools that combine multiple operations:

- **[get_user_summary](./tools/get-user-summary.md)** - Get complete user
  profile with stats and analysis
- **[get_post_context](./tools/get-post-context.md)** - Get post with thread,
  author, and engagement data
- **[create_thread](./tools/create-thread.md)** - Create multi-post threads in
  one call

### Rich Media

Tools for working with images and media:

- **[generate_alt_text](./tools/generate-alt-text.md)** - Generate descriptive
  alt text for images _(PLACEHOLDER: returns alt-text writing guidance/a
  template; it does not analyze image pixels with a vision model)_
- **[analyze_image](./tools/analyze-image.md)** - Report an image blob's
  declared size and MIME type (does not decode pixels, so no dimensions or
  aspect ratio)
- **[extract_media_from_post](./tools/extract-media-from-post.md)** - Extract
  all media from posts

### Enhanced Moderation

Additional moderation tools:

- **[analyze_moderation_status](./tools/analyze-moderation-status.md)** - Check
  moderation status of content

## Resources

The server exposes 4 resources that provide read-only access to AT Protocol data
through the MCP protocol:

- **[Timeline Resource](./resources/timeline.md)** - Current user's timeline
  feed (requires authentication; calls the real API)
- **[Profile Resource](./resources/profile.md)** - Current user's profile
  information (requires authentication; calls the real API)
- **[Notifications Resource](./resources/notifications.md)** - Current user's
  notifications (requires authentication; calls the real API)
- **Conversation Context Resource** (`atproto://conversation-context`) -
  _Placeholder._ Registered and readable, but the server never auto-populates
  it, so it returns empty/near-empty content.

## Prompts

The server provides 2 prompts for guided content generation. Both require
authentication to be available:

- **`content_composition`** - Compose a post from a topic. Arguments: `topic`,
  `tone`, `length`, `include_hashtags`.
- **`reply_template`** - Draft a contextual reply. Arguments: `original_post`,
  `reply_type`, `relationship`, `tone`.

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

### OAuth (Experimental)

OAuth configuration is accepted but the flow is **not complete** —
`start_oauth_flow` only builds a heuristic PKCE URL, and the
callback/refresh/revoke tools always throw `OAUTH_NOT_IMPLEMENTED`. See the
[Authentication Guide](../guide/authentication.md) and
[Experimental & Roadmap](../guide/experimental.md).

```bash
export ATPROTO_CLIENT_ID="your-client-id"
export ATPROTO_CLIENT_SECRET="your-client-secret"
```

### Unauthenticated Mode

The server runs without credentials, but only public tools work. In practice
this is limited to:

- `search_posts` - Public search
- `get_user_profile` - Public profile lookup (returns additional viewer-specific
  data when authenticated)

All other tools — including `get_followers`, `get_follows`, `get_thread`,
`get_timeline`, and `get_custom_feed` — require authentication. The
OAuth-completion tools (`handle_oauth_callback`, `refresh_oauth_tokens`,
`revoke_oauth_tokens`) are **not functional** and never succeed regardless of
authentication state.

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
