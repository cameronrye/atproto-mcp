# Changelog

All notable changes to the AT Protocol MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- OAuth 2.0 authentication support
- Video upload and streaming
- Direct messaging support
- Group/community features
- Custom feed generator integration
- Multi-account management
- WebSocket streaming improvements

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
- `atproto://conversation-context` - Track conversation state across LLM interactions

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
- 30+ MCP tools for AT Protocol operations
- 3 MCP resources for context
- 2 MCP prompts for content assistance
- Production-ready features (Docker, Kubernetes, monitoring)
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

[Unreleased]: https://github.com/cameronrye/atproto-mcp/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/cameronrye/atproto-mcp/releases/tag/v0.1.1
[0.1.0]: https://github.com/cameronrye/atproto-mcp/releases/tag/v0.1.0
[0.0.1]: https://github.com/cameronrye/atproto-mcp/releases/tag/v0.0.1

