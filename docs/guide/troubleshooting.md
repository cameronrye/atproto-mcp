# Troubleshooting

Common issues and fixes for the AT Protocol MCP Server.

This server speaks the
[Model Context Protocol](https://modelcontextprotocol.io/) over **stdio only** —
it is launched by your MCP client (Claude Desktop, an IDE, your own script) and
communicates over stdin/stdout. It does **not** bind a network port, so there is
no HTTP endpoint, no `localhost:3000`, and no `/health` URL to curl.

This page is symptom &rarr; fix. For error codes and recovery patterns, see
[Error Handling](./error-handling.md).

## Installation & Build Issues

### Node.js Version Error

**Symptom**: An error about the Node.js version being too old.

```
Error: The engine "node" is incompatible with this module
```

**Fix**: This project requires Node.js 20 or newer.

```bash
# Check current version
node --version

# Install Node.js 20+ using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Verify
node --version  # Should show v20.x.x or newer
```

### Permission Denied (Global Install)

**Symptom**: `EACCES: permission denied` when installing globally.

**Fix**: Configure npm to install global packages without `sudo`.

```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g atproto-mcp
```

### Build Errors (from source)

**Symptom**: Errors such as `Cannot find module 'typescript'` when building from
source.

**Fix**: Reinstall dependencies cleanly. This project uses `pnpm`.

```bash
# Clean and reinstall
rm -rf node_modules
pnpm install

# Rebuild
pnpm build

# If problems persist, clear the package manager cache
pnpm store prune
```

## Authentication Issues

App passwords are the supported authentication path. Set `ATPROTO_IDENTIFIER`
(your handle or DID) and `ATPROTO_PASSWORD` (an **app password**, not your main
account password). Without credentials the server still starts, but only public
tools work (notably `get_user_profile`). `search_posts` requires authentication
(the AT Protocol search API changed in 2025 to require auth), so it is not
available without credentials.

### Authentication Failed

**Symptom**: An "authentication failed" / `AUTHENTICATION_FAILED` error at
startup.

**Fix**: Work through this checklist.

```bash
# 1. Confirm the variables are actually set in this shell
echo $ATPROTO_IDENTIFIER
echo $ATPROTO_PASSWORD

# 2. Set them cleanly (no surrounding quotes, no trailing spaces/newlines)
export ATPROTO_IDENTIFIER=your-handle.bsky.social
export ATPROTO_PASSWORD=xxxx-xxxx-xxxx-xxxx

# 3. Confirm the service URL (defaults to https://bsky.social)
echo $ATPROTO_SERVICE

# 4. Re-run with debug logging to see the underlying error
atproto-mcp --log-level debug
```

Note: when launching via an MCP client, environment variables must be set in
that client's config (for example the `env` block of
`claude_desktop_config.json`), not just in your interactive shell.

### Invalid App Password

**Symptom**: An "invalid password" error even though the handle is correct.

**Fix**:

1. Make sure you are using an **app password**, not your main account password.
2. Generate a fresh one: Bluesky **Settings &rarr; App Passwords &rarr; Add App
   Password**, then copy it immediately.
3. Check the **App Passwords** list for any password you have since revoked.
4. Remove any stray characters (spaces, quotes, newlines) introduced when
   copying.

### Session Expired

**Symptom**: A session/authentication error appears after the server has been
running for a while.

**Fix**: Restart the server (or have your MCP client restart it). On startup it
re-authenticates from `ATPROTO_IDENTIFIER` / `ATPROTO_PASSWORD` and establishes
a new session.

```bash
atproto-mcp
```

## MCP Client Connection Issues

Because the transport is stdio, "connection" problems are almost always about
how the client launches the process, not about networking.

### MCP Client Can't Connect

**Symptom**: Your LLM client reports that it cannot start or reach the server.

**Fix**:

```bash
# 1. Confirm the binary resolves and runs at all
atproto-mcp --version

# 2. Run it directly with debug logging and watch the startup logs.
#    Logs go to stderr, so they will not corrupt the stdio JSON-RPC stream.
atproto-mcp --log-level debug

# 3. Inspect the client config. For Claude Desktop (macOS):
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

A minimal Claude Desktop entry looks like:

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

Common causes:

- `command` is not on the client's `PATH` (use an absolute path, or the full
  path to `node` plus the script).
- Credentials are set in your shell but not in the client config's `env` block.
- Something is writing to **stdout** other than JSON-RPC. Keep diagnostics on
  stderr; debug logging already goes there.

::: tip Test the server by hand

You can drive the stdio server manually for a quick sanity check. The MCP
protocol requires an `initialize` handshake before any other request, and every
message needs the JSON-RPC envelope (`jsonrpc`, `id`). See
[Error Handling &rarr; Testing tools manually](./error-handling.md#testing-tools-manually)
for a working snippet.

:::

### Cannot Reach the AT Protocol Service

**Symptom**: Network errors or timeouts talking to Bluesky.

**Fix**:

```bash
# 1. Basic connectivity
ping bsky.social

# 2. Point at a specific service if needed (default is https://bsky.social)
atproto-mcp --service https://bsky.social

# 3. Check proxy settings if you are behind one
echo $HTTP_PROXY
echo $HTTPS_PROXY

# 4. Ensure outbound HTTPS (443) is allowed by your firewall
```

## Rate Limiting

The server applies a per-tool rate limit of **100 requests per minute** (a
60-second sliding window, counted independently for each tool). Exceeding it
returns a JSON-RPC internal error whose message says the rate limit was
exceeded.

### Rate Limit Exceeded

**Symptom**: `Rate limit exceeded for tool "<name>"` errors.

**Fix**:

- Slow down: the window is 60 seconds per tool, so brief pauses clear it.
- Spread work across tools where it makes sense, since the limit is counted per
  tool.
- In your client, add backoff/retry around tool calls. See
  [Error Handling](./error-handling.md#rate-limit-exceeded) for an example
  client-side backoff pattern.

Keep in mind Bluesky itself also enforces platform-side rate limits; persistent
`429`-style failures may originate upstream rather than from this server.

## Tool & Resource Issues

### Tool Not Found

**Symptom**: An "unknown tool" / `Invalid params` error when calling a tool.

**Fix**:

- Ask your client to list tools (for example, "What tools are available?"). The
  server exposes 60 tools.
- Tool names are `snake_case` (`create_post`, not `createPost`).
- Some tools require authentication; without credentials they are unavailable.
  See [Authentication Issues](#authentication-issues).

### Invalid Parameters

**Symptom**: An `Invalid params` (`-32602`) error.

**Fix**: Each tool validates its arguments with a schema, and the error message
names the offending field.

- Check the parameter types and required fields for the tool (see the
  [Tools reference](../api/index)).
- For `create_post` and replies, `text` must be non-empty and within Bluesky's
  300-character limit.
- Language fields (`langs`) expect BCP-47 codes such as `en`, `en-US`, or
  `pt-BR`.

### Some Tools Are "Not Implemented"

**Symptom**: A tool returns `status: "not_implemented"`, an empty result, or
guidance text instead of doing the work.

**Fix**: This is expected for the experimental/placeholder tools, not a bug:

- The streaming tools (`start_streaming`, `get_recent_events`,
  `monitor_keywords`, and friends) are stubs — firehose decoding is not wired
  up.
- The OAuth completion tools (`handle_oauth_callback`, `refresh_oauth_tokens`,
  `revoke_oauth_tokens`) intentionally fail; only `start_oauth_flow` builds a
  URL, and the flow is a dead end.
- `generate_alt_text` returns writing guidance, not a vision-model analysis.
- The `atproto://conversation-context` resource is a placeholder and reads as
  empty.

See [Experimental & Roadmap](./experimental.md) for the full list and current
status.

### Resource Not Available or Read Fails

**Symptom**: A resource cannot be listed or read.

**Fix**:

- The functional resources (`atproto://timeline`, `atproto://profile`,
  `atproto://notifications`) call the real API and require authentication — set
  your credentials.
- Use the exact URI form, e.g. `atproto://timeline`.
- If reads fail after a long session, the session may have expired; restart the
  server.

## Debugging Tips

### Enable Debug Logging

The `--log-level` flag (or the `LOG_LEVEL` environment variable) controls
verbosity. Logs are written to **stderr**, so they will not interfere with the
stdio JSON-RPC stream on stdout.

```bash
# Maximum verbosity
atproto-mcp --log-level debug

# Or via environment variable
LOG_LEVEL=debug atproto-mcp
```

### Verify Configuration

```bash
# Print the AT Protocol environment variables
env | grep ATPROTO

# Confirm the CLI runs and show available flags
atproto-mcp --help

# Show the version
atproto-mcp --version
```

The configuration-validation smoke check (`dist/health-check.js`) loads the
package, builds and validates the config, and checks this process's heap. It is
**process-local** — it binds no port and does not probe a running server.

## Getting Help

If you are still stuck:

1. **Search existing issues**:
   [GitHub Issues](https://github.com/cameronrye/atproto-mcp/issues)
2. **Check discussions**:
   [GitHub Discussions](https://github.com/cameronrye/atproto-mcp/discussions)
3. **Review the docs**:
   [Full Documentation](https://cameronrye.github.io/atproto-mcp)
4. **Open an issue** and include:
   - Server version (`atproto-mcp --version`)
   - Node.js version (`node --version`)
   - Operating system
   - Error messages (sanitize credentials!)
   - Steps to reproduce and relevant logs

## Next Steps

- **[Error Handling](./error-handling.md)** — Error codes and recovery patterns
- **[Deployment](./deployment.md)** — Run it in production
- **[Contributing](../contributing.md)** — Report bugs or contribute fixes

---

**Previous**: [Error Handling](./error-handling.md) &larr; | **Next**:
[Deployment](./deployment.md) &rarr;
