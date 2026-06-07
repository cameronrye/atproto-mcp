# Authentication

This guide covers authentication methods for the AT Protocol MCP Server.

## Overview

The AT Protocol MCP Server supports **two practical modes of operation**:

1. **Unauthenticated Mode** - Access a small set of public tools without
   credentials
2. **App Password Authentication** - The supported path for full functionality

OAuth is also present but **experimental and not implemented end-to-end** — see
[OAuth Authentication](#oauth-authentication-experimental) below.

::: tip Recommended

Use **app passwords**. They are the supported authentication path and unlock the
full tool set. OAuth cannot currently complete a login.

:::

## Unauthenticated Mode

### When to Use

Useful for:

- Quick prototyping against public data
- LLM clients that don't need write access
- Trying the server before creating an app password

### Available Operations

Most tools require authentication. Without credentials, only the **public** and
**enhanced** tools work — notably:

- `get_user_profile` — view a user's public profile (works unauthenticated;
  returns additional viewer-specific data when authenticated)

Some tools provide enhanced data when authenticated but still run
unauthenticated (returning public data), such as `get_followers`, `get_follows`,
and `get_post_context`. Everything that writes (posting, liking, following,
messaging, etc.) and anything that reads your own account state (timeline,
notifications, conversations) requires authentication.

::: warning search_posts requires authentication

`search_posts` does **not** work in unauthenticated mode. It requires
authentication because the AT Protocol search API changed in 2025 to require
auth for search.

:::

### Setup

No setup required. Just start the server:

```bash
atproto-mcp
```

The server automatically runs in unauthenticated mode when no credentials are
provided.

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

For Claude Desktop
(`~/Library/Application Support/Claude/claude_desktop_config.json`):

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

- **Use app passwords**, not your main account password
- **Never commit credentials** to version control
- **Rotate passwords regularly** (every 90 days)
- **Use different passwords** for different environments
- **Revoke unused passwords** in Bluesky settings

## OAuth Authentication (Experimental)

::: warning Experimental — not implemented

OAuth is **not functional end-to-end**. `start_oauth_flow` builds a heuristic
PKCE authorization URL, but the rest of the flow is a **dead end**:
`handle_oauth_callback`, `refresh_oauth_tokens`, and `revoke_oauth_tokens`
**always fail** with an error whose message states that OAuth token exchange is
not implemented (the error's code is `AUTHENTICATION_FAILED`, reaching the
client as a JSON-RPC `-32603` Internal Error). There is no token exchange, so
OAuth cannot produce an authenticated session. Use
**[app passwords](#app-password-authentication)** instead. See
[Experimental & Roadmap](./experimental.md).

:::

### Configuration

OAuth uses a client ID and client secret, supplied via `ATPROTO_CLIENT_ID` and
`ATPROTO_CLIENT_SECRET` (the legacy names `OAUTH_CLIENT_ID` /
`OAUTH_CLIENT_SECRET` are accepted as fallbacks). An optional redirect URI may
be supplied via `ATPROTO_OAUTH_REDIRECT_URI` (or legacy `OAUTH_REDIRECT_URI`);
if unset, the flow falls back to a hardcoded
`http://localhost:3000/oauth/callback` default:

```bash
export ATPROTO_CLIENT_ID="your-client-id"
export ATPROTO_CLIENT_SECRET="your-client-secret"
export ATPROTO_OAUTH_REDIRECT_URI="http://localhost:3000/oauth/callback"
atproto-mcp --auth oauth
```

::: tip

Only the specific name `ATPROTO_REDIRECT_URI` is not read; supply a redirect URI
via `ATPROTO_OAUTH_REDIRECT_URI` (or legacy `OAUTH_REDIRECT_URI`). If unset, the
flow uses a hardcoded `http://localhost:3000/oauth/callback` default. The server
still performs no Authorization-Server metadata discovery or PAR.

:::

### OAuth Tools (current behavior)

| Tool                    | Current behavior                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `start_oauth_flow`      | Builds a heuristic PKCE authorization URL. No metadata discovery / PAR. The flow cannot be completed.               |
| `handle_oauth_callback` | Always fails: no token exchange; returns a JSON-RPC `-32603` error stating OAuth token exchange is not implemented. |
| `refresh_oauth_tokens`  | Always fails: returns a JSON-RPC `-32603` error stating OAuth token exchange is not implemented.                    |
| `revoke_oauth_tokens`   | Always fails: returns a JSON-RPC `-32603` error stating OAuth token exchange is not implemented.                    |

Because the callback exchange is unimplemented, starting the flow leads nowhere.
Track progress on the [Experimental & Roadmap](./experimental.md) page.

## Authentication Modes Comparison

| Feature              | Unauthenticated   | App Password       | OAuth (experimental) |
| -------------------- | ----------------- | ------------------ | -------------------- |
| **Setup Complexity** | None              | Simple             | N/A — not usable     |
| **Use Case**         | Public tools only | Full functionality | Not yet functional   |
| **Write Operations** | No                | Yes                | No (flow incomplete) |
| **Status**           | Supported         | Supported          | Not implemented      |

## Switching Between Modes

### From Unauthenticated to Authenticated

Add app-password credentials and restart:

```bash
export ATPROTO_IDENTIFIER="your-handle.bsky.social"
export ATPROTO_PASSWORD="your-app-password"
atproto-mcp
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
# Restart the server to create a new session
atproto-mcp
```

App-password sessions are re-established on startup; restarting the server is
the simplest fix.

### Rate Limiting

**Problem**: "Rate limit exceeded" error

The server enforces a per-tool limit of **100 requests per minute per tool**.

**Solutions**:

- Wait for the 60-second window to reset
- Reduce request frequency
- Implement exponential backoff in your client

## Security Considerations

### Credential Storage

- **Never** commit credentials to version control
- Use environment variables or secret management
- Encrypt credentials at rest in production
- Use secure secret management (AWS Secrets Manager, HashiCorp Vault)

### Network Security

- The server talks to the AT Protocol service over HTTPS
- It communicates with MCP clients over stdio (no network listener to harden)
- A built-in per-tool rate limit (100 requests/minute) is always on

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

**Previous**: [Configuration](./configuration.md) ← | **Next**:
[MCP Protocol](./mcp-protocol.md) →
