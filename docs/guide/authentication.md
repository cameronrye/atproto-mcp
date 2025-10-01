# Authentication

This guide covers authentication methods for the AT Protocol MCP Server.

## Overview

The AT Protocol MCP Server supports **three modes of operation**:

1. **Unauthenticated Mode** - Access public data without credentials
2. **App Password Authentication** - Simple authentication for development
3. **OAuth Authentication** - Secure authentication for production

## Unauthenticated Mode

### When to Use

Perfect for:
- Accessing public AT Protocol data
- Read-only applications
- Quick prototyping
- Research and analysis
- LLM clients that don't need write access

### Available Operations

Without authentication, you can:

- ✅ Search posts and hashtags
- ✅ View user profiles
- ✅ Get follower/following lists
- ✅ Browse public feeds
- ✅ View post threads
- ✅ Access public timelines

### Setup

No setup required! Just start the server:

```bash
atproto-mcp
```

The server will automatically work in unauthenticated mode.

## App Password Authentication

### When to Use

Recommended for:
- Development and testing
- Personal projects
- Single-user applications
- Quick prototypes with write access

### Creating an App Password

1. **Log in to Bluesky** at [bsky.app](https://bsky.app)

2. **Go to Settings** → **App Passwords**

3. **Create a new app password**:
   - Name: `atproto-mcp` (or any descriptive name)
   - Click "Create App Password"

4. **Copy the generated password** - You won't be able to see it again!

### Configuration

#### Method 1: Environment Variables

```bash
export ATPROTO_IDENTIFIER="your-handle.bsky.social"
export ATPROTO_PASSWORD="your-app-password"
atproto-mcp
```

#### Method 2: .env File

Create a `.env` file:

```bash
ATPROTO_IDENTIFIER=your-handle.bsky.social
ATPROTO_PASSWORD=xxxx-xxxx-xxxx-xxxx
ATPROTO_SERVICE=https://bsky.social
```

Then start the server:

```bash
atproto-mcp
```

#### Method 3: MCP Client Configuration

For Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "atproto": {
      "command": "atproto-mcp",
      "env": {
        "ATPROTO_IDENTIFIER": "your-handle.bsky.social",
        "ATPROTO_PASSWORD": "xxxx-xxxx-xxxx-xxxx"
      }
    }
  }
}
```

### Verification

Test your authentication:

```bash
# Start the server
atproto-mcp --log-level debug

# You should see:
# [INFO] Authentication successful
# [INFO] Logged in as: your-handle.bsky.social
```

### Security Best Practices

- ✅ **Use app passwords**, not your main account password
- ✅ **Never commit credentials** to version control
- ✅ **Rotate passwords regularly** (every 90 days)
- ✅ **Use different passwords** for different environments
- ✅ **Revoke unused passwords** in Bluesky settings

## OAuth Authentication

### When to Use

Recommended for:
- Production applications
- Multi-user systems
- Public-facing services
- Applications requiring user consent

### Prerequisites

OAuth support in AT Protocol is currently in development. When available, you'll need:

1. **OAuth Client ID** - From AT Protocol OAuth registration
2. **OAuth Client Secret** - From AT Protocol OAuth registration
3. **Redirect URI** - Your application's callback URL

### Configuration

```bash
export ATPROTO_CLIENT_ID="your-client-id"
export ATPROTO_CLIENT_SECRET="your-client-secret"
export ATPROTO_REDIRECT_URI="https://your-app.com/callback"
atproto-mcp --auth oauth
```

### OAuth Flow

The server implements the standard OAuth 2.0 flow:

```
1. User initiates login
   ↓
2. Server redirects to AT Protocol OAuth
   ↓
3. User authorizes application
   ↓
4. AT Protocol redirects back with code
   ↓
5. Server exchanges code for tokens
   ↓
6. Server stores access & refresh tokens
   ↓
7. User is authenticated
```

### Using OAuth Tools

The server provides MCP tools for OAuth management:

#### Start OAuth Flow

```typescript
// Through your LLM client
"Start the OAuth authentication flow"
```

This returns an authorization URL for the user to visit.

#### Handle OAuth Callback

```typescript
// After user authorizes
"Handle OAuth callback with code: abc123..."
```

#### Refresh Tokens

```typescript
// Refresh expired access tokens
"Refresh my OAuth tokens"
```

#### Revoke Tokens

```typescript
// Log out and revoke tokens
"Revoke my OAuth tokens"
```

### Token Management

The server automatically:
- Stores tokens securely in memory
- Refreshes expired access tokens
- Handles token revocation
- Manages session state

## Authentication Modes Comparison

| Feature | Unauthenticated | App Password | OAuth |
|---------|----------------|--------------|-------|
| **Setup Complexity** | None | Simple | Complex |
| **Security** | N/A | Medium | High |
| **Use Case** | Public data | Development | Production |
| **User Consent** | N/A | Not required | Required |
| **Token Refresh** | N/A | Not needed | Automatic |
| **Multi-user** | ✅ | ❌ | ✅ |
| **Write Operations** | ❌ | ✅ | ✅ |
| **Production Ready** | ✅ | ⚠️ | ✅ |

## Switching Between Modes

### From Unauthenticated to Authenticated

Simply add credentials and restart:

```bash
export ATPROTO_IDENTIFIER="your-handle.bsky.social"
export ATPROTO_PASSWORD="your-app-password"
atproto-mcp
```

### From App Password to OAuth

Update configuration and restart:

```bash
# Remove app password variables
unset ATPROTO_IDENTIFIER
unset ATPROTO_PASSWORD

# Set OAuth variables
export ATPROTO_CLIENT_ID="your-client-id"
export ATPROTO_CLIENT_SECRET="your-client-secret"
atproto-mcp --auth oauth
```

## Troubleshooting

### Authentication Failed

**Problem**: "Authentication failed" error

**Solutions**:
```bash
# Verify credentials
echo $ATPROTO_IDENTIFIER
echo $ATPROTO_PASSWORD

# Check service URL
echo $ATPROTO_SERVICE

# Test with debug logging
atproto-mcp --log-level debug
```

### Invalid App Password

**Problem**: "Invalid password" error

**Solutions**:
- Verify you're using an **app password**, not your main password
- Check for typos or extra spaces
- Generate a new app password
- Ensure the password hasn't been revoked

### Session Expired

**Problem**: "Session expired" error

**Solutions**:
```bash
# Restart the server to create new session
atproto-mcp

# For OAuth, refresh tokens
# (automatic in most cases)
```

### Rate Limiting

**Problem**: "Rate limit exceeded" error

**Solutions**:
- Wait for the rate limit window to reset
- Reduce request frequency
- Implement exponential backoff
- Check rate limit headers in logs

## Security Considerations

### Credential Storage

- **Never** commit credentials to version control
- Use environment variables or secret management
- Encrypt credentials at rest in production
- Use secure secret management (AWS Secrets Manager, HashiCorp Vault)

### Network Security

- Always use HTTPS in production
- Configure proper CORS origins
- Use trusted proxies configuration
- Enable rate limiting

### Access Control

- Use least privilege principle
- Rotate credentials regularly
- Monitor authentication logs
- Revoke unused credentials

### Compliance

- Follow AT Protocol terms of service
- Respect user privacy
- Implement proper data handling
- Maintain audit logs

## Next Steps

- **[Tools & Resources](./tools-resources.md)** - Explore available tools
- **[Examples](../examples/basic-usage.md)** - See authentication in action
- **[Deployment](./deployment.md)** - Deploy with authentication

---

**Previous**: [Configuration](./configuration.md) ← | **Next**: [MCP Protocol](./mcp-protocol.md) →

