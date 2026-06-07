# Changelog

All notable changes to the AT Protocol MCP Server will be documented in this
file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- Direct messaging support
- Group/community features
- Custom feed generator integration
- Multi-account management

## [0.2.1] - 2026-05-20

### Fixed

- Documentation accuracy pass: corrected tool/resource/prompt counts, removed
  references to infrastructure that the stdio server does not provide, and
  clarified which tools are experimental or placeholders.

## [0.2.0] - 2026-04-30

This release focuses on **honesty and accuracy**: the server now states plainly
what is functional, what is experimental, and what is a placeholder. Several
features that were previously described as simulated, planned, or fully working
have been re-scoped to match the actual implementation.

### Added

- BCP-47 language tags for `create_post`, `reply_to_post`, and `search_posts`
  `langs` parameters (e.g. `en`, `en-US`, `pt-BR`), replacing the prior
  "two-letter only" assumption.
- DNS-rebinding hardening for request handling.
- Pagination support for `remove_from_list` so large lists are fully traversed.

### Changed

- **Streaming is now an experimental, non-functional stub.** The six streaming
  tools (`start_streaming`, `stop_streaming`, `get_streaming_status`,
  `get_recent_events`, `monitor_keywords`, `track_users`) are registered and
  visible to MCP clients but do not decode the firehose: `start_streaming`
  returns `status: 'not_implemented'` and opens no socket, and the buffer-scan
  tools always return an empty event buffer. See the Experimental & Roadmap
  documentation.
- **OAuth is now honest about its state.** `start_oauth_flow` only builds a
  heuristic PKCE URL (no authorization-server metadata discovery or PAR), and
  `handle_oauth_callback`, `refresh_oauth_tokens`, and `revoke_oauth_tokens`
  throw `OAUTH_NOT_IMPLEMENTED`. App passwords remain the supported auth path.
- De-fabricated analytics and discovery metrics:
  - `find_similar_users` is graph-only (shared follows/followers); it does not
    compute content/topic similarity.
  - `discover_trending` samples only the caller's own home timeline (~100
    posts), not the network.
  - `analyze_engagement` reports engagement velocity (engagement per hour since
    post), not engagement per follower.
  - `upload_image`/`upload_video` and `extract_media_from_post` no longer
    fabricate aspect ratios; declared values are passed through as-is.
  - `analyze_image` reports only the blob's declared byte size and MIME type; it
    does not decode pixels, so no dimensions or aspect ratio are returned.
  - `generate_alt_text` is a placeholder that returns alt-text writing guidance,
    not an analysis of image pixels.
  - Analytics and discovery hydrate real profiles via `getProfiles` instead of
    fabricating follower counts.
- `atproto://conversation-context` is documented as a placeholder resource: it
  is registered and readable, but the server never auto-populates it, so it
  returns empty/near-empty content.

### Removed

- Removed simulated performance and observability infrastructure that the stdio
  server never actually provided (no HTTP server, no bound port, no `/health` or
  `/metrics` HTTP endpoints). The bundled health check is a process-local smoke
  check, not a probe of a running server.
- Removed the bogus `*` wildcard from `search_posts`; an empty query no longer
  returns all of an author's posts.

## [0.1.1] - 2025-11-18

### Added

**Batch Operations (3 new tools)**

- `batch_follow` - Follow multiple users at once (up to 25 users per call)
- `batch_like` - Like multiple posts at once (up to 25 posts per call)
- `batch_repost` - Repost multiple posts at once (up to 25 posts per call)

**Analytics & Insights (4 new tools)**

- `analyze_engagement` - Analyze engagement patterns across posts
- `analyze_network` - Analyze user's network and connections
- `suggest_content_strategy` - Get content strategy recommendations
- `find_influential_users` - Find influential users in a topic area

**Content Discovery (3 new tools)**

- `discover_trending` - Discover trending topics, hashtags, and posts
- `find_similar_users` - Find users similar to a given user
- `discover_communities` - Discover communities around specific topics

**Conversation Context Resource**

- `atproto://conversation-context` - Placeholder resource for conversation
  state; registered and readable, but not auto-populated by the server (returns
  empty/near-empty content)

### Improved

- Expanded test suite to 282 tests (up from 122)
- Enhanced TypeScript type safety across the codebase
- Improved error handling and validation in all tools
- Updated API documentation for all new tools

### Fixed

- Interface naming convention compliance
- Removed unused imports and variables
- Fixed error handling in catch blocks
- Prettier formatting consistency across all files

## [0.1.0] - 2024-09-15

### Added

- Initial release of AT Protocol MCP Server
- Unauthenticated mode for public data access
- App password authentication for full functionality
- 60 MCP tools for AT Protocol operations
- 4 MCP resources for context
- 2 MCP prompts for content assistance
- Type-safe implementation with TypeScript
- 122 unit and integration tests
- Comprehensive documentation

### Security

- Input validation and sanitization
- Rate limiting to prevent abuse
- Credential redaction in logs
- Non-root Docker containers
- HTTPS support for AT Protocol connections

## [0.0.1] - 2024-09-01

### Added

- Initial project setup
- Basic MCP server implementation
- AT Protocol integration using @atproto/api
- Core tool implementations
- Basic authentication support

---

[Unreleased]: https://github.com/cameronrye/atproto-mcp/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/cameronrye/atproto-mcp/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/cameronrye/atproto-mcp/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/cameronrye/atproto-mcp/releases/tag/v0.1.1
[0.1.0]: https://github.com/cameronrye/atproto-mcp/releases/tag/v0.1.0
[0.0.1]: https://github.com/cameronrye/atproto-mcp/releases/tag/v0.0.1
