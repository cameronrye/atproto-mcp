# API Reference

Complete API reference for the AT Protocol MCP Server, including all tools, resources, and types.

## Overview

The AT Protocol MCP Server provides a comprehensive set of tools and resources for interacting with the AT Protocol ecosystem. This reference documentation covers:

- **[Tools](#tools)** - MCP tools for performing operations
- **[Resources](#resources)** - MCP resources for accessing data
- **[Types](#types)** - TypeScript type definitions

## Tools

Tools are the primary way to interact with the AT Protocol through the MCP server. Each tool performs a specific operation and returns structured data.

### Core Social Operations

Essential tools for social networking operations:

- **[create_post](./tools/create-post.md)** - Create new posts with rich text support
- **[reply_to_post](./tools/reply-to-post.md)** - Reply to existing posts with threading
- **[like_post](./tools/like-post.md)** - Like a post
- **[unlike_post](./tools/unlike-post.md)** - Remove a like from a post
- **[repost](./tools/repost.md)** - Repost content with optional quotes
- **[unrepost](./tools/unrepost.md)** - Remove a repost

### User Operations

Tools for managing user relationships and profiles:

- **[follow_user](./tools/follow-user.md)** - Follow a user
- **[unfollow_user](./tools/unfollow-user.md)** - Unfollow a user
- **[get_user_profile](./tools/get-user-profile.md)** - Retrieve user profile information

### Data Retrieval

Tools for searching and retrieving data:

- **[search_posts](./tools/search-posts.md)** - Search for posts and content
- **[get_timeline](./tools/get-timeline.md)** - Retrieve personalized timeline
- **[get_followers](./tools/get-followers.md)** - Get follower lists
- **[get_follows](./tools/get-follows.md)** - Get following lists
- **[get_notifications](./tools/get-notifications.md)** - Access notification feeds

### Content Management

Tools for managing content and media:

- **[delete_post](./tools/delete-post.md)** - Remove posts
- **[update_profile](./tools/update-profile.md)** - Modify profile settings
- **[upload_image](./tools/upload-image.md)** - Upload image content
- **[upload_video](./tools/upload-video.md)** - Upload video content
- **[create_rich_text_post](./tools/create-rich-text-post.md)** - Create posts with rich formatting
- **[generate_link_preview](./tools/generate-link-preview.md)** - Generate link preview cards

### OAuth Authentication

Tools for OAuth authentication flows:

- **[start_oauth_flow](./tools/start-oauth-flow.md)** - Initiate OAuth authentication
- **[handle_oauth_callback](./tools/handle-oauth-callback.md)** - Complete OAuth flow
- **[refresh_oauth_tokens](./tools/refresh-oauth-tokens.md)** - Refresh authentication tokens
- **[revoke_oauth_tokens](./tools/revoke-oauth-tokens.md)** - Revoke OAuth tokens

### Moderation

Tools for content and user moderation:

- **[mute_user](./tools/mute-user.md)** - Mute a user
- **[unmute_user](./tools/unmute-user.md)** - Unmute a user
- **[block_user](./tools/block-user.md)** - Block a user
- **[unblock_user](./tools/unblock-user.md)** - Unblock a user
- **[report_content](./tools/report-content.md)** - Report content
- **[report_user](./tools/report-user.md)** - Report a user

### Real-time Streaming & Intelligence

Tools for real-time data streams:

- **[start_streaming](./tools/start-streaming.md)** - Start real-time data streaming with filtering
- **[stop_streaming](./tools/stop-streaming.md)** - Stop streaming
- **[get_streaming_status](./tools/get-streaming-status.md)** - Check streaming status
- **[get_recent_events](./tools/get-recent-events.md)** - Retrieve recent stream events
- **[monitor_keywords](./tools/monitor-keywords.md)** - Monitor firehose for specific keywords in real-time
- **[track_users](./tools/track-users.md)** - Track activity from specific users in real-time

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

- **[batch_follow](./tools/batch-follow.md)** - Follow multiple users at once (up to 25)
- **[batch_like](./tools/batch-like.md)** - Like multiple posts at once (up to 25)
- **[batch_repost](./tools/batch-repost.md)** - Repost multiple posts at once (up to 25)

### Analytics & Insights

Tools for analyzing engagement and network patterns:

- **[analyze_engagement](./tools/analyze-engagement.md)** - Analyze engagement patterns across posts
- **[analyze_network](./tools/analyze-network.md)** - Analyze user's network and connections
- **[suggest_content_strategy](./tools/suggest-content-strategy.md)** - Get content strategy recommendations based on performance
- **[find_influential_users](./tools/find-influential-users.md)** - Find influential users in a topic area

### Content Discovery

Tools for discovering content and users:

- **[discover_trending](./tools/discover-trending.md)** - Discover trending topics and posts
- **[find_similar_users](./tools/find-similar-users.md)** - Find users similar to a given user
- **[recommend_content](./tools/recommend-content.md)** - Get personalized content recommendations
- **[discover_communities](./tools/discover-communities.md)** - Discover communities around topics

### Composite Operations

Tools that combine multiple operations:

- **[get_user_summary](./tools/get-user-summary.md)** - Get complete user profile with stats and analysis
- **[get_post_context](./tools/get-post-context.md)** - Get post with thread, author, and engagement data
- **[create_thread](./tools/create-thread.md)** - Create multi-post threads in one call

### Rich Media

Tools for working with images and media:

- **[generate_alt_text](./tools/generate-alt-text.md)** - Generate descriptive alt text for images
- **[analyze_image](./tools/analyze-image.md)** - Analyze image metadata and properties
- **[extract_media_from_post](./tools/extract-media-from-post.md)** - Extract all media from posts

### Enhanced Moderation

Additional moderation tools:

- **[analyze_moderation_status](./tools/analyze-moderation-status.md)** - Check moderation status of content

## Resources

Resources provide read-only access to AT Protocol data through the MCP protocol:

- **[Timeline Resource](./resources/timeline.md)** - Current user's timeline feed (requires authentication)
- **[Profile Resource](./resources/profile.md)** - Current user's profile information (requires authentication)
- **[Notifications Resource](./resources/notifications.md)** - Current user's notifications (requires authentication)
- **Conversation Context Resource** - Tracks conversation state across LLM interactions (always available)

## Types

TypeScript type definitions used throughout the server:

- **[Core Types](./types/core.md)** - Branded types and AT Protocol identifiers
- **[Configuration Types](./types/configuration.md)** - Server and authentication configuration
- **[Parameter Types](./types/parameters.md)** - Tool parameter schemas
- **[Error Types](./types/errors.md)** - Error classes and handling
- **[Utility Types](./types/utilities.md)** - Helper types and interfaces

## Authentication

Most tools require authentication. The server supports two authentication methods:

### App Passwords (Development)

```bash
export ATPROTO_IDENTIFIER="your-handle.bsky.social"
export ATPROTO_PASSWORD="your-app-password"
```

### OAuth (Production)

```bash
export ATPROTO_CLIENT_ID="your-client-id"
export ATPROTO_CLIENT_SECRET="your-client-secret"
```

### Unauthenticated Mode

As of 2025, the AT Protocol API has changed to require authentication for most endpoints. Only the following tools work without authentication:

- `get_user_profile` (ENHANCED mode: provides additional viewer-specific data when authenticated)
- `start_oauth_flow`
- `handle_oauth_callback`
- `refresh_oauth_tokens`
- `revoke_oauth_tokens`

**Note:** Tools like `search_posts`, `get_followers`, `get_follows`, `get_thread`, and `get_custom_feed` now require authentication.

## Error Handling

All tools follow consistent error handling patterns. See the [Error Handling Guide](../guide/error-handling.md) for details.

## Rate Limiting

The server respects AT Protocol rate limits. See the [Configuration Guide](../guide/configuration.md) for rate limiting settings.

## Examples

For practical examples of using these tools, see:

- [Basic Usage Examples](../examples/basic-usage.md)
- [Social Operations Examples](../examples/social-operations.md)
- [Content Management Examples](../examples/content-management.md)
- [Real-time Data Examples](../examples/real-time-data.md)
- [Custom Integration Examples](../examples/custom-integration.md)

## Support

- [Documentation](https://cameronrye.github.io/atproto-mcp)
- [Issue Tracker](https://github.com/cameronrye/atproto-mcp/issues)
- [Discussions](https://github.com/cameronrye/atproto-mcp/discussions)

