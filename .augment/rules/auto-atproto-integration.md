# AT Protocol Integration Guidelines (Auto-Applied)

**Description**: Automatically applied when working with AT Protocol integration, Bluesky API, or social networking features

## AT Protocol Client Setup
- Use `@atproto/api` version 0.14.0 or later for latest features
- Initialize `AtpAgent` with proper service endpoint configuration
- Implement session persistence for authentication tokens
- Configure proper user agent strings identifying the MCP server
- Handle service discovery for custom PDS instances

## Authentication & Sessions
- Implement OAuth flow for user authentication when required
- Store session tokens securely (never in plain text)
- Handle token refresh automatically before expiration
- Implement proper logout and session cleanup
- Support both app passwords and OAuth tokens

## Data Models & Types
- Use AT Protocol's official TypeScript types from `@atproto/api`
- Create branded types for AT Protocol identifiers:
  ```typescript
  type DID = string & { readonly brand: unique symbol }
  type ATURI = string & { readonly brand: unique symbol }
  type NSID = string & { readonly brand: unique symbol }
  ```
- Validate AT-URIs using proper regex patterns
- Implement proper CID (Content Identifier) handling
- Use proper datetime formatting (ISO 8601 with timezone)

## Repository Operations
- Use proper NSID (Namespaced Identifier) formatting
- Implement CRUD operations for records (create, read, update, delete)
- Handle record versioning and CAS (Compare-and-Swap) operations
- Implement proper blob upload and management
- Use batch operations for bulk record operations

## Social Features Implementation
- Implement proper post creation with rich text support
- Handle mentions, hashtags, and links correctly
- Implement follow/unfollow operations with proper notifications
- Handle likes, reposts, and replies with threading
- Implement proper content moderation and filtering

## Firehose & Real-time Data
- Use WebSocket connections for real-time data streams
- Implement proper backpressure handling for high-volume streams
- Parse CAR (Content Addressable aRchive) files correctly
- Handle stream reconnection and error recovery
- Implement efficient data processing pipelines

## Rate Limiting & Performance
- Respect AT Protocol rate limits (varies by endpoint)
- Implement exponential backoff for failed requests
- Use connection pooling for multiple concurrent requests
- Cache frequently accessed data with appropriate TTL
- Implement request deduplication for identical operations

## Error Handling
- Handle AT Protocol specific errors (InvalidRequest, AuthRequired, etc.)
- Implement proper retry logic for transient failures
- Log AT Protocol errors with request context
- Provide meaningful error messages to MCP clients
- Handle network timeouts and connection failures gracefully

## Content & Moderation
- Implement content labeling and filtering
- Handle NSFW and sensitive content appropriately
- Respect user blocking and muting preferences
- Implement proper content warnings and labels
- Handle takedown requests and content removal

## Privacy & Security
- Never expose private user data without explicit consent
- Implement proper data retention policies
- Handle user privacy settings correctly
- Secure all AT Protocol communications with HTTPS
- Validate all user inputs before AT Protocol operations
