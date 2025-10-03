<div align="center">
  <img src="docs/public/logo.svg" alt="AT Protocol MCP Server Logo" width="200" height="200">

  # AT Protocol MCP Server

  [![npm version](https://badge.fury.io/js/atproto-mcp.svg)](https://badge.fury.io/js/atproto-mcp)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Tests](https://github.com/cameronrye/atproto-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/cameronrye/atproto-mcp/actions/workflows/ci.yml)
  [![Coverage](https://codecov.io/gh/cameronrye/atproto-mcp/branch/main/graph/badge.svg)](https://codecov.io/gh/cameronrye/atproto-mcp)
</div>

A comprehensive Model Context Protocol (MCP) server that provides LLMs with direct access to the AT Protocol ecosystem, enabling seamless interaction with Bluesky and other AT Protocol-based social networks.

**🎯 Supports both authenticated and unauthenticated modes** - Start immediately with public data access (search posts, view profiles), or add authentication for full functionality (write operations, private data, feeds).

## 🏗️ Architecture

This MCP server acts as a bridge between LLM clients and the AT Protocol ecosystem:

```
┌─────────────────┐
│      User       │  "Search for posts about AI"
└────────┬────────┘
         │ Natural Language
         ▼
┌─────────────────┐
│   LLM Client    │  (Claude Desktop, etc.)
│  (MCP Client)   │
└────────┬────────┘
         │ MCP Protocol (JSON-RPC 2.0)
         ▼
┌─────────────────┐
│   This Server   │  AT Protocol MCP Server
│  (MCP Server)   │  - Tools, Resources, Prompts
└────────┬────────┘
         │ AT Protocol API
         ▼
┌─────────────────┐
│  AT Protocol    │  Bluesky, Custom PDS, etc.
│   Ecosystem     │
└─────────────────┘
```

**Key Point**: Users don't interact with this server directly. Instead, they talk to their LLM client in natural language, and the LLM client uses this MCP server to access AT Protocol functionality.

## 🚀 Features

- **🔓 Unauthenticated Mode**: Access public data without any setup - search posts and view basic profiles
- **🔐 Optional Authentication**: Enable full functionality with app passwords or OAuth for write operations, feeds, and private data
- **Complete AT Protocol Integration**: Full implementation using official `@atproto/api`
- **MCP Server Compliance**: Built with `@modelcontextprotocol/sdk` following MCP specification
- **Type-Safe**: Written in TypeScript with strict type checking
- **Comprehensive Tools**: 30+ MCP tools for social networking operations
- **Real-time Support**: WebSocket connections for live data streams
- **Rate Limiting**: Built-in respect for AT Protocol rate limits
- **Extensible**: Modular architecture for easy customization

## 🎯 Who Is This For?

### Primary Audience: LLM Clients

This is an **MCP (Model Context Protocol) server** designed to be consumed by **LLM clients** such as:
- Claude Desktop
- Other MCP-compatible AI assistants
- Custom LLM applications using the MCP SDK

**How it works:**
```
User → LLM Client (Claude Desktop) → MCP Protocol → This Server → AT Protocol → Bluesky
```

Users interact with their LLM client in natural language (e.g., "search for posts about AI"), and the LLM client uses this MCP server to fulfill those requests by calling the appropriate tools via the MCP protocol.

### Secondary Audience: Developers

This project is also for developers who want to:
- **Deploy** the MCP server for their LLM clients to connect to
- **Extend** the server with custom MCP tools and resources
- **Contribute** to the open-source project

### ⚠️ This Is NOT:

- ❌ A direct-use REST API or SDK for application developers
- ❌ A JavaScript/TypeScript library to import into your app
- ❌ An end-user application

If you're building an application that needs AT Protocol functionality, you should either:
1. Use the official `@atproto/api` package directly, OR
2. Build an LLM-powered application that uses this MCP server through an LLM client

## 📦 Installation

```bash
npm install -g atproto-mcp
```

Or use with npx:

```bash
npx atproto-mcp
```

## 🔧 Quick Start

### Option 1: Unauthenticated Mode (Recommended for most use cases)

**Perfect for LLM clients that need to access public AT Protocol data:**

1. **Configure your LLM client** (e.g., Claude Desktop) to launch the MCP server:

   Add to your LLM client's MCP configuration:
   ```json
   {
     "mcpServers": {
       "atproto": {
         "command": "npx",
         "args": ["atproto-mcp"]
       }
     }
   }
   ```

2. **Start your LLM client** - it will automatically launch the MCP server

3. **Interact in natural language** - Ask your LLM to search posts, view profiles, etc.

**What your LLM can do in unauthenticated mode:**
- ✅ View user profiles (`get_user_profile` - works without auth, provides additional viewer-specific data when authenticated)
- ✅ Manage OAuth authentication flows (`start_oauth_flow`, `handle_oauth_callback`, `refresh_oauth_tokens`, `revoke_oauth_tokens`)

**Note:** The following features require authentication:
- ❌ Searching posts and hashtags (`search_posts`) - **API changed in 2025 to require authentication**
- ❌ Viewing follower/following lists (`get_followers`, `get_follows`)
- ❌ Browsing feeds and threads (`get_thread`, `get_custom_feed`, `get_timeline`)
- ❌ All write operations (create, like, repost, follow, etc.)
- ❌ Resources (timeline, profile, notifications) - these are listed but will return an error when accessed without authentication
- ❌ Prompts (content composition, reply templates) - these are listed but will return an error when accessed without authentication

**Important:** All tools, resources, and prompts are listed by the MCP server regardless of authentication state. Tools and resources that require authentication will return a clear error message when called without proper credentials.

### Option 2: Authenticated Mode (For full functionality)

**Enable write operations and private data access for your LLM:**

1. **Configure your LLM client** with AT Protocol credentials:

   ```json
   {
     "mcpServers": {
       "atproto": {
         "command": "npx",
         "args": ["atproto-mcp"],
         "env": {
           "ATPROTO_IDENTIFIER": "your-handle.bsky.social",
           "ATPROTO_PASSWORD": "your-app-password"
         }
       }
     }
   }
   ```

2. **Start your LLM client** - it will launch the authenticated MCP server

**What your LLM can do in authenticated mode:**
- ✅ Create, edit, and delete posts
- ✅ Follow/unfollow users
- ✅ Like and repost content
- ✅ Access personalized timelines and notifications
- ✅ Manage lists and moderation settings

## 🛠️ Available Tools

The server provides **30+ MCP tools** across multiple categories. See the [complete API documentation](https://cameronrye.github.io/atproto-mcp/api/) for detailed information on each tool.

### 🔓 Public Tools (No Authentication Required)

**Data Retrieval**
- `get_user_profile` - Retrieve basic user information (ENHANCED mode: works without auth, provides additional viewer-specific data when authenticated)

**OAuth Management**
- `start_oauth_flow` - Initiate OAuth authentication
- `handle_oauth_callback` - Complete OAuth flow
- `refresh_oauth_tokens` - Refresh authentication tokens
- `revoke_oauth_tokens` - Revoke OAuth tokens

**Note:** As of 2025, the AT Protocol API has changed to require authentication for most endpoints that were previously public, including `search_posts`.

### 🔐 Private Tools (Authentication Required)

**Social Operations**
- `create_post` - Create new posts with rich text support
- `create_rich_text_post` - Create posts with advanced formatting
- `reply_to_post` - Reply to existing posts with threading
- `like_post` / `unlike_post` - Like and unlike posts
- `repost` / `unrepost` - Repost content with optional quotes
- `follow_user` / `unfollow_user` - Follow and unfollow users

**Data Retrieval**
- `search_posts` - Search for posts and content across the network (⚠️ API changed in 2025 to require auth)
- `get_followers` - Get follower lists
- `get_follows` - Get following lists
- `get_thread` - View post threads and conversations
- `get_custom_feed` - Access custom feeds
- `get_timeline` - Retrieve personalized timelines
- `get_notifications` - Access notification feeds

**Content Management**
- `upload_image` / `upload_video` - Upload media content
- `delete_post` - Remove posts
- `update_profile` - Modify profile and settings
- `generate_link_preview` - Generate link previews for posts

**List Management**
- `create_list` - Create user lists
- `add_to_list` / `remove_from_list` - Manage list members
- `get_list` - Retrieve list information

**Moderation**
- `mute_user` / `unmute_user` - Mute and unmute users
- `block_user` / `unblock_user` - Block and unblock users
- `report_content` / `report_user` - Report content and users

**Real-time Streaming**
- `start_streaming` - Start real-time event stream
- `stop_streaming` - Stop event stream
- `get_streaming_status` - Check streaming status
- `get_recent_events` - Retrieve recent events

## 📚 Documentation

Visit our [documentation site](https://cameronrye.github.io/atproto-mcp) for:

- **Getting Started Guide**
- **API Reference**
- **Configuration Options**
- **Examples and Tutorials**
- **Troubleshooting**

## 🔐 Authentication (Optional)

The server works perfectly without authentication for accessing public data. Authentication is only needed for write operations and private data access.

### App Passwords (Recommended for Development)
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

### Quick Start

```bash
# Clone the repository
git clone https://github.com/cameronrye/atproto-mcp.git
cd atproto-mcp

# Install dependencies (use pnpm, npm, or yarn)
pnpm install  # or: npm install

# Start development server
pnpm dev      # or: npm run dev

# Run tests
pnpm test     # or: npm test

# Build for production
pnpm build    # or: npm run build
```

### Available Commands

This project provides cross-platform npm scripts that work on Windows, macOS, and Linux:

```bash
# Show all available commands
npm run help

# Development
npm run dev              # Start development server with hot reload
npm run build            # Build for production
npm run start            # Start production server

# Testing & Quality
npm test                 # Run tests
npm run test:coverage    # Run tests with coverage
npm run test:ui          # Run tests with interactive UI

# Integration Tests (connects to real AT Protocol servers)
npm run test:integration

npm run lint             # Run ESLint
npm run lint:fix         # Fix linting issues
npm run format           # Format code with Prettier
npm run type-check       # Run TypeScript type checking
npm run check            # Run all quality checks

# Utilities
npm run clean            # Clean build artifacts
npm run clean:all        # Clean everything including node_modules
npm run status           # Show project status
npm run ci               # Run full CI pipeline locally

# Dependencies
npm run deps:update      # Update dependencies
npm run deps:audit       # Audit for security issues
```

### Cross-Platform Compatibility

All build commands work on **Windows, macOS, and Linux** without requiring additional tools.
Simply use npm scripts on any platform (e.g., `npm run dev`, `npm test`, `npm run build`).

## 🧪 Testing

The project includes comprehensive test coverage:

### Unit Tests

```bash
# Run all unit tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run with interactive UI
pnpm test:ui
```

### Integration Tests

Comprehensive integration tests that connect to real AT Protocol servers to validate all public-facing functionality:

```bash
# Run integration tests (requires internet connection)
npm run test:integration
```

**What's tested:**
- ✅ All public tools (search_posts, get_user_profile, get_followers, get_follows, get_thread, get_custom_feed)
- ✅ DID and handle resolution
- ✅ Pagination support
- ✅ Error handling
- ✅ AT Protocol specification compliance
- ✅ Rate limiting behavior

**Note:** Integration tests are opt-in and disabled by default to avoid hitting real servers during normal development. See [Integration Tests Documentation](src/__tests__/INTEGRATION_TESTS.md) for details.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [AT Protocol Team](https://github.com/bluesky-social/atproto) for the excellent protocol and SDK
- [Anthropic](https://github.com/modelcontextprotocol) for the Model Context Protocol
- The open source community for inspiration and contributions

## 📞 Support

- 📖 [Documentation](https://cameronrye.github.io/atproto-mcp)
- 🐛 [Issue Tracker](https://github.com/cameronrye/atproto-mcp/issues)
- 💬 [Discussions](https://github.com/cameronrye/atproto-mcp/discussions)

## 🏭 Production Deployment

The AT Protocol MCP Server is production-ready with comprehensive features for enterprise deployment:

### Production Features
- **Performance Optimization**: Connection pooling, caching, and WebSocket management
- **Security Hardening**: Input sanitization, rate limiting, and secure credential storage
- **Monitoring**: Health checks, metrics, and comprehensive logging
- **Docker Support**: Multi-stage builds with security best practices
- **Kubernetes Ready**: Helm charts and deployment manifests
- **Observability**: Prometheus metrics and Grafana dashboards

### Docker Deployment
```bash
# Quick start with Docker Compose
docker-compose up -d

# Or build and run manually
docker build -t atproto-mcp .
docker run -d -p 3000:3000 \
  -e ATPROTO_IDENTIFIER=your.handle \
  -e ATPROTO_PASSWORD=your-password \
  atproto-mcp
```

### Environment Configuration
```bash
# Copy example environment file
cp .env.example .env

# Edit with your credentials
ATPROTO_IDENTIFIER=your.handle.bsky.social
ATPROTO_PASSWORD=your-app-password
NODE_ENV=production
LOG_LEVEL=info
```

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

## 🔒 Security

Security is a top priority for this project. Please review our security practices and policies:

### Security Best Practices

**Before deploying to production:**

1. **Change Default Passwords**
   - Set `GRAFANA_ADMIN_PASSWORD` environment variable (don't use default)
   - Configure Redis password if using Redis
   - Generate strong random keys for `SECURITY_SECRET_KEY`

2. **Configure CORS Properly**
   - Replace wildcard `*` origins with specific domains
   - Set `CORS_ORIGINS` in your environment configuration
   - Example: `CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com`

3. **Secure Your Credentials**
   - Never commit `.env` files to version control
   - Use app passwords instead of main account passwords
   - Rotate credentials regularly
   - Use secret management systems in production (AWS Secrets Manager, HashiCorp Vault, etc.)

4. **Network Security**
   - Use HTTPS in production
   - Configure `TRUSTED_PROXIES` if behind a reverse proxy
   - Enable rate limiting
   - Restrict access to internal services (Redis, Prometheus, Grafana)

5. **Keep Dependencies Updated**
   ```bash
   pnpm audit
   pnpm update
   ```

### Reporting Security Vulnerabilities

If you discover a security vulnerability, please review our [Security Policy](SECURITY.md) for responsible disclosure guidelines.

**Do not open public issues for security vulnerabilities.** Instead, send me a message privately.

### Security Features

- ✅ Input validation and sanitization
- ✅ Rate limiting and abuse prevention
- ✅ Credential redaction in logs
- ✅ Non-root Docker containers
- ✅ HTTPS support for AT Protocol
- ✅ Error sanitization to prevent information leakage

For more details, see [SECURITY.md](SECURITY.md).

---

Made with ❤️ by [Cameron Rye](https://rye.dev/)
