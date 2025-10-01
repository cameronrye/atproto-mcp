# Frequently Asked Questions (FAQ)

Common questions and answers about the AT Protocol MCP Server.

## General Questions

### What is the AT Protocol MCP Server?

The AT Protocol MCP Server is a Model Context Protocol (MCP) server that provides tools and resources for interacting with the AT Protocol ecosystem, including Bluesky and other AT Protocol-based social networks.

### What is MCP?

MCP (Model Context Protocol) is a protocol that allows AI assistants and applications to access external tools and data sources in a standardized way. It enables seamless integration between AI models and various services.

### What can I do with this server?

You can:
- Create and manage posts
- Follow and interact with users
- Search and discover content
- Stream real-time data from the firehose
- Build bots and automation
- Access user profiles and timelines
- Manage OAuth authentication

## Installation and Setup

### How do I install the server?

```bash
npm install atproto-mcp
```

Or clone the repository:
```bash
git clone https://github.com/cameronrye/atproto-mcp.git
cd atproto-mcp
npm install
npm run build
```

### What are the system requirements?

- Node.js 18 or higher
- npm or yarn
- Internet connection for AT Protocol API access

### How do I configure the server?

Set environment variables:

**For App Password authentication:**
```bash
export ATPROTO_SERVICE=https://bsky.social
export ATPROTO_IDENTIFIER=your-handle.bsky.social
export ATPROTO_PASSWORD=your-app-password
```

**For OAuth authentication:**
```bash
export ATPROTO_SERVICE=https://bsky.social
export OAUTH_CLIENT_ID=your-client-id
export OAUTH_CLIENT_SECRET=your-client-secret
export OAUTH_REDIRECT_URI=https://your-app.com/callback
```

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

Yes! Many tools work without authentication for accessing public data:
- `search_posts`
- `get_user_profile`
- `get_followers`
- `get_follows`
- `get_thread`
- `get_custom_feed`

## Usage Questions

### How do I create a post?

```typescript
await createPost({
  text: "Hello from AT Protocol!"
});
```

### How do I post with images?

```typescript
const imageBlob = new Blob([imageData], { type: 'image/jpeg' });

await createPost({
  text: "Check out this photo!",
  embed: {
    images: [{
      alt: "Description of image",
      image: imageBlob
    }]
  }
});
```

### How do I reply to a post?

```typescript
await replyToPost({
  text: "Great post!",
  root: rootPostUri,
  parent: parentPostUri
});
```

### How do I search for posts?

```typescript
const results = await searchPosts({
  q: "atproto",
  sort: "latest",
  limit: 50
});
```

### How do I start streaming real-time data?

```typescript
// Start streaming
await startStreaming({
  subscriptionId: "my-stream",
  collections: ["app.bsky.feed.post"]
});

// Poll for events
setInterval(async () => {
  const events = await getRecentEvents({ limit: 20 });
  // Process events
}, 5000);
```

## Rate Limiting

### What are the rate limits?

AT Protocol has various rate limits:
- **Posts**: ~300 per hour
- **Likes**: ~1000 per hour
- **Follows**: ~100 per hour
- **Searches**: ~300 per hour

Exact limits may vary by PDS (Personal Data Server).

### How do I handle rate limits?

The server returns rate limit errors with a `retryAfter` value:

```typescript
try {
  await createPost({ text: "Hello!" });
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    await sleep(error.retryAfter * 1000);
    // Retry
  }
}
```

### Can I increase rate limits?

Rate limits are set by the PDS. Contact your PDS administrator for limit increases.

## Troubleshooting

### I'm getting "Authentication failed" errors

1. Check your credentials are correct
2. Verify environment variables are set
3. For app passwords, ensure it's not your main password
4. For OAuth, verify client ID and secret
5. Check if your session has expired

### Posts aren't appearing immediately

This is normal. AT Protocol uses eventual consistency:
- Posts may take a few seconds to appear
- Search indexing can take longer
- Use the firehose for real-time updates

### Images aren't uploading

Check:
- Image size (max 1MB)
- Image format (JPEG, PNG, WebP supported)
- File is properly read as Blob
- You have authentication

### Streaming isn't working

Verify:
- Firehose connection is established
- Subscription ID is unique
- You're polling for events regularly
- Network connection is stable

### I'm getting "Invalid URI" errors

Ensure:
- URIs start with `at://`
- DIDs start with `did:`
- URIs are properly formatted
- You're using the correct URI for the operation

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

Yes! Contributions are welcome:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

### How do I report bugs?

Open an issue on GitHub with:
- Description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Error messages/logs

### Is there a test suite?

Yes, run tests with:
```bash
npm test
```

### How do I debug issues?

Enable debug logging:
```bash
export LOG_LEVEL=debug
```

## Deployment

### Can I deploy this in production?

Yes, but:
- Use OAuth instead of app passwords
- Implement proper error handling
- Set up monitoring and logging
- Use environment-specific configs
- Follow security best practices

### What hosting options are available?

The server can run on:
- Local machines
- VPS (DigitalOcean, Linode, etc.)
- Cloud platforms (AWS, GCP, Azure)
- Container platforms (Docker, Kubernetes)
- Serverless (with limitations)

### How do I scale the server?

- Use load balancing for multiple instances
- Implement distributed caching
- Use message queues for async operations
- Monitor and optimize bottlenecks

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

Yes, set the `ATPROTO_SERVICE` environment variable to your PDS URL:
```bash
export ATPROTO_SERVICE=https://my-pds.example.com
```

### How do I build a bot?

See the [Custom Integration Examples](./examples/custom-integration.md) for bot frameworks and patterns.

### Can I process the entire firehose?

Yes, but be aware:
- High volume (thousands of events per second)
- Requires significant resources
- Use collection filters to reduce load
- Consider distributed processing

### How do I handle deleted content?

Deleted content may briefly appear in streams:
- Check for delete operations in events
- Handle 404 errors gracefully
- Don't cache deleted content
- Update UI when content is deleted

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

