# Error Handling

How the AT Protocol MCP Server reports errors, and patterns your client can use
to handle them.

For step-by-step fixes to specific symptoms, see
[Troubleshooting](./troubleshooting.md). This page focuses on concepts: what
errors look like on the wire, what the server's internal error types are, and
example handling patterns you implement **on the client side**.

## What an Error Looks Like Over the Wire

The server speaks JSON-RPC 2.0 over stdio. When a tool call fails, the client
receives a standard JSON-RPC error object.

| Code   | Name             | When it is used                                                                  |
| ------ | ---------------- | -------------------------------------------------------------------------------- |
| -32700 | Parse Error      | Invalid JSON received                                                            |
| -32600 | Invalid Request  | Malformed JSON-RPC request                                                       |
| -32601 | Method Not Found | Unknown JSON-RPC method                                                          |
| -32602 | Invalid Params   | A tool's input failed validation, or the tool name is unknown                    |
| -32603 | Internal Error   | Everything else: auth failures, rate limits, network errors, unexpected failures |

Two cases map to specific codes:

- **Validation failures** (a tool argument that fails its schema) surface as
  **`-32602` Invalid Params**, with the validation message.
- **Unknown tool names** also surface as **`-32602` Invalid Params**.

Every other failure — including authentication errors, rate-limit rejections,
and AT Protocol/network errors — is sanitized and returned as **`-32603`
Internal Error**. The server deliberately strips internal detail (stack traces,
raw upstream payloads) from the message before it crosses the wire.

A typical error response:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32603,
    "message": "Tool execution failed: <sanitized message>",
    "data": { "tool": "create_post" }
  }
}
```

::: warning Illustrative shapes

The exact `message` and `data` contents depend on the failure and on
sanitization, so treat the JSON in this guide as illustrative rather than a
guaranteed schema. Successful tool results are likewise returned as
**stringified JSON text content**, not a structured object.

:::

## Internal Error Types

Inside the server, failures are represented by a small hierarchy of error
classes (defined in `src/types/index.ts`). These are **server-internal**: they
are caught and translated into the JSON-RPC codes above before reaching the
client. Knowing them helps when reading debug logs.

All extend `BaseError`, which carries a string `code`, a `timestamp`, and an
optional `context` object.

| Class                 | `code` string           | Notes                                                                                                      |
| --------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `AuthenticationError` | `AUTHENTICATION_FAILED` | Auth required or failed (HTTP 401 upstream). Mapped to `-32603`.                                           |
| `RateLimitError`      | `RATE_LIMIT_EXCEEDED`   | Carries an optional `retryAfter` (seconds). Mapped to `-32603`.                                            |
| `ValidationError`     | `VALIDATION_ERROR`      | Carries `field`/`value`. Mapped to **`-32602`**.                                                           |
| `ConfigurationError`  | `CONFIGURATION_ERROR`   | Invalid configuration, raised at startup/config load.                                                      |
| `AtpError`            | varies                  | Base for AT Protocol errors; also used as a fallback (`UNKNOWN_ERROR`) for unrecognized upstream failures. |
| `McpError`            | `MCP_<code>`            | Carries an MCP/JSON-RPC numeric code.                                                                      |

These classes expose a string `code` property (e.g.
`error.code === 'RATE_LIMIT_EXCEEDED'`), not a `type` property. There is no
separate `AuthorizationError`, `NotFoundError`, `NetworkError`,
`ToolExecutionError`, `ResourceReadError`, or `PromptGenerationError` —
non-validation HTTP `4xx` responses from the API collapse into
`ValidationError`, and anything unrecognized becomes a generic `AtpError`.

## Common Failures and How to Respond

### Authentication Required

Raised when a tool needs a session and none is available, or credentials are
wrong. Reaches the client as `-32603` with a message indicating authentication
is required.

**Respond by**: setting credentials before launching the server (app password
from Bluesky **Settings &rarr; App Passwords**):

```bash
export ATPROTO_IDENTIFIER="your-handle.bsky.social"
export ATPROTO_PASSWORD="xxxx-xxxx-xxxx-xxxx"
atproto-mcp
```

Without credentials the server still runs, but only public tools (notably
`get_user_profile`) work; `search_posts` requires authentication (the AT
Protocol search API changed in 2025 to require auth). See
[Troubleshooting &rarr; Authentication](./troubleshooting.md#authentication-issues).

### Invalid Parameters

A tool argument failed its schema. Reaches the client as **`-32602`**; the
message names the offending field.

**Respond by**: validating input before the call. For example, post `text` must
be non-empty and within Bluesky's 300-character limit, and `langs` must be
BCP-47 codes (`en`, `en-US`, `pt-BR`).

### Rate Limit Exceeded

The server enforces a per-tool limit of **100 requests per minute** (a 60-second
sliding window, counted independently for each tool). Exceeding it reaches the
client as `-32603` with a message stating the rate limit was exceeded for that
tool.

**Respond by**: backing off and retrying. The window clears within 60 seconds.
An example client-side backoff is shown below in
[Client-Side Patterns](#client-side-patterns).

Bluesky also enforces its own platform-side limits; a persistent `429` upstream
surfaces here as an internal error too.

### Network / Upstream Errors

Failures reaching the AT Protocol service (or unexpected upstream responses) are
sanitized and returned as `-32603`.

**Respond by**: checking connectivity and the service URL, and retrying
transient failures. See
[Troubleshooting &rarr; Cannot Reach the AT Protocol Service](./troubleshooting.md#cannot-reach-the-at-protocol-service).

## Client-Side Patterns

The snippets below are **example patterns for the code that calls the server**
(your MCP client or integration). They are **not** features the server ships or
runs on your behalf — adapt them to your stack. Because errors arrive as
JSON-RPC error objects, branch on the numeric `code` (and the human-readable
`message`) rather than on a custom `type` field.

### Retry with Backoff

Retry transient failures (rate limits, network blips); do not retry validation
errors.

```typescript
// Example client-side helper — NOT shipped by the server.
async function callWithRetry(
  call: () => Promise<unknown>,
  { maxRetries = 3, baseDelayMs = 1000 } = {}
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await call();
    } catch (err) {
      lastError = err;

      // -32602 (Invalid Params) is client-correctable; don't retry it.
      const code = (err as { code?: number }).code;
      if (code === -32602) throw err;

      // Exponential backoff for everything else (rate limits, network).
      const delay = baseDelayMs * 2 ** attempt;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

### Graceful Degradation

Fall back to a public path when an authenticated one is unavailable — useful if
you sometimes run the server unauthenticated.

```typescript
// Example client-side pattern — NOT shipped by the server.
async function getProfile(actor: string) {
  try {
    return await callAuthenticated('get_user_profile', { actor });
  } catch (err) {
    // get_user_profile also works unauthenticated, so retry the public path.
    if ((err as { code?: number }).code === -32603) {
      return await callPublic('get_user_profile', { actor });
    }
    throw err;
  }
}
```

### Circuit Breaker

If the upstream service is failing repeatedly, stop hammering it for a cooldown
period.

```typescript
// Example client-side pattern — NOT shipped by the server.
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private readonly threshold = 5;
  private readonly cooldownMs = 60_000;

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen()) throw new Error('Circuit breaker is open');
    try {
      const result = await operation();
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      throw error;
    }
  }

  private isOpen(): boolean {
    if (this.failures < this.threshold) return false;
    return Date.now() - this.lastFailureTime < this.cooldownMs;
  }
}
```

### Client-Side Rate Limiting

Throttle requests before they reach the server, so you stay under the
100-per-minute, per-tool budget.

```typescript
// Example client-side pattern — NOT shipped by the server.
class RateLimiter {
  private requests: number[] = [];
  private readonly limit = 100;
  private readonly windowMs = 60_000;

  allow(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);
    if (this.requests.length >= this.limit) return false;
    this.requests.push(now);
    return true;
  }
}
```

## Testing Tools Manually

You can drive the stdio server by hand for quick checks. Keep two things in
mind:

1. Every message needs the JSON-RPC envelope: `jsonrpc: "2.0"` and an `id`.
2. The MCP protocol requires an **`initialize` handshake first** — `tools/list`
   and `tools/call` will not work until the server has been initialized.

Send the handshake, then a request, on stdin (one JSON object per line):

```bash
atproto-mcp <<'EOF'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"manual-test","version":"0.0.0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
EOF
```

To call a tool, send a `tools/call` request after initializing:

```bash
atproto-mcp <<'EOF'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"manual-test","version":"0.0.0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_user_profile","arguments":{"actor":"bsky.app"}}}
EOF
```

Responses are written to stdout as JSON-RPC; logs go to stderr. Add
`--log-level debug` to see the server's internal view of any failure. For real
usage, let your MCP client manage this handshake for you.

## Logging

Use `--log-level` (or `LOG_LEVEL`) to control verbosity. Logs are written to
**stderr** so they never corrupt the JSON-RPC stream on stdout.

```bash
# Development: full detail
atproto-mcp --log-level debug

# Production: errors and warnings only
atproto-mcp --log-level warn
```

Before returning an internal error to the client, the server runs it through an
error sanitizer that strips sensitive detail from the outbound message. Full
detail (including the underlying cause) remains visible in the server's own logs
at `debug` level.

## Next Steps

- **[Troubleshooting](./troubleshooting.md)** — Symptom-to-fix for common issues
- **[Deployment](./deployment.md)** — Production deployment
- **[Tools Reference](../api/index)** — Per-tool parameters and behavior

---

**Previous**: [Tools & Resources](./tools-resources.md) &larr; | **Next**:
[Troubleshooting](./troubleshooting.md) &rarr;
