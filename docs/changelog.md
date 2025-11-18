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

Perform multiple operations in a single call to reduce API round-trips and improve efficiency:

- `batch_follow` - Follow multiple users at once (up to 25 users per call)
  - Configurable error handling (continue on error or stop at first failure)
  - Detailed result tracking for each follow operation
  - Automatic DID resolution for handles
  - Detection of already-following relationships
- `batch_like` - Like multiple posts at once (up to 25 posts per call)
  - Bulk engagement operations
  - Individual success/failure tracking
  - Detection of already-liked posts
- `batch_repost` - Repost multiple posts at once (up to 25 posts per call)
  - Efficient content amplification
  - Per-operation result reporting
  - Detection of already-reposted content

**Analytics & Insights (4 new tools)**

Get AI-powered insights into engagement patterns and network dynamics:

- `analyze_engagement` - Analyze engagement patterns across posts
  - Average likes, reposts, replies, and quotes
  - Engagement rate calculations
  - Top performing posts identification
  - Time-based engagement trends
- `analyze_network` - Analyze user's network and connections
  - Follower/following ratio analysis
  - Mutual connections discovery
  - Network growth patterns
  - Relationship insights
- `suggest_content_strategy` - Get content strategy recommendations
  - AI-powered suggestions based on performance data
  - Best posting times analysis
  - Content type recommendations
  - Engagement optimization tips
- `find_influential_users` - Find influential users in a topic area
  - Follower count and engagement metrics
  - Topic relevance scoring
  - Network influence analysis
  - Community leader identification

**Content Discovery (3 new tools)**

Discover similar users, trending topics, and communities:

- `discover_trending` - Discover trending topics, hashtags, and posts
  - Real-time trend detection
  - Hashtag popularity tracking
  - Viral post identification
  - Topic momentum analysis
- `find_similar_users` - Find users similar to a given user
  - Profile similarity matching
  - Content pattern analysis
  - Interest overlap detection
  - Network proximity scoring
- `discover_communities` - Discover communities around specific topics
  - Topic-based community detection
  - Active participant identification
  - Community engagement metrics
  - Interest group discovery

**Conversation Context Resource**

New MCP resource for maintaining conversation state across LLM interactions:

- `atproto://conversation-context` - Track conversation state
  - Recently discussed posts with full context
  - Active threads being followed
  - Mentioned users and their profiles
  - Search query history
  - Recent actions log
  - Automatic context pruning (keeps most recent 50 items per category)
  - Helps LLMs maintain coherent, contextual responses

### Improved

**Testing & Quality**
- Expanded test suite to 282 tests (up from 122)
- Added comprehensive integration tests for all new features
- Improved test coverage across all modules
- Added real-world integration test scenarios

**Code Quality**
- Implemented strict interface naming conventions (all interfaces prefixed with `I`)
- Enhanced TypeScript type safety across the codebase
- Improved error handling and validation in all tools
- Stricter ESLint rules for better code consistency
- Better error messages and debugging information

**Documentation**
- Updated API documentation for all new tools
- Added usage examples for batch operations
- Documented analytics and insights capabilities
- Improved troubleshooting guides

### Fixed
- Interface naming convention compliance (9 interfaces renamed)
- Removed unused imports and variables
- Fixed error handling in catch blocks (changed to anonymous catches where appropriate)
- Resolved "only-throw-error" ESLint violations
- Prettier formatting consistency across all files
- TypeScript compilation errors after interface renames

## [0.1.0] - 2024-09-15

### Added
- Initial release of AT Protocol MCP Server
- **Unauthenticated mode** for public data access
- **App password authentication** for full functionality
- **30+ MCP tools** for AT Protocol operations
  - Social operations (create_post, like, repost, follow)
  - Data retrieval (search_posts, get_user_profile, get_timeline)
  - Content management (delete_post, update_profile, upload_image)
  - Moderation (mute_user, block_user, report_content)
  - Real-time streaming (start_streaming, get_recent_events)
  - OAuth management (start_oauth_flow, refresh_tokens)
- **3 MCP resources** for context
  - atproto://timeline - User timeline feed
  - atproto://profile - User profile information
  - atproto://notifications - Recent notifications
- **2 MCP prompts** for content assistance
  - content_composition - Help write engaging posts
  - reply_template - Generate thoughtful replies
- **Production-ready features**
  - Docker and Docker Compose support
  - Kubernetes deployment manifests
  - Prometheus metrics and Grafana dashboards
  - Health check endpoints
  - Comprehensive logging
  - Rate limiting and error handling
  - Connection pooling and caching
- **Type-safe implementation**
  - Written in TypeScript with strict type checking
  - Zod schema validation for all inputs
  - Comprehensive error types
- **Testing**
  - 122 unit and integration tests
  - High test coverage
  - Vitest test framework
- **Documentation**
  - Comprehensive README
  - Getting started guide
  - API reference
  - Deployment guide
  - Security policy
  - Contributing guidelines
  - Example code and tutorials

### Security
- Input validation and sanitization
- Rate limiting to prevent abuse
- Credential redaction in logs
- Non-root Docker containers
- HTTPS support for AT Protocol connections
- Error sanitization to prevent information leakage

## [0.0.1] - 2024-09-01

### Added
- Initial project setup
- Basic MCP server implementation
- AT Protocol integration using @atproto/api
- Core tool implementations
- Basic authentication support
- Development environment setup

---

## Release Notes

### Version 0.1.1 - Enhanced Capabilities

This release significantly expands the AT Protocol MCP Server's capabilities with powerful new features for batch operations, analytics, content discovery, and conversation tracking.

#### Key Highlights

**Batch Operations - Do More with Less**
- Perform up to 25 operations in a single call
- Follow, like, or repost multiple items at once
- Reduce API round-trips by up to 25x
- Configurable error handling for resilient operations
- Perfect for bulk content management and engagement

**Analytics & Insights - Data-Driven Decisions**
- Analyze engagement patterns across your posts
- Understand your network dynamics and growth
- Get AI-powered content strategy recommendations
- Find influential users in your areas of interest
- Make informed decisions about your social presence

**Content Discovery - Find Your Community**
- Discover trending topics and viral posts in real-time
- Find users similar to you or others you admire
- Identify communities around specific topics
- Expand your network strategically
- Stay on top of what's happening in your niche

**Conversation Context - Smarter LLM Interactions**
- New MCP resource tracks conversation state
- Maintains context of discussed posts and threads
- Remembers mentioned users and search history
- Helps LLMs provide more coherent, contextual responses
- Automatic pruning keeps context fresh and relevant

**Quality Improvements**
- 282 comprehensive tests (up from 122)
- Stricter code quality standards
- Better error handling and validation
- Improved documentation and examples

#### What's New

- **10 new MCP tools** (57 total, up from 47)
- **1 new MCP resource** (4 total, up from 3)
- **160 additional tests** for comprehensive coverage
- **Enhanced type safety** with strict interface conventions

#### Breaking Changes

None - this release is fully backward compatible with v0.1.0.

#### Upgrade Instructions

```bash
# Update to the latest version
npm update -g atproto-mcp

# Or reinstall
npm install -g atproto-mcp@latest
```

No configuration changes required. All new features are available immediately.

#### Known Issues

- OAuth authentication is not yet implemented (coming in v0.2.0)
- Video upload is not yet supported (coming in v0.2.0)
- Direct messaging is not yet available (planned for v0.3.0)

#### Contributors

Thank you to all contributors who made this release possible!

- Cameron Rye (@cameronrye) - Project creator and maintainer

---

### Version 0.1.0 - Initial Release

This is the first public release of the AT Protocol MCP Server. It provides a comprehensive, production-ready implementation of the Model Context Protocol for AT Protocol integration.

#### Key Highlights

**Works Without Authentication**
- Access public AT Protocol data without any setup
- Perfect for LLM clients that need read-only access
- Search posts, view profiles, browse feeds - all without credentials

**Optional Authentication**
- Enable full functionality with app passwords
- Create posts, follow users, manage content
- OAuth support coming soon

**Production Ready**
- Docker and Kubernetes support
- Monitoring with Prometheus and Grafana
- Comprehensive error handling and logging
- Rate limiting and security features

**Well Tested**
- 122 tests with high coverage
- Unit and integration tests
- Continuous integration with GitHub Actions

**Comprehensive Documentation**
- Getting started guide
- API reference
- Deployment guide
- Examples and tutorials

#### Breaking Changes

None - this is the initial release.

#### Migration Guide

Not applicable - this is the initial release.

#### Known Issues

- OAuth authentication is not yet implemented (coming in v0.2.0)
- Video upload is not yet supported (coming in v0.2.0)
- Direct messaging is not yet available (planned for v0.3.0)

#### Upgrade Instructions

Not applicable - this is the initial release.

#### Contributors

Thank you to all contributors who made this release possible!

- Cameron Rye (@cameronrye) - Project creator and maintainer

#### Acknowledgments

- AT Protocol team for the excellent protocol and SDK
- Anthropic for the Model Context Protocol
- The open-source community for inspiration and support

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 0.1.1 | 2025-11-18 | Batch operations, analytics, content discovery, conversation context |
| 0.1.0 | 2024-09-15 | Initial public release |
| 0.0.1 | 2024-09-01 | Internal development version |

## Upcoming Releases

### v0.2.0 (Planned: Q1 2025)

**Focus**: OAuth and Enhanced Media Support

- OAuth 2.0 authentication
- Video upload and streaming
- Enhanced image handling
- Improved error messages
- Performance optimizations

### v0.3.0 (Planned: Q2 2025)

**Focus**: Advanced Features

- Direct messaging support
- Group/community features
- Advanced search capabilities
- Custom feed integration

### v1.0.0 (Planned: Q3 2025)

**Focus**: Stability and Polish

- API stability guarantees
- Comprehensive documentation
- Production hardening
- Performance benchmarks
- Long-term support commitment

## Support

For questions, issues, or feature requests:

- **Issues**: [GitHub Issues](https://github.com/cameronrye/atproto-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/cameronrye/atproto-mcp/discussions)
- **Documentation**: [Full Documentation](https://cameronrye.github.io/atproto-mcp)

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

---

[Unreleased]: https://github.com/cameronrye/atproto-mcp/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/cameronrye/atproto-mcp/releases/tag/v0.1.1
[0.1.0]: https://github.com/cameronrye/atproto-mcp/releases/tag/v0.1.0
[0.0.1]: https://github.com/cameronrye/atproto-mcp/releases/tag/v0.0.1

