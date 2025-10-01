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
- Advanced analytics and insights
- Custom feed generator integration
- Multi-account management
- WebSocket streaming improvements

## [0.1.0] - 2024-01-15

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

## [0.0.1] - 2024-01-01

### Added
- Initial project setup
- Basic MCP server implementation
- AT Protocol integration using @atproto/api
- Core tool implementations
- Basic authentication support
- Development environment setup

---

## Release Notes

### Version 0.1.0 - Initial Release

This is the first public release of the AT Protocol MCP Server. It provides a comprehensive, production-ready implementation of the Model Context Protocol for AT Protocol integration.

#### Key Highlights

**🔓 Works Without Authentication**
- Access public AT Protocol data without any setup
- Perfect for LLM clients that need read-only access
- Search posts, view profiles, browse feeds - all without credentials

**🔐 Optional Authentication**
- Enable full functionality with app passwords
- Create posts, follow users, manage content
- OAuth support coming soon

**🏗️ Production Ready**
- Docker and Kubernetes support
- Monitoring with Prometheus and Grafana
- Comprehensive error handling and logging
- Rate limiting and security features

**🧪 Well Tested**
- 122 tests with high coverage
- Unit and integration tests
- Continuous integration with GitHub Actions

**📚 Comprehensive Documentation**
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
| 0.1.0 | 2024-01-15 | Initial public release |
| 0.0.1 | 2024-01-01 | Internal development version |

## Upcoming Releases

### v0.2.0 (Planned: Q1 2024)

**Focus**: OAuth and Enhanced Media Support

- OAuth 2.0 authentication
- Video upload and streaming
- Enhanced image handling
- Improved error messages
- Performance optimizations

### v0.3.0 (Planned: Q2 2024)

**Focus**: Advanced Features

- Direct messaging support
- Group/community features
- Advanced search capabilities
- Custom feed integration
- Analytics and insights

### v1.0.0 (Planned: Q3 2024)

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

[Unreleased]: https://github.com/cameronrye/atproto-mcp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/cameronrye/atproto-mcp/releases/tag/v0.1.0
[0.0.1]: https://github.com/cameronrye/atproto-mcp/releases/tag/v0.0.1

