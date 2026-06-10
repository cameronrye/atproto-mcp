# Getting Started

This guide will help you get up and running with the AT Protocol MCP Server
quickly.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 20+** installed on your system
- **npm** or **pnpm** package manager
- An **AT Protocol account** (e.g., Bluesky account)
- Basic familiarity with **command line interface**

## Installation

The fastest way to try the server is with `npx` (no install required):

```bash
npx atproto-mcp
```

Or install it globally:

```bash
npm install -g atproto-mcp
```

For all installation methods (global, local, from source, and Docker), see the
[Installation guide](./installation.md).

## Quick Start

### 1. Basic Setup

Start the MCP server with default settings:

```bash
atproto-mcp
```

This starts the server using the **stdio transport** — it communicates over
standard input/output, not a network port, so your MCP client launches it as a
subprocess. No port is bound (the `--port`/`--host` flags are accepted but
ignored).

### 2. Authentication

The server runs unauthenticated, but only public/enhanced tools work in that
mode (for example `get_user_profile`, `get_user_connections`, `get_author_feed`,
`search_actors`, and `analyze_image`). `search_posts` and all other tools require
credentials, since the AT Protocol search API began requiring authentication in
2025. For full functionality, authenticate with an **app password** — this is
the supported path.

#### App Passwords (Recommended)

1. Go to your Bluesky settings and generate an app password
2. Set environment variables:

```bash
export ATPROTO_IDENTIFIER="your-handle.bsky.social"
export ATPROTO_PASSWORD="your-app-password"
atproto-mcp
```

For the full authentication reference (verification, security tips, mode
comparison), see the [Authentication guide](./authentication.md).

#### OAuth (Planned)

::: warning Planned

OAuth login is on the roadmap but **not yet functional**, so it is not exposed
as a tool or configuration path. Use **app passwords** for working
authentication. See [Experimental & Roadmap](./experimental.md).

:::

### 3. Configure Your LLM Client

Configure your MCP-compatible LLM client (e.g., Claude Desktop) to connect to
the server:

```json
{
  "mcpServers": {
    "atproto": {
      "command": "atproto-mcp",
      "args": [],
      "env": {
        "ATPROTO_IDENTIFIER": "your-handle.bsky.social",
        "ATPROTO_PASSWORD": "your-app-password"
      }
    }
  }
}
```

## Configuration Options

Common flags for a quick start:

```bash
atproto-mcp --service https://bsky.social --auth app-password --log-level info
```

The `--port`/`--host` flags are accepted but **ignored** by the stdio transport.

For the full list of CLI flags and environment variables, see the
[Configuration guide](./configuration.md).

## First Steps

Once your MCP server is configured and your LLM client is running, try these
basic operations by talking to your LLM client in natural language:

### 1. Create a Post

**What you say to your LLM client:**

```
"Create a post saying 'Hello from AT Protocol MCP Server!'"
```

Your LLM client will use the `create_post` tool to publish your post.

### 2. Search Posts

**What you say to your LLM client:**

```
"Search for posts about 'artificial intelligence' from the last week"
```

Your LLM client will use the `search_posts` tool to find relevant posts.

### 3. Get User Profile

**What you say to your LLM client:**

```
"Get the profile information for @bsky.app"
```

Your LLM client will use the `get_user_profile` tool to retrieve the profile.

### 4. Follow a User

**What you say to your LLM client:**

```
"Follow @atproto.com"
```

Your LLM client will use the `follow_user` tool to follow the user.

## Verification

To verify everything is working correctly:

1. **Check server logs** for successful startup messages
2. **Test authentication** by creating a simple post
3. **Verify MCP connection** through your LLM client
4. **Try basic operations** like searching or getting profiles

## Troubleshooting

### Common Issues

**Server won't start:**

- Check Node.js version (requires 20+)
- Check environment variables

**Authentication fails:**

- Verify credentials are correct
- Check AT Protocol service URL
- Ensure the app password is valid (OAuth login cannot be completed yet — use an
  app password)

**LLM client can't connect to MCP server:**

- Verify MCP server configuration in your LLM client
- Check that the server command is correct
- Review LLM client logs for MCP connection errors

**Rate limiting errors:**

- Reduce request frequency
- Check AT Protocol rate limits
- Implement proper backoff

### Getting Help

If you encounter issues:

1. Search [existing issues](https://github.com/cameronrye/atproto-mcp/issues)
2. Create a [new issue](https://github.com/cameronrye/atproto-mcp/issues/new)
   with details
3. Check the server logs for error messages
4. Verify your configuration and credentials

## Next Steps

Now that you have the MCP server configured with your LLM client:

- **Explore available tools** - Ask your LLM client what it can do with AT
  Protocol
- **Try natural language commands** - Create posts, search content, manage your
  social graph
- **Review the documentation** - Learn about all available MCP tools and
  resources
- **Extend the server** - Consider contributing new MCP tools to the project

## Development Setup

For development and customization:

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
```

See the
[contributing guide](https://github.com/cameronrye/atproto-mcp/blob/main/CONTRIBUTING.md)
for more details on development setup.
