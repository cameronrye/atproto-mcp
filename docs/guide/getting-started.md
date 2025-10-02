# Getting Started

This guide will help you get up and running with the AT Protocol MCP Server quickly.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 20+** installed on your system
- **npm** or **pnpm** package manager
- An **AT Protocol account** (e.g., Bluesky account)
- Basic familiarity with **command line interface**

## Installation

### Global Installation

Install the AT Protocol MCP Server globally to use it from anywhere:

```bash
npm install -g atproto-mcp
```

### Local Installation

For project-specific usage:

```bash
npm install atproto-mcp
```

### Using npx

Run without installation:

```bash
npx atproto-mcp
```

## Quick Start

### 1. Basic Setup

Start the MCP server with default settings:

```bash
atproto-mcp
```

This will start the server on the default port (3000) using stdio transport.

### 2. Authentication

The server supports two authentication methods:

#### App Passwords (Recommended for Development)

1. Go to your Bluesky settings
2. Generate an app password
3. Set environment variables:

```bash
export ATPROTO_IDENTIFIER="your-handle.bsky.social"
export ATPROTO_PASSWORD="your-app-password"
atproto-mcp
```

#### OAuth (Recommended for Production)

```bash
export ATPROTO_CLIENT_ID="your-client-id"
export ATPROTO_CLIENT_SECRET="your-client-secret"
atproto-mcp --auth oauth
```

### 3. Configure Your LLM Client

Configure your MCP-compatible LLM client (e.g., Claude Desktop) to connect to the server:

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

### Command Line Arguments

```bash
atproto-mcp [options]

Options:
  --port <number>        Server port (default: 3000)
  --host <string>        Server host (default: localhost)
  --service <url>        AT Protocol service URL (default: https://bsky.social)
  --auth <method>        Authentication method: app-password|oauth (default: app-password)
  --log-level <level>    Log level: debug|info|warn|error (default: info)
  --help                 Show help
  --version              Show version
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ATPROTO_SERVICE` | AT Protocol service URL | `https://bsky.social` |
| `ATPROTO_IDENTIFIER` | Your AT Protocol identifier (handle or DID) | - |
| `ATPROTO_PASSWORD` | App password | - |
| `ATPROTO_CLIENT_ID` | OAuth client ID | - |
| `ATPROTO_CLIENT_SECRET` | OAuth client secret | - |
| `LOG_LEVEL` | Logging level | `info` |
| `MCP_SERVER_NAME` | Server name | `atproto-mcp` |

## First Steps

Once your MCP server is configured and your LLM client is running, try these basic operations by talking to your LLM client in natural language:

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
- Verify port is not in use
- Check environment variables

**Authentication fails:**
- Verify credentials are correct
- Check AT Protocol service URL
- Ensure app password is valid

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
2. Create a [new issue](https://github.com/cameronrye/atproto-mcp/issues/new) with details
3. Check the server logs for error messages
4. Verify your configuration and credentials

## Next Steps

Now that you have the MCP server configured with your LLM client:

- **Explore available tools** - Ask your LLM client what it can do with AT Protocol
- **Try natural language commands** - Create posts, search content, manage your social graph
- **Review the documentation** - Learn about all available MCP tools and resources
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

See the [contributing guide](https://github.com/cameronrye/atproto-mcp/blob/main/CONTRIBUTING.md) for more details on development setup.
