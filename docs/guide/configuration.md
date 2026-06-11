# Configuration

This guide covers the configuration options for the AT Protocol MCP Server.

## Configuration Methods

The server can be configured through:

1. **Environment Variables** - Recommended, especially for MCP client setups
2. **Command Line Arguments** - Quick overrides
3. **`.env` File** - Convenient for local development
4. **MCP Client Configuration** - Client-specific settings (e.g. Claude Desktop)

::: tip Transport

By default the server communicates over **stdio** (the standard setup for MCP
clients such as Claude Desktop) and binds no TCP port. With
`--transport http` it instead serves the MCP **Streamable HTTP** transport at
`http://<host>:<port>/mcp` — see
[Command Line Arguments](#command-line-arguments) below and the
[Deployment guide](./deployment.md).

:::

## Environment Variables

The `ConfigManager` reads the variables defined in `ENV_MAPPINGS` in
`src/utils/config.ts` (listed below), plus `LOG_LEVEL` (read by the logger) and
`NODE_ENV` (used to relax validation under `test`). One additional variable is
read directly by a specific subsystem: `ATPROTO_MEDIA_DIR` (base directory that
tool-supplied media file paths must stay within; defaults to the working
directory). Other variables — including the legacy `OAUTH_CLIENT_ID` /
`OAUTH_CLIENT_SECRET` / `OAUTH_REDIRECT_URI` names and the former
`ATPROTO_RELAY` — are ignored.

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
server runs in unauthenticated mode (only public/enhanced tools such as
`get_user_profile` work; tools like `search_posts` require authentication, since
the AT Protocol search API changed in 2025 to require auth).

### Server

| Variable          | Description                                                                 | Default       |
| ----------------- | --------------------------------------------------------------------------- | ------------- |
| `MCP_SERVER_NAME` | Server name advertised over the MCP protocol                                | `atproto-mcp` |
| `MCP_SERVER_PORT` | HTTP port for `--transport http` (the stdio transport ignores it)           | `3000`        |
| `MCP_SERVER_HOST` | HTTP bind host for `--transport http` (the stdio transport ignores it)      | `localhost`   |
| `LOG_LEVEL`       | Logging level (`debug`, `info`, `warn`, `error`)                            | `info`        |

::: warning Port and host only apply to the HTTP transport

`MCP_SERVER_PORT` and `MCP_SERVER_HOST` (and the `--port`/`--host` flags, which
override them) only take effect with `--transport http`. Under the default
stdio transport the server binds no port and no host — there is no HTTP server
and no `/health` or `/metrics` endpoint. In HTTP mode the only route served is
`/mcp`, and `localhost` is pinned to the IPv4 loopback `127.0.0.1`.

:::

## Command Line Arguments

Override environment variables with command line flags:

```bash
atproto-mcp [options]
```

### Available Options

These are the only flags the CLI accepts (defined in `src/cli.ts`):

```bash
-t, --transport <mode>     Transport: stdio|http (default: stdio)
-p, --port <number>        HTTP port for --transport http (default: 3000; stdio ignores it)
-H, --host <string>        HTTP bind host for --transport http (default: 127.0.0.1, loopback; stdio ignores it)
-s, --service <url>        AT Protocol service URL (default: https://bsky.social)
-a, --auth <method>        Authentication method: app-password|oauth (optional)
-l, --log-level <level>    Log level: debug|info|warn|error (default: info)
-h, --help                 Show this help message
-v, --version              Show version information
```

Note that `-h` is the short flag for `--help`; the short flag for `--host` is
the capital `-H`.

### Examples

```bash
# Start with debug logging
atproto-mcp --log-level debug

# Use a custom AT Protocol service (e.g. a self-hosted PDS)
atproto-mcp --service https://custom-pds.example.com

# Select the authentication method explicitly
atproto-mcp --auth app-password

# Serve the Streamable HTTP transport on loopback port 8080
atproto-mcp --transport http --port 8080
```

::: warning HTTP transport binding

`--transport http` binds the loopback interface (`127.0.0.1`) by default, so
only local clients can connect. Binding any other host (e.g. `--host 0.0.0.0`)
exposes the server to the network — securing that exposure (firewalling,
reverse proxy, authentication) is the operator's responsibility.

:::

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

Generic MCP client configuration (the server uses the stdio transport by
default):

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

# MCP_SERVER_PORT / MCP_SERVER_HOST set the default binding for
# `--transport http`; the default stdio transport ignores them.
# MCP_SERVER_PORT=3000
# MCP_SERVER_HOST=localhost
```

## Docker Configuration

### Docker Compose

The repository does not ship a Compose file, but you can define a service of
your own — for example:

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

By default the server speaks stdio, so there is nothing to publish with
`ports:`. The image's Dockerfile deliberately has no `EXPOSE` line — the
container binds no port unless you opt into the HTTP transport. To run the
Streamable HTTP transport in a container instead, override the command with
`node dist/cli.js --transport http --host 0.0.0.0` and publish the port
(`ports: ['3000:3000']`) — and secure that exposure yourself.

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
