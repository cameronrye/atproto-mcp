# AT Protocol MCP Server - Deployment Guide

This guide covers deploying the AT Protocol MCP Server so that LLM clients (such
as Claude Desktop and other MCP-compatible apps) can use it.

## Overview

The MCP server acts as middleware between LLM clients and the AT Protocol
ecosystem. By default it speaks the **Model Context Protocol over stdio** — the
server is launched as a child process by the MCP client and communicates over
standard input/output, binding no TCP port. With **`--transport http`** it
instead serves the MCP **Streamable HTTP** transport at
`http://<host>:<port>/mcp`.

This gives three supported deployment shapes:

1. **Local stdio process** — the MCP client (e.g. Claude Desktop) spawns
   `atproto-mcp` directly. This is the primary, recommended setup and the
   default.
2. **Docker container running the stdio server** — useful for pinning a specific
   build/runtime or isolating dependencies. The container still communicates
   over stdio.
3. **Streamable HTTP service (`--transport http`)** — a long-running process
   that HTTP-capable MCP clients connect to at `/mcp`. It binds the loopback
   interface (`127.0.0.1`, port `3000`) by default, so only local clients can
   connect; see [Streamable HTTP transport](#streamable-http-transport).

> [!NOTE] End users do not connect to this server directly. They interact with
> their LLM client, which spawns and talks to this MCP server over stdio (or
> connects to `/mcp` in HTTP mode).

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

## Streamable HTTP transport

`--transport http` serves the MCP Streamable HTTP transport instead of stdio.
stdio remains the default and the recommended setup for MCP clients that spawn
the server themselves; use HTTP mode when you want a long-running server that
HTTP-capable MCP clients connect to.

```bash
# Loopback-only (the default binding), port 8080
node dist/cli.js --transport http --port 8080
```

How it works:

- The only route served is **`/mcp`** (`POST`, `GET`, and `DELETE`); any other
  path returns 404, and there is still **no `/health` endpoint**.
- **Sessions:** an `initialize` request opens a session and the server mints an
  `Mcp-Session-Id` header, which the client must echo on every subsequent
  request. `GET` opens the standalone SSE stream for a session and `DELETE`
  terminates it. Each session is backed by its own MCP server instance.
- **Binding:** defaults to the loopback interface (`127.0.0.1`, port `3000`;
  `localhost` is pinned to the IPv4 loopback so the binding is deterministic).
  `--port`/`--host` (or `MCP_SERVER_PORT`/`MCP_SERVER_HOST`) change it.
- **DNS-rebinding protection** is enabled: requests whose `Host` header is not
  in the allowlist computed at bind time are rejected (403). Request bodies are
  capped at 4 MiB.

> [!WARNING] Binding any non-loopback host (e.g. `--host 0.0.0.0`) exposes the
> server to the network. The server adds no transport-level authentication —
> securing that exposure (firewalling, reverse proxy, TLS, authentication) is
> the operator's responsibility.

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

| Variable                | Description                                                                                                        | Required |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| `ATPROTO_IDENTIFIER`    | Your AT Protocol handle or DID (enables authenticated tools)                                                       | No\*     |
| `ATPROTO_PASSWORD`      | Your app password                                                                                                  | No\*     |
| `ATPROTO_SERVICE`       | AT Protocol service (PDS/AppView) URL (default `https://bsky.social`)                                              | No       |
| `ATPROTO_AUTH_METHOD`   | `app-password` (default) or `oauth` (experimental)                                                                 | No       |
| `ATPROTO_CLIENT_ID`     | OAuth client ID (experimental auth path only)                                                                      | No       |
| `ATPROTO_CLIENT_SECRET` | OAuth client secret (experimental auth path only)                                                                  | No       |
| `ATPROTO_MEDIA_DIR`     | Base directory that tool-supplied media file paths must stay within (default: cwd)                                 | No       |
| `MCP_SERVER_NAME`       | Server name advertised to MCP clients (default `atproto-mcp`)                                                      | No       |
| `MCP_SERVER_PORT`       | HTTP port for `--transport http` (default `3000`); the stdio transport ignores it                                  | No       |
| `MCP_SERVER_HOST`       | HTTP bind host for `--transport http` (default `localhost`, pinned to `127.0.0.1`); the stdio transport ignores it | No       |
| `LOG_LEVEL`             | `debug` \| `info` \| `warn` \| `error` (default `info`)                                                            | No       |

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
-t, --transport <mode>  stdio | http (default: stdio)
-s, --service <url>     AT Protocol service URL
-a, --auth <method>     app-password | oauth
-l, --log-level <lvl>   debug | info | warn | error
-p, --port <port>       HTTP port for --transport http (stdio ignores it)
-H, --host <host>       HTTP bind host for --transport http (stdio ignores it)
-v, --version           print version
-h, --help              print usage
```

## Docker Deployment (stdio)

The container runs the same stdio server by default. **Do not publish a port**
for the stdio setup — nothing is listening, so there is nothing to map.

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

> [!NOTE] The Dockerfile intentionally has **no `EXPOSE`** directive — by
> default the server communicates over stdio, binds no port, and exposes no HTTP
> endpoint.

To run the Streamable HTTP transport in a container instead, override the
command and publish the port. Inside a container the loopback default is
unreachable from the host, so bind `0.0.0.0` — and treat the published port as
network exposure to secure:

```bash
docker run --rm -p 3000:3000 \
  -e ATPROTO_IDENTIFIER=your.handle.bsky.social \
  -e ATPROTO_PASSWORD=your-app-password \
  atproto-mcp node dist/cli.js --transport http --host 0.0.0.0
```

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

Important: under the default stdio transport the server binds no port, so a
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

There is **no** `GET /health` HTTP endpoint in either transport mode — even with
`--transport http`, the only route served is `/mcp`. Commands like
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

Most tools require authentication. Confirm credentials are set. The direct
message tools additionally require an app password created with "Allow access to
your direct messages" enabled. Streaming and OAuth tools from older docs were
removed in 0.4.0 — see
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

The Streamable HTTP transport has shipped (see
[Streamable HTTP transport](#streamable-http-transport) above). Still **not
implemented**:

- A real HTTP **health endpoint** (e.g. `GET /health`) that genuinely probes the
  running server — the HTTP transport serves only `/mcp`, and the bundled health
  check remains a process-local smoke check.
- Built-in TLS or transport-level authentication for HTTP mode; put a reverse
  proxy in front if you need them.
- OAuth login (app passwords are the supported authentication path).

## Support

For issues and questions:

- Run with `LOG_LEVEL=debug` and review the logs (stderr).
- Review your environment variables and client configuration.
- Consult the AT Protocol documentation.
- Open a GitHub issue for bugs.
