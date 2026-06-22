# Changelog

All notable changes to the AT Protocol MCP Server will be documented in this
file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- OAuth token exchange (the `oauth-client` scaffolding is in place)
- DM rich text, embeds, and conversation management (mute/accept/leave)
- Group/community features
- Custom feed generator integration
- Multi-account management

## [0.6.2] - 2026-06-22

A bug-fix and maintenance release.

### Fixed

- **Windows: the CLI exited silently** (#13). The entry-point guard
  (`isMainModule`) realpath-resolved only `argv[1]` and compared `file://` URLs
  by exact string, so on Windows a drive-letter case mismatch (`file:///c:/…`
  vs `file:///C:/…`) made the guard return `false` and `main()` never ran — the
  `atproto-mcp` binary produced no output and 25 spawn-based tests failed. Both
  the module URL and the invoked path are now realpath-resolved and compared
  case-insensitively on Windows.

### Changed

- Refresh dependencies to their latest in-range versions (`@atproto/api`
  0.20.16, `typescript-eslint` 8.61.1, `vitest` 4.1.9, `lint-staged` 17.0.8,
  `@types/node` 25.9.4).

## [0.6.1] - 2026-06-22

A maintenance and security release. The tool surface and public API are
unchanged; this clears a transitive advisory and moves the toolchain to the
current major versions.

### Security

- Force `hono >= 4.12.25` via a pnpm override to resolve advisory
  GHSA-88fw-hqm2-52qc, pulled in transitively through
  `@modelcontextprotocol/sdk` and `@hono/node-server`.

### Changed

- Upgrade to **zod 4**. Tool input schemas are now generated with zod's native
  `z.toJSONSchema` (draft-7, input shape) instead of the `zod-to-json-schema`
  library, which is removed.
- Upgrade to **TypeScript 6** and **ESLint 10** (with `@eslint/js` 10). Errors
  caught and rethrown are now chained via `cause` (ESLint 10
  `preserve-caught-error`).
- Bump pinned GitHub Actions: `actions/checkout` v6, `pnpm/action-setup` v6,
  `actions/deploy-pages` v5, `softprops/action-gh-release` v3.
- Refresh remaining dependencies to their latest in-range versions.

## [0.6.0] - 2026-06-11

This release expands the server's surface: direct messages, bookmarks,
starter packs, reply/quote controls, parameterized resources, argument
completions, and an HTTP transport option. The tool count goes from 43 to 51.

### Added

- **Direct messages** — `list_conversations`, `get_conversation_messages`,
  and `send_direct_message` via the Bluesky chat service. Messages can be
  sent to a conversation id or straight to a handle/DID. Requires an app
  password created with direct-message access; the error message says so
  when it isn't.
- **Bookmarks** — `add_bookmark`, `remove_bookmark`, and `get_bookmarks`
  for the private bookmark stash, with honest already-bookmarked flags.
- **Starter packs** — `search_starter_packs` and `get_starter_pack`
  (accepts `at://` URIs and `bsky.app` share links); both work
  unauthenticated.
- **Reply and quote controls** — `create_post` accepts `replyControls`
  (mentioned/following/followers/list rules) and `quoteControls`, written
  as threadgate/postgate records; `create_thread` applies reply controls
  to the root post.
- **Resource templates** — `atproto://profile/{actor}` and
  `atproto://feed/{actor}` let MCP clients read any actor's public profile
  or feed as a resource, unauthenticated.
- **Completions** — the server declares the completions capability and
  serves suggestions for prompt arguments and the template `{actor}`.
- **Streamable HTTP transport** — `--transport http` serves MCP over
  `/mcp` with per-session transports and DNS-rebinding protection,
  binding loopback by default; stdio remains the default.

### Changed

- Dependency refresh: `@atproto/api` 0.17.7 → 0.20.14 (one internal cast
  loosened; no behavioral changes surfaced by the suite), plus minor/patch
  updates across the toolchain (TypeScript 5.9.3, typescript-eslint 8.61,
  prettier 3.8, lint-staged 17, `@types/node` 25).

### Removed

- The dead `FirehoseClient` and the `ws` production dependency. Frame
  decoding was never implemented and the streaming tools were already
  removed in 0.4.0; a future Jetstream integration would be written fresh.

### Planned

- OAuth token exchange (the `oauth-client` scaffolding is in place)
- DM rich text, embeds, and conversation management (mute/accept/leave)
- Group/community features
- Custom feed generator integration
- Multi-account management

## [0.5.0] - 2026-06-11

This release is driven by a full end-to-end audit of the server. It fixes the
broken `npx` launch path, makes image posting work for the first time over MCP,
completes the video publishing pipeline through the `app.bsky.video` service,
and hardens dozens of verified defects across tools, session handling, CI, and
the MCP protocol surface.

### Fixed

- **`npx atproto-mcp` silently failed to start.** The ESM entry guard compared
  the realpath-resolved module URL against the literal symlink path npm
  installs in `node_modules/.bin`, so the published bin exited 0 without
  output. The same guard made the Docker health check fail open.
- **Image posting now works end-to-end.** `create_post` image embeds,
  `update_profile` avatar/banner, and `analyze_image` accept the blob
  descriptor `upload_image` returns (the previous `Blob`-typed parameters
  could never be satisfied over JSON-RPC). External link embeds accept the
  thumbnail `generate_link_preview` uploads.
- `analyze_account` no longer attributes reposted (other authors') posts to
  the analyzed account, and engagement rates floor the post-age denominator so
  brand-new posts cannot dominate averages.
- `update_profile` no longer rebuilds the profile from scratch when reading
  the current profile fails transiently, and field limits count graphemes per
  the lexicon instead of UTF-16 code units.
- `create_thread` validates every post before publishing any, so a
  predictable limit violation cannot orphan a partial thread.
- Rich-text facets: explicit byte offsets must fall on UTF-8 codepoint
  boundaries, and mention/hashtag values are normalized (leading `@`/`#`
  stripped). Reply references (in `create_post` and `reply_to_post`) must
  point at `app.bsky.feed.post` records, and `delete_post` resolves handle
  authorities before its ownership check.
- `discover`: the `actor` parameter now actually tailors recommendations, and
  `limit` governs the number of items returned rather than silently resizing
  the analysis sample.
- `find_influential_users` ranks the full candidate pool instead of an
  arbitrary first-40 slice; `find_similar_users` batches and parallelizes its
  reads; `batch_action` hydrates all targets in one `getPosts`/`getProfiles`
  call instead of one read per target.
- `get_notifications` reports the full set of notification reasons the API
  returns (the narrower enum made strict MCP clients reject valid responses).
- `remove_from_list` distinguishes "list too large to scan" from a definitive
  "not in list" past its 5,000-member pagination cap.
- Session lifecycle: an expired session is invalidated immediately and a
  failed recovery no longer permanently wedges authenticated calls;
  `authenticate()` is single-flighted; OAuth client instances no longer leak
  their keepalive interval; the session-refresh branch actually executes.
- MCP protocol: unknown resources return `-32002`,
  `resources/templates/list` is handled, binary resource content passes
  through as base64, prompts work unauthenticated (they are pure text
  templates) and enforce their required arguments, and startup errors are no
  longer masked by cleanup failures.

### Added

- **Video publishing.** `upload_video` follows the official `app.bsky.video`
  flow — upload-quota preflight, service auth, processing-job polling — and
  returns the processed video blob; `create_post` gains an `embed.video`
  variant (captions, alt text, aspect ratio).
- Per-tool MCP annotations (`destructiveHint`, `idempotentHint`) verified
  against each implementation, so spec-compliant clients no longer treat
  every write tool as destructive and non-idempotent. A completeness test
  keeps the map in sync with the roster.
- Faithful `outputSchema` declarations for `analyze_account` and `discover`.
- An `exports` map in `package.json`, and a slimmer npm package: test code
  and source maps that referenced missing files are no longer shipped
  (179 → 87 files).
- CI hardening: the nightly authenticated job fails loudly when credentials
  are missing, release changelogs see full git history, workflows declare
  least-privilege permissions, and Dependabot watches npm and GitHub Actions.
- Test files are now type-checked and linted in CI; behavioral coverage was
  added for the list-management, timeline, user-summary, and video tools.

### Changed (BREAKING)

- CLI: `-h` now prints help (it was previously the short flag for `--host`).
  Use `-H` or `--host` to set the host.
- The `conversation-context` resource was removed. MCP has no resource-write
  mechanism, so it could only ever return empty data; the server now
  advertises 3 resources.
- `like_post`/`repost`: the result `cid` is now optional and absent when the
  action already existed (it was previously an empty string).
- `upload_video` output changed shape: it returns the processed video blob
  descriptor plus `jobId` from the video service. The old raw-blob upload
  never produced playable video and usually failed against the PDS blob cap.

### Planned

- OAuth token exchange (the `oauth-client` scaffolding is in place)
- Firehose frame decoding to enable real-time streaming (or Jetstream)
- Direct messaging support (`chat.bsky.convo`)
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
