# Configuration

This guide covers the configuration options for the AT Protocol MCP Server.

## Configuration Methods

The server can be configured through:

1. **Environment Variables** - Recommended, especially for MCP client setups
2. **Command Line Arguments** - Quick overrides
3. **`.env` File** - Convenient for local development
4. **MCP Client Configuration** - Client-specific settings (e.g. Claude Desktop)

::: tip Transport

The server communicates over **stdio** only (for MCP clients such as Claude
Desktop). It does **not** listen on a TCP port and exposes no HTTP endpoints.

:::

## Environment Variables

These are the only environment variables the server reads (defined in
`ENV_MAPPINGS` in `src/utils/config.ts`), plus `LOG_LEVEL` (read by the logger).
Any other variable is ignored.

### Authentication

| Variable                | Description                                                                | Required | Default               |
| ----------------------- | -------------------------------------------------------------------------- | -------- | --------------------- |
| `ATPROTO_IDENTIFIER`    | Your AT Protocol handle or DID                                             | No\*     | -                     |
| `ATPROTO_PASSWORD`      | App password for authentication                                            | No\*     | -                     |
| `ATPROTO_SERVICE`       | AT Protocol service URL                                                    | No       | `https://bsky.social` |
| `ATPROTO_AUTH_METHOD`   | Authentication method (`app-password` or `oauth`)                          | No       | `app-password`        |
| `ATPROTO_CLIENT_ID`     | OAuth client ID (experimental — see [Authentication](./authentication.md)) | No       | -                     |
| `ATPROTO_CLIENT_SECRET` | OAuth client secret (experimental)                                         | No       | -                     |

\* Required only for authenticated operations. App passwords are the supported
auth path; see [Authentication](./authentication.md). Without credentials the
server runs in unauthenticated mode (only public tools such as `search_posts`
and `get_user_profile` work).

### Server

| Variable          | Description                                      | Default       |
| ----------------- | ------------------------------------------------ | ------------- |
| `MCP_SERVER_NAME` | Server name advertised over the MCP protocol     | `atproto-mcp` |
| `MCP_SERVER_PORT` | Reserved; **ignored** under the stdio transport  | `3000`        |
| `MCP_SERVER_HOST` | Reserved; **ignored** under the stdio transport  | `localhost`   |
| `LOG_LEVEL`       | Logging level (`debug`, `info`, `warn`, `error`) | `info`        |

::: warning Reserved variables

`MCP_SERVER_PORT` and `MCP_SERVER_HOST` are accepted for forward compatibility
but have **no effect**: the stdio transport binds no port and no host. There is
no HTTP server, no `http://localhost:3000`, and no `/health` or `/metrics`
endpoint.

:::

## Command Line Arguments

Override environment variables with command line flags:

```bash
atproto-mcp [options]
```

### Available Options

These are the only flags the CLI accepts (defined in `src/cli.ts`):

```bash
-p, --port <number>        Server port (reserved; stdio transport ignores it)
-h, --host <string>        Server host (reserved; stdio transport ignores it)
-s, --service <url>        AT Protocol service URL (default: https://bsky.social)
-a, --auth <method>        Authentication method: app-password|oauth
-l, --log-level <level>    Log level: debug|info|warn|error (default: info)
    --help                 Show help message
-v, --version              Show version information
```

### Examples

```bash
# Start with debug logging
atproto-mcp --log-level debug

# Use a custom AT Protocol service (e.g. a self-hosted PDS)
atproto-mcp --service https://custom-pds.example.com

# Select the authentication method explicitly
atproto-mcp --auth app-password
```

## MCP Client Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "atproto": {
      "command": "atproto-mcp",
      "args": ["--log-level", "info"],
      "env": {
        "ATPROTO_IDENTIFIER": "your-handle.bsky.social",
        "ATPROTO_PASSWORD": "your-app-password",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Other MCP Clients

Generic MCP client configuration (the server always uses the stdio transport):

```json
{
  "servers": [
    {
      "name": "atproto",
      "command": "atproto-mcp",
      "transport": "stdio",
      "environment": {
        "ATPROTO_IDENTIFIER": "your-handle.bsky.social",
        "ATPROTO_PASSWORD": "your-app-password"
      }
    }
  ]
}
```

## Environment File (.env)

For local development, create a `.env` file:

```bash
# Copy example file
cp .env.example .env
```

Example `.env` file (only the variables the server actually reads):

```bash
# Authentication (optional — required for authenticated operations)
ATPROTO_IDENTIFIER=your-handle.bsky.social
ATPROTO_PASSWORD=your-app-password
ATPROTO_SERVICE=https://bsky.social
ATPROTO_AUTH_METHOD=app-password

# Server
MCP_SERVER_NAME=atproto-mcp
LOG_LEVEL=debug

# MCP_SERVER_PORT / MCP_SERVER_HOST are reserved and ignored by the
# stdio transport; they are listed here only for completeness.
# MCP_SERVER_PORT=3000
# MCP_SERVER_HOST=localhost
```

## Docker Configuration

### Docker Compose

Configure via `docker-compose.yml`:

```yaml
services:
  atproto-mcp:
    image: atproto-mcp:latest
    environment:
      - ATPROTO_IDENTIFIER=${ATPROTO_IDENTIFIER}
      - ATPROTO_PASSWORD=${ATPROTO_PASSWORD}
      - ATPROTO_SERVICE=https://bsky.social
      - LOG_LEVEL=info
    restart: unless-stopped
```

::: tip

The server speaks stdio, so there is nothing to publish with `ports:`. The
`EXPOSE 3000` line in the image's Dockerfile is vestigial and binds nothing.

:::

### Docker Environment File

Create `.env` for Docker Compose:

```bash
ATPROTO_IDENTIFIER=your-handle.bsky.social
ATPROTO_PASSWORD=your-app-password
ATPROTO_SERVICE=https://bsky.social
LOG_LEVEL=info
```

## Rate Limiting

The server applies a built-in per-tool rate limit of **100 requests per minute
per tool** (a 60-second window enforced by the `SecurityManager`). This is not
configurable via environment variables or CLI flags. Bluesky may apply its own
platform-level limits independently.

## Validation

Validate your setup:

```bash
# Show available flags
atproto-mcp --help

# Start with debug logging to confirm configuration is loaded
atproto-mcp --log-level debug

# Verify the environment variables you've set
env | grep ATPROTO
```

The `ConfigManager` class (`src/utils/config.ts`) builds and validates the
configuration from defaults, environment variables, and overrides at startup.

## Troubleshooting

### Configuration Not Loading

```bash
# Check environment variables
echo $ATPROTO_IDENTIFIER

# Verify .env file contents
cat .env

# Check file permissions
ls -la .env
```

### Authentication Issues

See [Authentication](./authentication.md) for app-password setup and common auth
errors.

## Next Steps

- **[Authentication](./authentication.md)** - Set up authentication
- **[Deployment](./deployment.md)** - Deploy to production
- **[Troubleshooting](./troubleshooting.md)** - Common issues

---

**Previous**: [Installation](./installation.md) ← | **Next**:
[Authentication](./authentication.md) →
