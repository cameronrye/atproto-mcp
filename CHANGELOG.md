# Changelog

All notable changes to the AT Protocol MCP Server will be documented in this
file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- OAuth token exchange (the `oauth-client` scaffolding is in place)
- Firehose frame decoding to enable real-time streaming
- Direct messaging support
- Group/community features
- Custom feed generator integration
- Multi-account management

## [0.4.0] - 2026-06-09

This release reshapes the tool API for clarity and reliability: it removes tools
that never worked, consolidates overlapping tools, and completes the
machine-readable schema and documentation for every remaining tool. The tool
count goes from 62 to 43, and all 43 are functional, single-purpose, and fully
documented.

### Removed (BREAKING)

- **OAuth tools** — `start_oauth_flow`, `handle_oauth_callback`,
  `refresh_oauth_tokens`, `revoke_oauth_tokens`. Token exchange was never
  implemented, so these always returned an error. Use app-password
  authentication (`ATPROTO_IDENTIFIER` / `ATPROTO_PASSWORD`). The underlying
  `oauth-client` module is retained for future work.
- **Real-time streaming tools** — `start_streaming`, `stop_streaming`,
  `get_streaming_status`, `get_recent_events`, `monitor_keywords`,
  `track_users`. Firehose frame decoding was never implemented, so the event
  buffer was always empty. The `FirehoseClient` infrastructure is retained.
- **`generate_alt_text`** — no vision model was wired in; it returned writing
  guidance rather than a description of the image.

### Changed (BREAKING)

Redundant tools were consolidated. Migration mapping:

- `create_rich_text_post` → **`create_post`** (now accepts optional `facets` and
  a `quote` embed).
- `get_followers` + `get_follows` → **`get_user_connections`**
  (`direction: 'followers' | 'follows'`).
- `get_unread_count` → **`get_notifications`** (`countOnly: true`).
- `get_thread` + `extract_media_from_post` → **`get_post_context`** (`depth`,
  `parentHeight`, `includeMedia`).
- `analyze_engagement` + `analyze_network` + `suggest_content_strategy` →
  **`analyze_account`** (`dimension: 'engagement' | 'network' | 'strategy'`).
- `discover_trending` + `recommend_content` → **`discover`**
  (`mode: 'trending' | 'recommended'`).
- `batch_follow` + `batch_like` + `batch_repost` → **`batch_action`**
  (`action: 'follow' | 'like' | 'repost'`).

### Added

- **`search_actors`** — find accounts by handle or display name.
- **`get_author_feed`** — list a specific user's posts.
- Every tool now advertises a JSON Schema `outputSchema` in `tools/list`, and
  every tool parameter carries a description. A test enforces 100% coverage so
  this cannot regress.
- `glama.json` to claim the Glama server listing.

## [0.3.0] - 2026-06-07

This release focuses on **honesty and accuracy**: the server now states plainly
what is functional, what is experimental, and what is a placeholder. Features
that were previously simulated, planned, or described as fully working have been
re-scoped to match the actual implementation, and the documentation has been
rewritten to match the shipped server.

### Added

- BCP-47 language tags for `create_post`, `reply_to_post`, and `search_posts`
  `langs` parameters (e.g. `en`, `en-US`, `pt-BR`), replacing the prior
  "two-letter only" assumption.
- DNS-rebinding hardening for request handling.
- Pagination support for `remove_from_list` so large lists are fully traversed.
- Experimental & Roadmap documentation page covering the non-functional stubs
  (streaming, OAuth completion, `generate_alt_text`, `conversation-context`) and
  the planned HTTP transport.

### Changed

- **Streaming is now an experimental, non-functional stub.** The six streaming
  tools (`start_streaming`, `stop_streaming`, `get_streaming_status`,
  `get_recent_events`, `monitor_keywords`, `track_users`) are registered and
  visible to MCP clients but do not decode the firehose: `start_streaming`
  returns `status: 'not_implemented'` and opens no socket, and the buffer-scan
  tools always return an empty event buffer.
- **OAuth is now honest about its state.** `start_oauth_flow` only builds a
  heuristic PKCE URL (no authorization-server metadata discovery or PAR), and
  `handle_oauth_callback`, `refresh_oauth_tokens`, and `revoke_oauth_tokens`
  throw `OAUTH_NOT_IMPLEMENTED`. App passwords remain the supported auth path.
- **`search_posts` requires authentication** (the AT Protocol search API changed
  in 2025 to require auth); it is no longer treated as a public/unauthenticated
  tool.
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
- `atproto://conversation-context` is a placeholder resource: registered and
  readable, but never auto-populated, so it returns empty/near-empty content.
- **Documentation rewritten to match the server**: corrected
  tool/resource/prompt counts (60 tools / 4 resources / 2 prompts), tool auth
  modes, the environment-variable and CLI surfaces, prompt arguments, and
  response shapes; consolidated the duplicate changelog/contributing/deployment
  docs into single sources via includes; and enabled dead-link checking on the
  docs build.
- `SECURITY.md` states the logging behavior precisely: the config loader redacts
  the password and client secret as `[REDACTED]`, and log fields are sanitized
  against log injection.

### Removed

- Removed simulated performance and observability infrastructure that the stdio
  server never actually provided (no HTTP server, no bound port, no `/health` or
  `/metrics` HTTP endpoints). The bundled health check is a process-local smoke
  check, not a probe of a running server.
- Removed the bogus `*` wildcard from `search_posts`; an empty query no longer
  returns all of an author's posts.
- Removed the broken `docker-compose.yml`, which defined unused
  Redis/Prometheus/Grafana sidecars and mounted a non-existent `./monitoring/`
  directory the stdio server never used.

### CI

- Upgraded `actions/deploy-pages` to v4 in the release workflow, fixing the
  GitHub Pages deployment "Cannot find any run with github.run_id" 404.

## [0.2.1] - 2025-11-19

### Changed

- Migrated npm publishing to Trusted Publishers (OIDC) with provenance and added
  automated GitHub release creation.
- Dependency updates and cross-platform build/CI improvements.
- Integrated Mermaid diagrams into the VitePress documentation site and removed
  development-only documentation files.

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

[Unreleased]: https://github.com/cameronrye/atproto-mcp/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/cameronrye/atproto-mcp/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/cameronrye/atproto-mcp/compare/v0.1.1...v0.2.1
[0.1.1]: https://github.com/cameronrye/atproto-mcp/releases/tag/v0.1.1
[0.1.0]: https://github.com/cameronrye/atproto-mcp/releases/tag/v0.1.0
[0.0.1]: https://github.com/cameronrye/atproto-mcp/releases/tag/v0.0.1
