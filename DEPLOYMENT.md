# AT Protocol MCP Server - Deployment Guide

This guide covers deploying the AT Protocol MCP Server so that LLM clients (such
as Claude Desktop and other MCP-compatible apps) can use it.

## Overview

The MCP server acts as middleware between LLM clients and the AT Protocol
ecosystem. It speaks the **Model Context Protocol over stdio** — the server is
launched as a child process by the MCP client and communicates over standard
input/output. **It does not listen on a TCP port and does not expose an HTTP
endpoint.**

This means there are only two supported deployment shapes today:

1. **Local stdio process** — the MCP client (e.g. Claude Desktop) spawns
   `atproto-mcp` directly. This is the primary, recommended setup.
2. **Docker container running the stdio server** — useful for pinning a specific
   build/runtime or isolating dependencies. The container still communicates
   over stdio; it does not serve HTTP.

> [!NOTE] End users do not connect to this server directly. They interact with
> their LLM client, which spawns and talks to this MCP server over stdio.

## Prerequisites

- Node.js 20+ (the published runtime target; CI tests Node 20, 22, and 24)
- An MCP-compatible client (e.g. Claude Desktop)
- (Optional) An AT Protocol account with an **app password** for authenticated
  tools — without it, only public/enhanced tools such as `get_user_profile` and
  `get_user_connections` work (`search_posts` requires authentication as of the
  2025 AT Protocol API change)
- (Optional) Docker, if you prefer running the server in a container

## Quick Start (stdio)

### Run from a local checkout

```bash
git clone <repository-url>
cd atproto-mcp
pnpm install
pnpm build
```

Then run the server. With no credentials it starts in unauthenticated mode
(public tools only):

```bash
node dist/cli.js
```

To enable authenticated tools, provide an app password (see
[Authentication](#authentication)):

```bash
ATPROTO_IDENTIFIER=your.handle.bsky.social \
ATPROTO_PASSWORD=your-app-password \
node dist/cli.js
```

A `.env` file in the working directory is loaded automatically (real environment
variables take precedence). Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

### Wire it into an MCP client (Claude Desktop)

Add the server to your client's MCP configuration. For Claude Desktop, edit
`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "atproto": {
      "command": "node",
      "args": ["/absolute/path/to/atproto-mcp/dist/cli.js"],
      "env": {
        "ATPROTO_IDENTIFIER": "your.handle.bsky.social",
        "ATPROTO_PASSWORD": "your-app-password"
      }
    }
  }
}
```

The client launches the process and communicates over stdio. Restart the client
after changing its configuration.

## Authentication

App passwords are the supported, fully-working authentication method.

1. In Bluesky, go to **Settings → App Passwords** and create a new app password.
2. Set `ATPROTO_IDENTIFIER` (your handle) and `ATPROTO_PASSWORD` (the app
   password — **not** your main account password).

Without credentials, the server still runs, but only public, read-only tools are
available. Most tools require authentication.

> [!NOTE] OAuth is **experimental and incomplete** — the token-exchange step is
> not implemented, so an OAuth login cannot complete. Use app passwords.

## Configuration

### Environment Variables

The server reads the following environment variables. Unrelated settings (a
server port/host, Redis, or monitoring infrastructure) are **not** consulted.

| Variable                | Description                                                                            | Required |
| ----------------------- | -------------------------------------------------------------------------------------- | -------- |
| `ATPROTO_IDENTIFIER`    | Your AT Protocol handle or DID (enables authenticated tools)                           | No\*     |
| `ATPROTO_PASSWORD`      | Your app password                                                                      | No\*     |
| `ATPROTO_SERVICE`       | AT Protocol service (PDS/AppView) URL (default `https://bsky.social`)                  | No       |
| `ATPROTO_AUTH_METHOD`   | `app-password` (default) or `oauth` (experimental)                                     | No       |
| `ATPROTO_CLIENT_ID`     | OAuth client ID (experimental auth path only)                                          | No       |
| `ATPROTO_CLIENT_SECRET` | OAuth client secret (experimental auth path only)                                      | No       |
| `ATPROTO_MEDIA_DIR`     | Base directory that tool-supplied media file paths must stay within (default: cwd)     | No       |
| `ATPROTO_RELAY`         | Firehose relay WebSocket URL for experimental streaming (default `wss://bsky.network`) | No       |
| `MCP_SERVER_NAME`       | Server name advertised to MCP clients (default `atproto-mcp`)                          | No       |
| `MCP_SERVER_PORT`       | Accepted but **reserved/ignored**: stdio transport binds no port                       | No       |
| `MCP_SERVER_HOST`       | Accepted but **reserved/ignored**: stdio transport binds no host                       | No       |
| `LOG_LEVEL`             | `debug` \| `info` \| `warn` \| `error` (default `info`)                                | No       |

\* App-password auth requires `ATPROTO_IDENTIFIER` **and** `ATPROTO_PASSWORD`
together. Both are optional overall — omit them to run in unauthenticated mode.

`NODE_ENV` is read by the runtime in the usual way: in `development`, error
messages returned to clients are more detailed; in `production`, they are
sanitized.

The experimental OAuth path also accepts the legacy fallback names
`OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` (aliases for `ATPROTO_CLIENT_ID` /
`ATPROTO_CLIENT_SECRET`), and reads the redirect URI from
`ATPROTO_OAUTH_REDIRECT_URI` (falling back to `OAUTH_REDIRECT_URI`).

### CLI Flags

```text
-s, --service <url>     AT Protocol service URL
-a, --auth <method>     app-password | oauth
-l, --log-level <lvl>   debug | info | warn | error
-p, --port <port>       reserved/ignored (stdio transport binds no port)
-h, --host <host>       reserved/ignored (stdio transport binds no host)
-v, --version           print version
    --help              print usage
```

## Docker Deployment (stdio)

The container runs the same stdio server. **Do not publish a port** — the server
does not serve HTTP, so there is nothing listening to map.

### Build

```bash
docker build -t atproto-mcp .
```

### Run

```bash
docker run -i --rm \
  -e ATPROTO_IDENTIFIER=your.handle.bsky.social \
  -e ATPROTO_PASSWORD=your-app-password \
  atproto-mcp
```

The `-i` flag keeps stdin open so the MCP client can drive the server over
stdio. There is intentionally no `-p 3000:3000` mapping.

> [!NOTE] The Dockerfile intentionally has **no `EXPOSE`** directive — the
> server communicates over stdio, binds no port, and exposes no HTTP endpoint.

### Using the container from an MCP client

Point your client at `docker` instead of `node`:

```json
{
  "mcpServers": {
    "atproto": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "ATPROTO_IDENTIFIER",
        "-e",
        "ATPROTO_PASSWORD",
        "atproto-mcp"
      ],
      "env": {
        "ATPROTO_IDENTIFIER": "your.handle.bsky.social",
        "ATPROTO_PASSWORD": "your-app-password"
      }
    }
  }
}
```

## Health Check

The repository ships a process-local smoke check at `dist/health-check.js`,
wired into the Docker image's `HEALTHCHECK`:

```bash
node dist/health-check.js
```

Important: because the server speaks MCP over stdio and binds no port, a
separate health-check process **cannot connect to the running server to probe
it**. This script instead:

- loads the package,
- constructs the server (which builds and **validates the configuration**,
  throwing on bad config), and
- checks the **current process's own heap usage** (failing if heap is nearly
  exhausted).

It deliberately does **not** report uptime, cache size, or connection counts of
the running server — a fresh process cannot observe those. It exits `0` on
success and `1` on failure, which is what the Docker `HEALTHCHECK` consumes.

There is **no** `GET /health` HTTP endpoint. Commands like
`curl http://localhost:3000/health` do not apply to this server.

## Security Considerations

See
[SECURITY.md](https://github.com/cameronrye/atproto-mcp/blob/main/SECURITY.md)
for the full policy. Deployment essentials:

- **Use app passwords**, never your main account password, and never commit
  credentials. Pass them via environment variables or your client's `env` block.
- The container already runs as a **non-root user**.
- Each tool invocation is **rate limited** (100 requests per minute per tool) to
  guard against runaway loops.
- Error details returned to clients are **sanitized** in production
  (`NODE_ENV=production`).
- Keep dependencies current with `pnpm audit` and `pnpm update`.

## Troubleshooting

### Authentication failures

- Verify the handle/DID in `ATPROTO_IDENTIFIER`.
- Confirm `ATPROTO_PASSWORD` is a Bluesky **app password**, not your account
  password.
- Confirm `ATPROTO_SERVICE` points at the right PDS/AppView (default
  `https://bsky.social`).

### A tool reports it is not available

Most tools require authentication. Confirm credentials are set. Some tools are
experimental stubs (streaming, OAuth completion) and are intentionally
non-functional — see
[Experimental & Roadmap](https://cameronrye.github.io/atproto-mcp/guide/experimental).

### Enable debug logging

```bash
LOG_LEVEL=debug node dist/cli.js
# or
node dist/cli.js --log-level debug
```

In Docker, set `-e LOG_LEVEL=debug` on the `docker run` command. Logs are
written to stderr, so they do not interfere with the stdio MCP protocol on
stdout.

## Roadmap / Planned (not yet available)

> [!WARNING] Everything in this section is a **future idea** and is **not
> implemented**. Today the server is stdio-only with no network listener.

A future version could add an **HTTP/SSE transport** so the server can be hosted
as a long-running network service rather than spawned per-client. That would
make the following possible (none of which exist yet):

- A real HTTP **health endpoint** (e.g. `GET /health`) that genuinely probes the
  running server, replacing the current process-local smoke check.
- Remote/multi-client access over the network, with TLS termination via a
  reverse proxy and proper CORS configuration.
- Horizontal scaling behind a load balancer.

Until that transport ships, ignore any reference (in older docs or reserved
`--port`/`--host` flags) implying an HTTP server, bound port, or `/health` HTTP
endpoint.

## Support

For issues and questions:

- Run with `LOG_LEVEL=debug` and review the logs (stderr).
- Review your environment variables and client configuration.
- Consult the AT Protocol documentation.
- Open a GitHub issue for bugs.
