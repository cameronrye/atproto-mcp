# Frequently Asked Questions (FAQ)

Common questions and answers about the AT Protocol MCP Server.

## General Questions

### What is the AT Protocol MCP Server?

The AT Protocol MCP Server is a **Model Context Protocol (MCP) server** that enables **Large Language Models (LLMs)** to interact with the AT Protocol ecosystem, including Bluesky and other AT Protocol-based social networks.

**Key Point**: This is not a direct-use API or SDK. It's middleware that LLM clients (like Claude Desktop) connect to via the MCP protocol.

### What is MCP?

MCP (Model Context Protocol) is an open protocol that standardizes how **LLM clients** access external tools and data sources. It enables AI assistants to seamlessly integrate with various services through a JSON-RPC 2.0 interface.

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
- Stream real-time data from the firehose
- Access user profiles and timelines
- Manage authentication and sessions

**Example**: You ask your LLM client "Search for posts about AI from this week", and the LLM uses this MCP server's `search_posts` tool to fulfill your request.

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

However, most users should configure their LLM client to launch the server automatically.

## Authentication

### What authentication methods are supported?

1. **App Passwords** - For development and personal use
2. **OAuth 2.0** - For production applications
3. **Unauthenticated** - For accessing public data only

### How do I get an app password?

1. Log in to your Bluesky account
2. Go to Settings → App Passwords
3. Create a new app password
4. Use it in the `ATPROTO_PASSWORD` environment variable

### When should I use OAuth vs App Passwords?

- **App Passwords**: Development, personal projects, single-user applications
- **OAuth**: Production applications, multi-user systems, public-facing services

### How do I refresh expired tokens?

The server automatically refreshes OAuth tokens when they expire. You can also manually refresh using the `refresh_oauth_tokens` tool.

### Can I use the server without authentication?

Yes! Many MCP tools work without authentication for accessing public data:
- `search_posts` - Search public posts
- `get_user_profile` - View public profiles
- `get_followers` / `get_follows` - View public social graphs
- `get_thread` - Read public conversations
- `get_custom_feed` - Browse public feeds

## How LLMs Use This Server

### How does an LLM interact with this MCP server?

LLMs don't write code or make HTTP requests. Instead, they use the **MCP protocol** (JSON-RPC 2.0):

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
     "content": [{
       "type": "text",
       "text": "Post created successfully at at://did:plc:xyz.../app.bsky.feed.post/abc123"
     }]
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

AT Protocol has various rate limits enforced by the PDS (Personal Data Server):
- **Posts**: ~300 per hour
- **Likes**: ~1000 per hour
- **Follows**: ~100 per hour
- **Searches**: ~300 per hour

Exact limits may vary by PDS.

### How does the MCP server handle rate limits?

The server automatically handles rate limiting:

1. **Detects rate limit errors** from AT Protocol API
2. **Returns error to LLM client** with retry information
3. **LLM explains to user**: "I've hit the rate limit. I'll need to wait a few minutes before continuing."

The LLM client can then decide whether to retry after the rate limit resets.

### Can I increase rate limits?

Rate limits are set by the PDS (Personal Data Server). For Bluesky's official PDS, limits are fixed. If you're running a custom PDS, you can configure your own limits.

## Troubleshooting

### My LLM client can't connect to the MCP server

1. **Check your LLM client configuration** - Ensure the MCP server is properly configured
2. **Verify the server is installed** - Run `npx atproto-mcp --version`
3. **Check Node.js version** - Requires Node.js 20+
4. **Review LLM client logs** - Look for MCP connection errors
5. **Try running standalone** - Test with `npx atproto-mcp` to see if it starts

### I'm getting "Authentication failed" errors

When your LLM tries to create posts or access private data:

1. **Check credentials in MCP configuration** - Verify `ATPROTO_IDENTIFIER` and `ATPROTO_PASSWORD`
2. **Use app password, not main password** - Generate an app password in Bluesky settings
3. **Verify environment variables** - Ensure they're set in your LLM client's MCP config
4. **Check session expiration** - The server will automatically refresh sessions

### The LLM says posts aren't appearing

This is normal. AT Protocol uses eventual consistency:
- Posts may take a few seconds to appear in feeds
- Search indexing can take longer
- The LLM can use the firehose for real-time updates

### The LLM can't upload images

Common issues:
- **Image size** - Max 1MB per image
- **Image format** - JPEG, PNG, WebP supported
- **Authentication required** - Image uploads need authenticated mode
- **File encoding** - Ensure the LLM client properly encodes image data

### Streaming isn't working

If your LLM can't access real-time data:
- **Check firehose connection** - Server logs will show connection status
- **Verify subscription** - Ensure unique subscription ID
- **Network stability** - Streaming requires stable connection
- **Collection filters** - Make sure you're subscribing to the right collections

## Performance

### How can I improve performance?

1. **Use caching** - Cache frequently accessed data
2. **Batch operations** - Group multiple operations together
3. **Use filters** - Filter streaming by collections
4. **Optimize polling** - Don't poll too frequently
5. **Use pagination** - Fetch data in reasonable chunks

### Should I cache data?

Yes, but with appropriate TTLs:
- **Profiles**: 5-15 minutes
- **Timeline**: 30-60 seconds
- **Search results**: 1-5 minutes
- **Static content**: Longer

### How many concurrent requests can I make?

Limit concurrent requests to avoid rate limits:
- 5-10 concurrent requests is reasonable
- Use request queuing for bulk operations
- Implement exponential backoff

## Development

### Can I contribute to the project?

Yes! Contributions are welcome. This project is for developers who want to:
- **Add new MCP tools** for additional AT Protocol functionality
- **Improve existing tools** with better error handling or features
- **Enhance the MCP server** with performance improvements
- **Extend documentation** to help others use the server

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

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
- Use OAuth instead of app passwords for multi-user scenarios
- Implement proper error handling and monitoring
- Set up logging and observability
- Use environment-specific configurations
- Follow security best practices (see [DEPLOYMENT.md](../DEPLOYMENT.md))

### What hosting options are available?

The MCP server can run on:
- **Local machines** - For personal LLM client use
- **VPS** - DigitalOcean, Linode, etc. for remote access
- **Cloud platforms** - AWS, GCP, Azure for scalability
- **Container platforms** - Docker, Kubernetes for orchestration
- **Serverless** - With limitations (MCP protocol requires persistent connections)

### How do I scale the MCP server?

For high-traffic deployments:
- **Load balancing** - Multiple server instances behind a load balancer
- **Distributed caching** - Redis for shared session/data cache
- **Message queues** - For async operations and rate limiting
- **Monitoring** - Prometheus + Grafana for observability

See [DEPLOYMENT.md](../DEPLOYMENT.md) for detailed production deployment guides.

## Security

### Is it safe to use app passwords?

App passwords are safer than main passwords but:
- Only use for development/personal projects
- Don't share or commit them
- Rotate them regularly
- Use OAuth for production

### How do I secure OAuth credentials?

- Store in environment variables
- Never commit to version control
- Use secrets management (Vault, AWS Secrets Manager)
- Rotate credentials periodically
- Use HTTPS for all communications

### What data is stored?

The server stores:
- Authentication tokens (in memory)
- Event buffer (in memory, max 100 events)
- No persistent user data by default

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

Yes, the MCP server provides streaming tools for real-time data:

**What LLMs can do:**
- Subscribe to specific collections (posts, likes, follows, etc.)
- Filter events by criteria
- Process events in real-time
- Build custom feeds and notifications

**Be aware:**
- **High volume** - Thousands of events per second
- **Resource intensive** - Requires significant memory/CPU
- **Use filters** - Subscribe only to needed collections
- **Consider limits** - May need distributed processing for full firehose

**Example user request:**
> "Monitor the firehose for posts mentioning 'AI' and summarize trends"

The LLM would use the `start_streaming` tool with appropriate filters.

### How does the MCP server handle deleted content?

The server handles deletions gracefully:
- **Delete events** are included in firehose streams
- **404 errors** are returned for deleted content with clear messages
- **LLMs are informed** when content is no longer available
- **Caching** respects deletion events

The LLM can explain to users: "That post has been deleted and is no longer available."

## Getting Help

### Where can I get help?

- 📖 [Documentation](https://cameronrye.github.io/atproto-mcp)
- 🐛 [GitHub Issues](https://github.com/cameronrye/atproto-mcp/issues)
- 💬 [GitHub Discussions](https://github.com/cameronrye/atproto-mcp/discussions)
- 🌐 [AT Protocol Community](https://atproto.com/community)

### How do I stay updated?

- Watch the GitHub repository
- Follow release notes
- Join AT Protocol community channels
- Subscribe to the changelog

## See Also

- [Getting Started Guide](./guide/getting-started.md)
- [API Reference](./api/)
- [Examples](./examples/)
- [Troubleshooting Guide](./guide/troubleshooting.md)

