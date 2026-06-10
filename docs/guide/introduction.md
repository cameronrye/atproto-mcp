# Introduction

Welcome to the AT Protocol MCP Server documentation! This comprehensive guide
will help you understand and integrate the AT Protocol ecosystem with Large
Language Models (LLMs) through the Model Context Protocol (MCP).

## What is AT Protocol MCP Server?

The AT Protocol MCP Server is a production-ready implementation that bridges the
gap between LLMs and the AT Protocol ecosystem. It provides a standardized
interface for LLMs to interact with decentralized social networks like Bluesky,
enabling seamless integration of social networking capabilities into AI
applications.

## Key Features

### Unauthenticated Mode

The server runs **without authentication**, but only a small set of public tools
work in this mode. This makes it useful for:

- Viewing public profile information
- Inspecting social graphs and post context
- Quick prototyping before setting up authentication

Available operations without authentication:

- `get_user_profile` — view public profiles (returns additional data when
  authenticated)
- `get_user_connections` — view social graphs via
  `direction: 'followers' | 'follows'` (richer viewer-state data when
  authenticated)
- `search_actors` / `get_author_feed` — find accounts and list a user's posts
- `analyze_image` — report an image blob's declared size and MIME type
- `get_post_context`, `find_similar_users`, and other public/enhanced discovery
  tools

`search_posts` requires authentication — the AT Protocol search API changed in
2025 to require auth — so it does **not** work in unauthenticated mode. Most
other tools also require authentication. See
[Authentication](./authentication.md) for setup.

### Optional Authentication

When you need full functionality, authentication unlocks:

- Creating, editing, and deleting posts
- Following and unfollowing users
- Liking and reposting content
- Searching posts and content
- Accessing personalized timelines and notifications
- Viewing social graphs (followers, follows)
- Reading threads and custom feeds
- Managing lists and moderation settings
- Analytics and discovery tools
- Batch operations and advanced features

### Architecture

The server follows a clean, modular architecture:

```
┌─────────────────┐
│   LLM Client    │
│  (Claude, etc)  │
└────────┬────────┘
         │
         │ MCP Protocol
         │ (JSON-RPC 2.0)
         │
┌────────▼────────┐
│  MCP Server     │
│  - Tools        │
│  - Resources    │
│  - Prompts      │
└────────┬────────┘
         │
         │ AT Protocol API
         │ (@atproto/api)
         │
┌────────▼────────┐
│  AT Protocol    │
│  - Bluesky      │
│  - Custom PDS   │
│  - Other Apps   │
└─────────────────┘
```

## Core Concepts

### Model Context Protocol (MCP)

MCP is a standardized protocol for connecting LLMs with external data sources
and tools. It provides:

- **Tools**: Executable functions that LLMs can call (e.g., create_post,
  search_posts)
- **Resources**: Data sources that LLMs can read (e.g., timeline, profile,
  notifications)
- **Prompts**: Pre-configured templates for common tasks (e.g., content
  composition, reply generation)

### AT Protocol

The Authenticated Transfer Protocol (AT Protocol) is a decentralized social
networking protocol that powers Bluesky and other applications. Key features
include:

- **Decentralization**: Users own their data and identity
- **Portability**: Move between services without losing your social graph
- **Interoperability**: Different apps can work with the same data
- **Open Standards**: Built on open protocols and specifications

## Why Use This Server?

### For LLM Clients

This server is designed to be consumed by **LLM clients** (like Claude Desktop)
via the MCP protocol:

- **Seamless Integration**: Works with any MCP-compatible LLM client
- **Rich Functionality**: Access to all major AT Protocol operations through
  natural language
- **Flexible Authentication**: Works with or without authentication
- **Rate Limiting**: Built-in respect for API rate limits
- **Natural Language Interface**: Users interact in plain language; LLMs handle
  the protocol

### For Developers Extending the MCP Server

If you want to **deploy, customize, or contribute** to this MCP server:

- **Type-Safe**: Written in TypeScript with comprehensive type definitions
- **Well-Tested**: Extensive test coverage with unit and integration tests
- **Production-Ready**: Includes monitoring, logging, and error handling
- **Extensible**: Easy to add custom MCP tools and resources
- **Well-Documented**: Comprehensive documentation and examples
- **Modular Architecture**: Clean separation of concerns for easy customization

**Note**: This is for developers who want to extend the MCP server itself, not
for developers building applications that directly call AT Protocol APIs. If
you're building a traditional application, use the official `@atproto/api`
package directly.

### For Researchers

If you're using LLM clients for research:

- **Public Data Access**: Profile lookups, social-graph reads, and post-context
  tools work without authentication
- **Search**: Search posts with filters via natural language (requires
  authentication, since the AT Protocol search API changed in 2025 to require
  auth)
- **Data Export**: Easy access to structured social media data through LLM
  queries
- **Ethical**: Respects user privacy and platform guidelines
- **Conversational Interface**: Query data using natural language instead of
  code

## Use Cases

### Social Media Automation

Automate posting schedules, content distribution, and engagement tracking across
the AT Protocol ecosystem.

### Content Analysis

Analyze trends, sentiment, and user behavior on decentralized social networks
for research or business intelligence.

### Community Management

Manage communities, moderate content, and engage with users through AI-powered
tools.

### Bot Development

Create intelligent social media bots that can understand context and respond
naturally to users.

### Data Integration

Integrate AT Protocol data with other systems, databases, or analytics
platforms.

### Research & Analytics

Conduct social media research, track conversations, and analyze network
dynamics.

## Getting Started

Ready to dive in? Here's what to do next:

1. **[Installation](./installation.md)** - Install the server and dependencies
2. **[Quick Start](./getting-started.md)** - Get up and running in minutes
3. **[Configuration](./configuration.md)** - Configure the server for your needs
4. **[Authentication](./authentication.md)** - Set up authentication (optional)
5. **[API Reference](../api/index.md)** - Explore available tools and resources

## Community & Support

- **GitHub**:
  [cameronrye/atproto-mcp](https://github.com/cameronrye/atproto-mcp)
- **Issues**:
  [Report bugs or request features](https://github.com/cameronrye/atproto-mcp/issues)
- **Discussions**:
  [Ask questions and share ideas](https://github.com/cameronrye/atproto-mcp/discussions)
- **Contributing**: [Contribution guidelines](../contributing.md)

## License

This project is released under the MIT License, making it free to use, modify,
and distribute.

## Acknowledgments

This project builds on the excellent work of:

- The [AT Protocol team](https://github.com/bluesky-social/atproto) for creating
  the protocol and SDK
- [Anthropic](https://github.com/modelcontextprotocol) for developing the Model
  Context Protocol
- The open-source community for inspiration and contributions

---

**Next**: Learn how to [install the server](./installation.md) →
