<div align="center">
  <img src="docs/public/logo.svg" alt="AT Protocol MCP Server Logo" width="200" height="200">

# AT Protocol MCP Server

[![npm version](https://badge.fury.io/js/atproto-mcp.svg)](https://badge.fury.io/js/atproto-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[![CI](https://github.com/cameronrye/atproto-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/cameronrye/atproto-mcp/actions/workflows/ci.yml)
[![Integration Tests](https://github.com/cameronrye/atproto-mcp/actions/workflows/integration-tests.yml/badge.svg)](https://github.com/cameronrye/atproto-mcp/actions/workflows/integration-tests.yml)
[![Documentation](https://github.com/cameronrye/atproto-mcp/actions/workflows/docs.yml/badge.svg)](https://github.com/cameronrye/atproto-mcp/actions/workflows/docs.yml)
[![Release](https://github.com/cameronrye/atproto-mcp/actions/workflows/release.yml/badge.svg)](https://github.com/cameronrye/atproto-mcp/actions/workflows/release.yml)
[![Coverage](https://codecov.io/gh/cameronrye/atproto-mcp/branch/main/graph/badge.svg)](https://codecov.io/gh/cameronrye/atproto-mcp)

![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen?logo=node.js)
![pnpm](https://img.shields.io/badge/pnpm-10.17.1-orange?logo=pnpm)
![AT Protocol](https://img.shields.io/badge/AT_Protocol-0.17.7-7856ff)
![MCP SDK](https://img.shields.io/badge/MCP_SDK-1.29.0-blue)

![GitHub stars](https://img.shields.io/github/stars/cameronrye/atproto-mcp?style=social)
![npm downloads](https://img.shields.io/npm/dm/atproto-mcp)
![GitHub last commit](https://img.shields.io/github/last-commit/cameronrye/atproto-mcp)
![GitHub contributors](https://img.shields.io/github/contributors/cameronrye/atproto-mcp)

![Code Style](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)
[![Documentation](https://img.shields.io/badge/docs-online-success)](https://cameronrye.github.io/atproto-mcp)
[![Security](https://img.shields.io/badge/security-policy-blue)](SECURITY.md)
![npm bundle size](https://img.shields.io/bundlephobia/min/atproto-mcp)

</div>

A comprehensive Model Context Protocol (MCP) server that provides LLMs with
direct access to the AT Protocol ecosystem, enabling seamless interaction with
Bluesky and other AT Protocol-based social networks.

**Supports both authenticated and unauthenticated modes** - Start immediately
with public data access (view profiles, fetch follower/following lists), or add
authentication for full functionality (search, write operations, private data,
feeds).

> **Recent additions**: Batch operations for bulk actions, advanced analytics
> and insights, intelligent content discovery, and a conversation-context
> scratchpad resource.

## Architecture

This MCP server acts as a bridge between LLM clients and the AT Protocol
ecosystem:

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

**Key Point**: Users don't interact with this server directly. Instead, they
talk to their LLM client in natural language, and the LLM client uses this MCP
server to access AT Protocol functionality.

## Features

### Highlights

- **Batch Operations**: Perform multiple operations in a single call
  (follow/like/repost up to 25 items at once)
- **Analytics & Insights**: Analyze engagement patterns, network connections,
  and get content strategy recommendations
- **Content Discovery**: Find similar users, trending topics, and influential
  voices in your areas of interest
- **Conversation Context**: An MCP resource that acts as a scratchpad for
  conversation state (not auto-populated yet)

### Core Features

- **Unauthenticated Mode**: Access public data without any setup - view basic
  profiles and manage OAuth flows
- **Optional Authentication**: Enable full functionality with app passwords or
  OAuth for write operations, feeds, and private data
- **Complete AT Protocol Integration**: Full implementation using official
  `@atproto/api`
- **MCP Server Compliance**: Built with `@modelcontextprotocol/sdk` following
  MCP specification
- **Type-Safe**: Written in TypeScript with strict type checking
- **Comprehensive Tools**: 60 MCP tools for social networking operations
- **Real-time Support** _(experimental)_: WebSocket firehose scaffolding with
  keyword/user buffer scanning — frame decoding is not yet implemented, so no
  live events are delivered yet
- **Rate Limiting**: Built-in respect for AT Protocol rate limits
- **Extensible**: Modular architecture for easy customization

## Who Is This For?

### Primary Audience: LLM Clients

This is an **MCP (Model Context Protocol) server** designed to be consumed by
**LLM clients** such as:

- Claude Desktop
- Other MCP-compatible AI assistants
- Custom LLM applications using the MCP SDK

**How it works:**

```
User → LLM Client (Claude Desktop) → MCP Protocol → This Server → AT Protocol → Bluesky
```

Users interact with their LLM client in natural language (e.g., "search for
posts about AI"), and the LLM client uses this MCP server to fulfill those
requests by calling the appropriate tools via the MCP protocol.

### Secondary Audience: Developers

This project is also for developers who want to:

- **Deploy** the MCP server for their LLM clients to connect to
- **Extend** the server with custom MCP tools and resources
- **Contribute** to the open-source project

### This Is NOT:

- A direct-use REST API or SDK for application developers
- A JavaScript/TypeScript library to import into your app
- An end-user application

If you're building an application that needs AT Protocol functionality, you
should either:

1. Use the official `@atproto/api` package directly, OR
2. Build an LLM-powered application that uses this MCP server through an LLM
   client

## Installation

```bash
npm install -g atproto-mcp
```

Or use with npx:

```bash
npx atproto-mcp
```

## Quick Start

### Option 1: Unauthenticated Mode (Recommended for most use cases)

**Perfect for LLM clients that need to access public AT Protocol data:**

1. **Configure your LLM client** (e.g., Claude Desktop) to launch the MCP
   server:

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

3. **Interact in natural language** - Ask your LLM to search posts, view
   profiles, etc.

**What your LLM can do in unauthenticated mode:**

- View user profiles (`get_user_profile` - works without auth, provides
  additional viewer-specific data when authenticated)
- View follower/following lists (`get_followers`, `get_follows` - ENHANCED mode:
  work without auth, enrich the underlying API call when authenticated)
- Manage OAuth authentication flows (`start_oauth_flow`,
  `handle_oauth_callback`, `refresh_oauth_tokens`, `revoke_oauth_tokens`)

**Note:** The following features require authentication:

- Searching posts and hashtags (`search_posts`) - **API changed in 2025 to
  require authentication**
- Browsing feeds and threads (`get_thread`, `get_custom_feed`, `get_timeline`)
- All write operations (create, like, repost, follow, etc.)
- Resources (timeline, profile, notifications) - these are listed but require
  authentication to return data (the `conversation-context` scratchpad resource
  is readable without auth and simply returns near-empty placeholder content)
- Prompts (content composition, reply templates) - these are listed but require
  authentication to be available

**Important:** All tools, resources, and prompts are listed by the MCP server
regardless of authentication state. Most tools and resources that require
authentication will return a clear error message when called without proper
credentials.

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

- Create, edit, and delete posts
- Follow/unfollow users
- Like and repost content
- Access personalized timelines and notifications
- Manage lists and moderation settings

## Available Tools

The server provides **60 MCP tools** across multiple categories. See the
[complete API documentation](https://cameronrye.github.io/atproto-mcp/api/) for
detailed information on each tool.

### Public Tools (No Authentication Required)

**Data Retrieval**

- `get_user_profile` - Retrieve basic user information (ENHANCED mode: works
  without auth, provides additional viewer-specific data when authenticated)
- `get_followers` - Get follower lists (ENHANCED mode: works without auth,
  enriches the underlying API call when authenticated)
- `get_follows` - Get following lists (ENHANCED mode: works without auth,
  enriches the underlying API call when authenticated)

**Rich Media**

- `generate_alt_text` - Generate descriptive alt text for images (PUBLIC mode:
  no auth required; experimental — returns an alt-text writing
  template/guidance, does not analyze image pixels)
- `analyze_image` - Report blob-declared size and MIME type for an image (PUBLIC
  mode: no auth required; does not decode pixels, so no dimensions/aspect ratio)
- `extract_media_from_post` - Extract media from posts (ENHANCED mode: works
  without auth)

**OAuth Management** _(experimental — token exchange not implemented)_

> ⚠️ Only the authorization-URL step is functional. The token-exchange steps
> (`handle_oauth_callback`, `refresh_oauth_tokens`, `revoke_oauth_tokens`) are
> **not implemented** and return an error. For working authentication, use app
> passwords (`ATPROTO_IDENTIFIER` + `ATPROTO_PASSWORD`).

- `start_oauth_flow` - Generate a PKCE authorization URL (experimental)
- `handle_oauth_callback` - Complete OAuth flow (not implemented — returns
  error)
- `refresh_oauth_tokens` - Refresh authentication tokens (not implemented —
  returns error)
- `revoke_oauth_tokens` - Revoke OAuth tokens (not implemented — returns error)

**Note:** As of 2025, the AT Protocol API has changed to require authentication
for most endpoints that were previously public, including `search_posts`.

### Private Tools (Authentication Required)

**Social Operations**

- `create_post` - Create new posts with rich text support
- `create_rich_text_post` - Create posts with advanced formatting
- `reply_to_post` - Reply to existing posts with threading
- `like_post` / `unlike_post` - Like and unlike posts
- `repost` / `unrepost` - Repost content with optional quotes
- `follow_user` / `unfollow_user` - Follow and unfollow users

**Data Retrieval**

- `search_posts` - Search for posts and content across the network (⚠️ API
  changed in 2025 to require auth)
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

**Real-time Streaming & Intelligence** _(experimental — not yet functional)_

> ⚠️ Firehose frame (CAR/DAG-CBOR) decoding is **not implemented** yet, so these
> tools currently decode no events: `start_streaming` returns a
> `not_implemented` status, and the buffer-scanning tools always return empty
> results. The tool descriptions and responses disclose this. Tracked for a
> future release.

- `start_streaming` - Start a real-time event stream (returns `not_implemented`)
- `stop_streaming` - Stop an event stream subscription
- `get_streaming_status` - Check streaming status (reports decoding
  availability)
- `get_recent_events` - Retrieve buffered events (empty until decoding lands)
- `monitor_keywords` - Scan the event buffer for keywords (empty until decoding
  lands)
- `track_users` - Scan the event buffer for specific users (empty until decoding
  lands)

**Batch Operations**

- `batch_follow` - Follow multiple users at once (up to 25)
- `batch_like` - Like multiple posts at once (up to 25)
- `batch_repost` - Repost multiple posts at once (up to 25)

**Analytics & Insights**

- `analyze_engagement` - Analyze engagement patterns across posts
- `analyze_network` - Analyze user's network and connections
- `suggest_content_strategy` - Get content strategy recommendations based on
  performance
- `find_influential_users` - Find influential users in a topic area

**Content Discovery**

- `discover_trending` - Discover trending topics and posts
- `find_similar_users` - Find users similar to a given user
- `recommend_content` - Get personalized content recommendations
- `discover_communities` - Discover communities around topics

**Composite Operations**

- `get_user_summary` - Get complete user profile with stats and analysis
- `get_post_context` - Get post with thread, author, and engagement data
- `create_thread` - Create multi-post threads in one call

**Enhanced Moderation**

- `analyze_moderation_status` - Check moderation status of content

## Documentation

Visit our [documentation site](https://cameronrye.github.io/atproto-mcp) for:

- **Getting Started Guide**
- **API Reference**
- **Configuration Options**
- **Examples and Tutorials**
- **Troubleshooting**

## Authentication (Optional)

The server works perfectly without authentication for accessing public data.
Authentication is only needed for write operations and private data access.

### App Passwords (Recommended for Development)

```bash
export ATPROTO_IDENTIFIER="your-handle.bsky.social"
export ATPROTO_PASSWORD="your-app-password"
atproto-mcp
```

### OAuth (experimental — not yet functional)

> ⚠️ OAuth token exchange is not implemented, so this cannot complete a login
> yet. App passwords (above) are the recommended/working method. The variables
> below configure the experimental authorization-URL generator.

```bash
export ATPROTO_CLIENT_ID="your-client-id"
export ATPROTO_CLIENT_SECRET="your-client-secret"  # optional for public clients
atproto-mcp --auth oauth
```

## Development

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

This project provides cross-platform npm scripts that work on Windows, macOS,
and Linux:

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

All build commands work on **Windows, macOS, and Linux** without requiring
additional tools. Simply use npm scripts on any platform (e.g., `npm run dev`,
`npm test`, `npm run build`).

## Testing

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

Comprehensive integration tests that connect to real AT Protocol servers to
validate all public-facing functionality:

```bash
# Run integration tests (requires internet connection)
npm run test:integration
```

**What's tested:**

- Public/enhanced tools (`get_user_profile`, `get_followers`, `get_follows`) and
  authenticated tools (`search_posts`, `get_thread`, `get_custom_feed`)
- DID and handle resolution
- Pagination support
- Error handling
- AT Protocol specification compliance
- Rate limiting behavior

**Note:** Integration tests are opt-in and disabled by default to avoid hitting
real servers during normal development. See
[Integration Tests Documentation](src/__tests__/INTEGRATION_TESTS.md) for
details.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md)
for details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Acknowledgments

- [AT Protocol Team](https://github.com/bluesky-social/atproto) for the
  excellent protocol and SDK
- [Anthropic](https://github.com/modelcontextprotocol) for the Model Context
  Protocol
- The open source community for inspiration and contributions

## Support

- [Documentation](https://cameronrye.github.io/atproto-mcp)
- [Issue Tracker](https://github.com/cameronrye/atproto-mcp/issues)
- [Discussions](https://github.com/cameronrye/atproto-mcp/discussions)

## Deployment

This is a **stdio MCP server**: it is normally launched by an MCP client (e.g.
Claude Desktop) via `npx atproto-mcp` and communicates over stdin/stdout. It
does not listen on a network port, so there is no HTTP endpoint to expose or
scale.

### Built-in safeguards

- **Error sanitization**: in `NODE_ENV=production`, internal error details are
  redacted before being returned to the client.
- **Rate limiting**: per-tool invocation rate limiting guards against runaway
  loops.
- **SSRF protection**: outbound URL/media fetches reject private/internal
  network destinations and cap response size and time.
- **Path-traversal protection**: local file reads are confined to an allowed
  base directory (`ATPROTO_MEDIA_DIR`, default: working directory).

### Running in Docker

The container runs the same stdio server, so attach to it via your MCP client
rather than mapping a port:

```bash
docker build -t atproto-mcp .
docker run -i --rm \
  -e ATPROTO_IDENTIFIER=your.handle.bsky.social \
  -e ATPROTO_PASSWORD=your-app-password \
  atproto-mcp
```

### Environment configuration

```bash
# Copy the example environment file and edit it (loaded automatically by the CLI)
cp .env.example .env
```

```dotenv
ATPROTO_IDENTIFIER=your.handle.bsky.social
ATPROTO_PASSWORD=your-app-password
NODE_ENV=production
LOG_LEVEL=info
```

See [.env.example](.env.example) for the full list of variables the server
reads.

## Security

Security is a top priority for this project. Please review our security
practices and policies:

### Security Best Practices

**Before deploying to production:**

1. **Secure Your Credentials**
   - Never commit `.env` files to version control
   - Use app passwords instead of your main account password
   - Rotate credentials regularly
   - Use a secret management system where available (AWS Secrets Manager,
     HashiCorp Vault, etc.)

2. **Run in production mode**
   - Set `NODE_ENV=production` so returned error messages are sanitized

3. **Keep Dependencies Updated**
   ```bash
   pnpm audit
   pnpm update
   ```

### Reporting Security Vulnerabilities

If you discover a security vulnerability, please review our
[Security Policy](SECURITY.md) for responsible disclosure guidelines.

**Do not open public issues for security vulnerabilities.** Instead, send me a
message privately.

### Security Features

- Input validation and sanitization
- Rate limiting and abuse prevention
- Credential redaction in logs
- Non-root Docker containers
- HTTPS support for AT Protocol
- Error sanitization to prevent information leakage

For more details, see [SECURITY.md](SECURITY.md).

---

Made with ❤️ by [Cameron Rye](https://rye.dev/)
