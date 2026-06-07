# Frequently Asked Questions (FAQ)

Common questions and answers about the AT Protocol MCP Server.

## General Questions

### What is the AT Protocol MCP Server?

The AT Protocol MCP Server is a **Model Context Protocol (MCP) server** that
enables **Large Language Models (LLMs)** to interact with the AT Protocol
ecosystem, including Bluesky and other AT Protocol-based social networks.

**Key Point**: This is not a direct-use API or SDK. It's middleware that LLM
clients (like Claude Desktop) connect to via the MCP protocol.

### What is MCP?

MCP (Model Context Protocol) is an open protocol that standardizes how **LLM
clients** access external tools and data sources. It enables AI assistants to
seamlessly integrate with various services through a JSON-RPC 2.0 interface.

### How does this work?

```
You (User) → LLM Client (Claude Desktop) → MCP Protocol → This Server → AT Protocol → Bluesky
```

1. **You** interact with your LLM client in natural language
2. **Your LLM client** (e.g., Claude Desktop) decides to use this MCP server
3. **The MCP server** translates LLM requests into AT Protocol API calls
4. **Results** flow back through the chain to your LLM client
5. **Your LLM** presents the information to you in natural language

### What can LLMs do through this server?

When connected to this MCP server, LLMs can help users:

- Create and manage posts on Bluesky
- Follow and interact with users
- Search and discover content
- Access user profiles and timelines
- Run analytics and discovery heuristics over their own posts and graph

> Real-time firehose streaming is registered but not yet implemented. See
> [Experimental & Roadmap](./guide/experimental).

**Example**: You ask your LLM client "Search for posts about AI from this week",
and the LLM uses this MCP server's `search_posts` tool to fulfill your request.

## Installation and Setup

### How do I set up this MCP server with my LLM client?

The setup process depends on your LLM client. For **Claude Desktop**:

1. **Install the server** (if not using npx):

   ```bash
   npm install -g atproto-mcp
   ```

2. **Configure Claude Desktop** to use the MCP server:

   Edit your Claude Desktop MCP configuration file and add:

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

3. **Restart Claude Desktop** - it will automatically connect to the MCP server

4. **Start using it** - Ask Claude to search posts, create content, etc.

### What are the system requirements?

For running the MCP server:

- Node.js 20 or higher
- npm or pnpm
- Internet connection for AT Protocol API access

For using the MCP server:

- An MCP-compatible LLM client (Claude Desktop, etc.)

### Can I run the server standalone?

Yes, for development or custom integrations:

```bash
# Install globally
npm install -g atproto-mcp

# Run the server
atproto-mcp
```

However, most users should configure their LLM client to launch the server
automatically.

## Authentication

### What authentication methods are supported?

1. **App Passwords** - The supported path for authenticated use. Set
   `ATPROTO_IDENTIFIER` and `ATPROTO_PASSWORD`.
2. **Unauthenticated** - For accessing public data only.

OAuth tooling exists but is experimental: `start_oauth_flow` only builds a PKCE
URL, and the callback/refresh/revoke tools always error. See
[Experimental & Roadmap](./guide/experimental).

### How do I get an app password?

1. Log in to your Bluesky account
2. Go to Settings → App Passwords
3. Create a new app password
4. Use it in the `ATPROTO_PASSWORD` environment variable

### Can I use the server without authentication?

Yes, but with limitations. Most AT Protocol endpoints now require
authentication, so unauthenticated mode only exposes public read-only tools.

**Tools that work without authentication:**

- `get_user_profile` - View public profiles (provides additional viewer-specific
  data when authenticated)
- `get_followers` / `get_follows` - View social graphs (return richer
  viewer-state data when authenticated)
- `analyze_image` / `generate_alt_text` - Vision-based media tools
- `get_post_context`, `find_similar_users`, and other public/enhanced discovery
  tools

**Tools that require authentication:**

- `search_posts` - Search posts (the AT Protocol search API changed in 2025 to
  require authentication)
- `get_thread` - Read conversations
- `get_custom_feed` - Browse feeds
- All write operations (posting, following, liking, etc.) and most other data
  retrieval

> The OAuth tools (`start_oauth_flow`, `handle_oauth_callback`,
> `refresh_oauth_tokens`, `revoke_oauth_tokens`) are registered but not
> functional and should not be relied on for authentication.

## How LLMs Use This Server

### How does an LLM interact with this MCP server?

LLMs don't write code or make HTTP requests. Instead, they use the **MCP
protocol** (JSON-RPC 2.0):

1. **LLM discovers available tools** by calling `tools/list`
2. **LLM reads tool descriptions** to understand what each tool does
3. **LLM decides which tool to use** based on user's request
4. **LLM calls the tool** via MCP protocol with appropriate parameters
5. **Server executes the tool** and returns results
6. **LLM presents results** to the user in natural language

### Example: Creating a Post

**User says to their LLM client:**

> "Create a post saying 'Hello from AT Protocol!'"

**What happens behind the scenes:**

1. LLM client sends MCP request to this server:

   ```json
   {
     "method": "tools/call",
     "params": {
       "name": "create_post",
       "arguments": {
         "text": "Hello from AT Protocol!"
       }
     }
   }
   ```

2. Server executes the `create_post` tool via AT Protocol API

3. Server returns MCP response:

   ```json
   {
     "content": [
       {
         "type": "text",
         "text": "Post created successfully at at://did:plc:xyz.../app.bsky.feed.post/abc123"
       }
     ]
   }
   ```

4. LLM tells the user: "I've created your post on Bluesky!"

### Example: Searching Posts

**User says:**

> "Find posts about artificial intelligence from this week"

**LLM client sends:**

```json
{
  "method": "tools/call",
  "params": {
    "name": "search_posts",
    "arguments": {
      "q": "artificial intelligence",
      "sort": "latest",
      "limit": 25
    }
  }
}
```

**Server returns search results, LLM summarizes them for the user.**

## Rate Limiting

### What are the rate limits?

There are two layers of rate limiting:

- **This server** applies a per-tool limit of 100 requests per minute per tool.
- **The AT Protocol PDS** (Personal Data Server) enforces its own limits on top
  of that. Exact limits vary by PDS and are set by the platform, not this
  server.

### How does the MCP server handle rate limits?

When a limit is exceeded:

1. The server returns a rate-limit error to the LLM client
2. The LLM explains to the user that it needs to wait before continuing

The LLM client can then decide whether to retry after the limit resets.

### Can I increase rate limits?

The server's per-tool limit is fixed. The underlying PDS rate limits are set by
the platform. If you run a custom PDS, you can configure your own limits there.

## Troubleshooting

For detailed troubleshooting steps, see the
[Troubleshooting Guide](./guide/troubleshooting.md). A few FAQ-level pointers:

### My LLM client can't connect to the MCP server

Verify the server is installed (`npx atproto-mcp --version`), confirm Node.js
20+, and check your LLM client's MCP logs for connection errors. See the
[Troubleshooting Guide](./guide/troubleshooting.md) for the full checklist.

### I'm getting "Authentication failed" errors

When your LLM tries to create posts or access private data:

1. **Check credentials in MCP configuration** - Verify `ATPROTO_IDENTIFIER` and
   `ATPROTO_PASSWORD`
2. **Use an app password, not your main password** - Generate one in Bluesky
   Settings → App Passwords
3. **Verify environment variables** - Ensure they're set in your LLM client's
   MCP config

### The LLM says posts aren't appearing

This is normal. AT Protocol uses eventual consistency:

- Posts may take a few seconds to appear in feeds
- Search indexing can take longer

### The LLM can't upload images

Common issues:

- **Authentication required** - Image uploads need an authenticated session (app
  password)
- **File encoding** - Ensure the LLM client properly encodes image data
- **Platform limits** - Bluesky enforces its own image size and format limits;
  this server does not add caps of its own

### Is streaming supported?

Not yet. The firehose/streaming tools are registered but firehose decoding is
not implemented, so `start_streaming` opens no connection and the event-reading
tools always return an empty buffer. See
[Experimental & Roadmap](./guide/experimental).

## Performance

### How can I improve performance?

1. **Batch operations** - Use the batch tools to follow, like, or repost up to
   25 items in one call
2. **Use pagination** - Fetch data in reasonable chunks rather than large pulls
3. **Stay under the rate limit** - Avoid bursts beyond 100 requests per minute
   per tool

### How many concurrent requests can I make?

Keep concurrency modest to stay within rate limits. A handful of concurrent
requests is reasonable; back off when you receive rate-limit errors.

## Development

### Can I contribute to the project?

Yes! Contributions are welcome. This project is for developers who want to:

- **Add new MCP tools** for additional AT Protocol functionality
- **Improve existing tools** with better error handling or features
- **Enhance the MCP server** with performance improvements
- **Extend documentation** to help others use the server

See the [Contributing Guide](./contributing.md) for guidelines.

### How do I report bugs?

Open an issue on GitHub with:

- **Description** - What's wrong with the MCP server?
- **Steps to reproduce** - How can we recreate the issue?
- **Expected vs actual behavior** - What should happen vs what does happen?
- **Environment** - LLM client, Node.js version, OS
- **Logs** - MCP server logs (with credentials redacted)

### Is there a test suite?

Yes! The MCP server has comprehensive tests:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### How do I debug MCP server issues?

Enable debug logging when running the server:

```bash
# In your LLM client's MCP configuration
{
  "mcpServers": {
    "atproto": {
      "command": "npx",
      "args": ["atproto-mcp"],
      "env": {
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

Or run standalone with debug logging:

```bash
LOG_LEVEL=debug npx atproto-mcp
```

## Deployment

### Can I deploy this MCP server in production?

Yes! You can deploy the MCP server for:

- **Shared LLM access** - Multiple users' LLM clients connecting to one server
- **Enterprise deployments** - Internal LLM tools accessing AT Protocol
- **Custom integrations** - Your own MCP-compatible applications

**Production considerations:**

- Authenticate with an app password and keep credentials out of version control
- Implement proper error handling and monitoring
- Set the log level appropriately via the `--log-level` flag
- Use environment-specific configurations
- Follow security best practices (see the
  [Deployment Guide](./guide/deployment.md))

### What hosting options are available?

The server communicates over stdio and is typically launched as a subprocess by
the LLM client, so it runs wherever that client runs:

- **Local machines** - For personal LLM client use
- **VPS** - DigitalOcean, Linode, etc.
- **Container platforms** - Docker for packaging and reproducible runs

See the [Deployment Guide](./guide/deployment.md) for detailed deployment
instructions.

## Security

### Is it safe to use app passwords?

App passwords are much safer than your main password, since they can be scoped
and revoked independently. Still:

- Don't share or commit them
- Rotate them regularly
- Revoke any that may have been exposed from Bluesky Settings → App Passwords

### How do I secure my credentials?

- Store the app password in environment variables, never in source files
- Never commit credentials to version control
- Use secrets management (Vault, AWS Secrets Manager) for shared deployments
- Rotate credentials periodically

### What data is stored?

The server stores:

- The session/authentication tokens (in memory)
- Event buffer (in memory, max 100 events)
- No persistent user data

## Advanced Topics

### Can I use custom PDS instances?

Yes! Configure the MCP server to use your custom PDS:

```json
{
  "mcpServers": {
    "atproto": {
      "command": "npx",
      "args": ["atproto-mcp"],
      "env": {
        "ATPROTO_SERVICE": "https://my-pds.example.com"
      }
    }
  }
}
```

### Can LLMs process the entire AT Protocol firehose?

Not yet. The streaming tools (`start_streaming`, `monitor_keywords`,
`track_users`, and the event-reading tools) are registered and visible to MCP
clients, but firehose decoding is not implemented. `start_streaming` opens no
connection and returns a `not_implemented` status, and the event buffer is
always empty.

This is on the roadmap. See [Experimental & Roadmap](./guide/experimental) for
the current status.

### How does the MCP server handle deleted content?

For direct reads, the server surfaces deletions clearly:

- **404-style errors** are returned for deleted content with clear messages
- **LLMs are informed** when content is no longer available

The LLM can explain to users: "That post has been deleted and is no longer
available."

## Getting Help

### Where can I get help?

- [Documentation](https://cameronrye.github.io/atproto-mcp)
- [GitHub Issues](https://github.com/cameronrye/atproto-mcp/issues)
- [GitHub Discussions](https://github.com/cameronrye/atproto-mcp/discussions)
- [AT Protocol Community](https://atproto.com/community)

### How do I stay updated?

- Watch the GitHub repository
- Follow release notes
- Join AT Protocol community channels
- Subscribe to the changelog

## See Also

- [Getting Started Guide](./guide/getting-started.md)
- [API Reference](./api/)
- [Examples](./examples/basic-usage)
- [Troubleshooting Guide](./guide/troubleshooting.md)
