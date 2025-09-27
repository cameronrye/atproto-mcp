# AT Protocol MCP Server

[![npm version](https://badge.fury.io/js/atproto-mcp.svg)](https://badge.fury.io/js/atproto-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tests](https://github.com/cameronrye/atproto-mcp/actions/workflows/test.yml/badge.svg)](https://github.com/cameronrye/atproto-mcp/actions/workflows/test.yml)
[![Coverage](https://codecov.io/gh/cameronrye/atproto-mcp/branch/main/graph/badge.svg)](https://codecov.io/gh/cameronrye/atproto-mcp)

A comprehensive Model Context Protocol (MCP) server that provides LLMs with direct access to the AT Protocol ecosystem, enabling seamless interaction with Bluesky and other AT Protocol-based social networks.

## 🚀 Features

- **Complete AT Protocol Integration**: Full implementation using official `@atproto/api`
- **MCP Server Compliance**: Built with `@modelcontextprotocol/sdk` following MCP specification
- **Type-Safe**: Written in TypeScript with strict type checking
- **Comprehensive Tools**: Rich set of MCP tools for social networking operations
- **Real-time Support**: WebSocket connections for live data streams
- **Authentication**: Secure OAuth and app password authentication flows
- **Rate Limiting**: Built-in respect for AT Protocol rate limits
- **Extensible**: Modular architecture for easy customization

## 📦 Installation

```bash
npm install -g atproto-mcp
```

Or use with npx:

```bash
npx atproto-mcp
```

## 🔧 Quick Start

1. **Start the MCP server:**
   ```bash
   atproto-mcp --port 3000
   ```

2. **Configure your LLM client** to connect to the MCP server at `http://localhost:3000`

3. **Authenticate** with AT Protocol using your preferred method:
   - App passwords (recommended for development)
   - OAuth flow (recommended for production)

## 🛠️ Available Tools

### Social Operations
- `create_post` - Create new posts with rich text support
- `reply_to_post` - Reply to existing posts with threading
- `like_post` - Like posts and manage reactions
- `repost` - Repost content with optional quotes
- `follow_user` - Follow and unfollow users
- `get_timeline` - Retrieve user timelines and feeds

### Content Management
- `upload_blob` - Upload images and media content
- `delete_post` - Remove posts and content
- `update_profile` - Modify user profiles and settings

### Data Retrieval
- `search_posts` - Search for posts and content
- `get_user_profile` - Retrieve user information
- `get_followers` - Get follower and following lists
- `get_notifications` - Access notification feeds

## 📚 Documentation

Visit our [documentation site](https://cameronrye.github.io/atproto-mcp) for:

- **Getting Started Guide**
- **API Reference**
- **Configuration Options**
- **Examples and Tutorials**
- **Troubleshooting**

## 🔐 Authentication

### App Passwords (Development)
```bash
export ATPROTO_IDENTIFIER="your-handle.bsky.social"
export ATPROTO_PASSWORD="your-app-password"
atproto-mcp
```

### OAuth (Production)
```bash
export ATPROTO_CLIENT_ID="your-client-id"
export ATPROTO_CLIENT_SECRET="your-client-secret"
atproto-mcp --auth oauth
```

## 🧪 Development

```bash
# Clone the repository
git clone https://github.com/cameronrye/atproto-mcp.git
cd atproto-mcp

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [AT Protocol Team](https://github.com/bluesky-social/atproto) for the excellent protocol and SDK
- [Anthropic](https://github.com/modelcontextprotocol) for the Model Context Protocol
- The open source community for inspiration and contributions

## 📞 Support

- 📖 [Documentation](https://cameronrye.github.io/atproto-mcp)
- 🐛 [Issue Tracker](https://github.com/cameronrye/atproto-mcp/issues)
- 💬 [Discussions](https://github.com/cameronrye/atproto-mcp/discussions)

---

Made with ❤️ for the AT Protocol and MCP communities
