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

### Real-time Streaming

Tools for real-time data streams:

- **[start_streaming](./tools/start-streaming.md)** - Start real-time data streaming
- **[stop_streaming](./tools/stop-streaming.md)** - Stop streaming
- **[get_streaming_status](./tools/get-streaming-status.md)** - Check streaming status
- **[get_recent_events](./tools/get-recent-events.md)** - Retrieve recent stream events

### Advanced Social Features

Tools for advanced social networking:

- **[create_list](./tools/create-list.md)** - Create user lists
- **[add_to_list](./tools/add-to-list.md)** - Add users to lists
- **[remove_from_list](./tools/remove-from-list.md)** - Remove users from lists
- **[get_list](./tools/get-list.md)** - Retrieve list information
- **[get_thread](./tools/get-thread.md)** - View post threads
- **[get_custom_feed](./tools/get-custom-feed.md)** - Access custom feeds

## Resources

Resources provide read-only access to AT Protocol data through the MCP protocol:

- **[Timeline Resource](./resources/timeline.md)** - Current user's timeline feed
- **[Profile Resource](./resources/profile.md)** - Current user's profile information
- **[Notifications Resource](./resources/notifications.md)** - Current user's notifications

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

Some tools work without authentication for accessing public data:
- `search_posts`
- `get_user_profile`
- `get_followers`
- `get_follows`
- `get_thread`
- `get_custom_feed`

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

- 📖 [Documentation](https://cameronrye.github.io/atproto-mcp)
- 🐛 [Issue Tracker](https://github.com/cameronrye/atproto-mcp/issues)
- 💬 [Discussions](https://github.com/cameronrye/atproto-mcp/discussions)

