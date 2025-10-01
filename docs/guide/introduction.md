# Introduction

Welcome to the AT Protocol MCP Server documentation! This comprehensive guide will help you understand and integrate the AT Protocol ecosystem with Large Language Models (LLMs) through the Model Context Protocol (MCP).

## What is AT Protocol MCP Server?

The AT Protocol MCP Server is a production-ready implementation that bridges the gap between LLMs and the AT Protocol ecosystem. It provides a standardized interface for LLMs to interact with decentralized social networks like Bluesky, enabling seamless integration of social networking capabilities into AI applications.

## Key Features

### 🔓 Unauthenticated Mode
One of the standout features is the ability to work **without authentication**. This makes it perfect for:
- LLM clients that need to access public AT Protocol data
- Quick prototyping and development
- Read-only applications
- Public data analysis and research

Available operations without authentication:
- Search posts and hashtags
- View user profiles and follower lists
- Browse public feeds and threads
- Access public timelines

### 🔐 Optional Authentication
When you need full functionality, authentication unlocks:
- Creating, editing, and deleting posts
- Following and unfollowing users
- Liking and reposting content
- Accessing personalized timelines and notifications
- Managing lists and moderation settings

### 🏗️ Architecture

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

MCP is a standardized protocol for connecting LLMs with external data sources and tools. It provides:

- **Tools**: Executable functions that LLMs can call (e.g., create_post, search_posts)
- **Resources**: Data sources that LLMs can read (e.g., timeline, profile, notifications)
- **Prompts**: Pre-configured templates for common tasks (e.g., content composition, reply generation)

### AT Protocol

The Authenticated Transfer Protocol (AT Protocol) is a decentralized social networking protocol that powers Bluesky and other applications. Key features include:

- **Decentralization**: Users own their data and identity
- **Portability**: Move between services without losing your social graph
- **Interoperability**: Different apps can work with the same data
- **Open Standards**: Built on open protocols and specifications

## Why Use This Server?

### For Developers

- **Type-Safe**: Written in TypeScript with comprehensive type definitions
- **Well-Tested**: Extensive test coverage with unit and integration tests
- **Production-Ready**: Includes monitoring, logging, and error handling
- **Extensible**: Easy to add custom tools and resources
- **Well-Documented**: Comprehensive documentation and examples

### For LLM Applications

- **Seamless Integration**: Works with any MCP-compatible LLM client
- **Rich Functionality**: Access to all major AT Protocol operations
- **Real-Time Data**: Support for streaming and live updates
- **Flexible Authentication**: Works with or without authentication
- **Rate Limiting**: Built-in respect for API rate limits

### For Researchers

- **Public Data Access**: No authentication needed for public data
- **Comprehensive Search**: Advanced search capabilities with filters
- **Data Export**: Easy access to structured social media data
- **Ethical**: Respects user privacy and platform guidelines

## Use Cases

### Social Media Automation
Automate posting schedules, content distribution, and engagement tracking across the AT Protocol ecosystem.

### Content Analysis
Analyze trends, sentiment, and user behavior on decentralized social networks for research or business intelligence.

### Community Management
Manage communities, moderate content, and engage with users through AI-powered tools.

### Bot Development
Create intelligent social media bots that can understand context and respond naturally to users.

### Data Integration
Integrate AT Protocol data with other systems, databases, or analytics platforms.

### Research & Analytics
Conduct social media research, track conversations, and analyze network dynamics.

## Getting Started

Ready to dive in? Here's what to do next:

1. **[Installation](./installation.md)** - Install the server and dependencies
2. **[Quick Start](./getting-started.md)** - Get up and running in minutes
3. **[Configuration](./configuration.md)** - Configure the server for your needs
4. **[Authentication](./authentication.md)** - Set up authentication (optional)
5. **[API Reference](../api/tools.md)** - Explore available tools and resources

## Community & Support

- **GitHub**: [cameronrye/atproto-mcp](https://github.com/cameronrye/atproto-mcp)
- **Issues**: [Report bugs or request features](https://github.com/cameronrye/atproto-mcp/issues)
- **Discussions**: [Ask questions and share ideas](https://github.com/cameronrye/atproto-mcp/discussions)
- **Contributing**: [Contribution guidelines](../contributing.md)

## License

This project is released under the MIT License, making it free to use, modify, and distribute.

## Acknowledgments

This project builds on the excellent work of:
- The [AT Protocol team](https://github.com/bluesky-social/atproto) for creating the protocol and SDK
- [Anthropic](https://github.com/modelcontextprotocol) for developing the Model Context Protocol
- The open-source community for inspiration and contributions

---

**Next**: Learn how to [install the server](./installation.md) →

