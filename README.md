# AT Protocol MCP Server

[![npm version](https://badge.fury.io/js/atproto-mcp.svg)](https://badge.fury.io/js/atproto-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tests](https://github.com/cameronrye/atproto-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/cameronrye/atproto-mcp/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/cameronrye/atproto-mcp/branch/main/graph/badge.svg)](https://codecov.io/gh/cameronrye/atproto-mcp)

A comprehensive Model Context Protocol (MCP) server that provides LLMs with direct access to the AT Protocol ecosystem, enabling seamless interaction with Bluesky and other AT Protocol-based social networks.

**🎯 Works out-of-the-box without authentication** - Perfect for LLM clients that need to access public AT Protocol data without requiring user accounts.

## 🚀 Features

- **🔓 Unauthenticated Mode**: Access public data without any setup - search posts, view profiles, browse feeds
- **🔐 Optional Authentication**: Enable full functionality with app passwords or OAuth when needed
- **Complete AT Protocol Integration**: Full implementation using official `@atproto/api`
- **MCP Server Compliance**: Built with `@modelcontextprotocol/sdk` following MCP specification
- **Type-Safe**: Written in TypeScript with strict type checking
- **Comprehensive Tools**: Rich set of MCP tools for social networking operations
- **Real-time Support**: WebSocket connections for live data streams
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

### Option 1: Unauthenticated Mode (Recommended for most use cases)

**Perfect for LLM clients that need to access public AT Protocol data:**

1. **Start the MCP server:**
   ```bash
   atproto-mcp
   ```

2. **Configure your LLM client** to connect to the MCP server

3. **Start using public tools immediately** - no authentication required!

Available in unauthenticated mode:
- ✅ Search posts and hashtags
- ✅ View user profiles and follower lists
- ✅ Browse public feeds and threads
- ✅ Access public timelines

### Option 2: Authenticated Mode (For full functionality)

**Enable write operations and private data access:**

1. **Set up authentication** using environment variables:
   ```bash
   # App Password method (recommended)
   export ATPROTO_IDENTIFIER="your-handle.bsky.social"
   export ATPROTO_PASSWORD="your-app-password"

   # OR OAuth method
   export ATPROTO_CLIENT_ID="your-client-id"
   export ATPROTO_CLIENT_SECRET="your-client-secret"
   ```

2. **Start the server:**
   ```bash
   atproto-mcp
   ```

Additional features in authenticated mode:
- ✅ Create, edit, and delete posts
- ✅ Follow/unfollow users
- ✅ Like and repost content
- ✅ Access personalized timelines and notifications
- ✅ Manage lists and moderation settings

## 🛠️ Available Tools

### 🔓 Public Tools (No Authentication Required)

**Data Retrieval**
- `search_posts` - Search for posts and content across the network
- `get_user_profile` - Retrieve public user information and stats
- `get_user_profiles` - Get multiple user profiles at once
- `get_followers` - Get follower lists for public profiles
- `get_follows` - Get following lists for public profiles
- `get_thread` - View post threads and conversations
- `get_custom_feed` - Access public custom feeds

### 🔐 Private Tools (Authentication Required)

**Social Operations**
- `create_post` - Create new posts with rich text support
- `reply_to_post` - Reply to existing posts with threading
- `like_post` / `unlike_post` - Like and unlike posts
- `repost` / `unrepost` - Repost content with optional quotes
- `follow_user` / `unfollow_user` - Follow and unfollow users
- `get_timeline` - Retrieve personalized timelines and feeds
- `get_notifications` - Access your notification feeds

**Content Management**
- `upload_image` / `upload_video` - Upload media content
- `delete_post` - Remove your posts and content
- `update_profile` - Modify your profile and settings
- `create_list` - Create and manage user lists

**Moderation**
- `mute_user` / `unmute_user` - Mute and unmute users
- `block_user` / `unblock_user` - Block and unblock users
- `report_content` / `report_user` - Report content and users

**OAuth Management**
- `start_oauth_flow` - Initiate OAuth authentication
- `handle_oauth_callback` - Complete OAuth flow
- `refresh_oauth_tokens` - Refresh authentication tokens

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

**Do not open public issues for security vulnerabilities.** Instead, email: c@meron.io

### Security Features

- ✅ Input validation and sanitization
- ✅ Rate limiting and abuse prevention
- ✅ Credential redaction in logs
- ✅ Non-root Docker containers
- ✅ HTTPS support for AT Protocol
- ✅ Error sanitization to prevent information leakage

For more details, see [SECURITY.md](SECURITY.md).

---

Made with ❤️ for the AT Protocol and MCP communities
