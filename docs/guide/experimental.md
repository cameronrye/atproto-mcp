# Experimental & Roadmap

This page is the single source of truth for capabilities that are **planned,
declined, or recently shipped from this list**. None of the planned features
are exposed as MCP tools today; they are documented here so you know what is
and is not on the roadmap.

::: warning Planned features are not production-ready

Except where a feature is explicitly marked **Shipped**, nothing on this page
works end-to-end today. If you need working functionality, use
[app-password authentication](./authentication.md) and the tools documented in
the [main API reference](../api/index.md).

:::

## Status at a glance

| Feature              | Status                                                                  |
| -------------------- | ----------------------------------------------------------------------- |
| Firehose streaming   | Not planned as tools — leftover firehose client code has been removed   |
| OAuth login          | Planned — not exposed as tools; app passwords are the supported path    |
| AI alt-text          | Planned — no vision model wired in                                      |
| Conversation context | Removed — the placeholder resource was unregistered                     |
| HTTP transport       | **Shipped** — `--transport http` (stdio remains the default)            |

## Firehose streaming

Real-time firehose streaming (keyword/user monitoring of the AT Protocol
firehose) is **not exposed as tools and is no longer on the tool roadmap**:

- MCP tools are request/response. A tool can only return a buffered snapshot of
  past events, not a live stream — advertising that as "streaming" would be
  dishonest, which is why the non-functional streaming tools were removed in
  0.4.0 and never reintroduced.
- The leftover `FirehoseClient` infrastructure (which never decoded the
  CAR / DAG-CBOR firehose frames) and the `ws` WebSocket dependency have now
  been **removed** as well. Earlier docs said this code was retained for future
  work; it no longer is.
- If event consumption is ever added, it would be built fresh against
  [Jetstream](https://docs.bsky.app/blog/jetstream) (Bluesky's JSON-over-
  WebSocket firehose alternative) rather than by reviving the removed client.

If you need a polling-based approximation, [`discover`](../api/tools/discover.md)
with `mode: "trending"` samples your own home timeline.

## OAuth login

App-password authentication is the supported way to authenticate (see
[Authentication](./authentication.md)). OAuth login is on the roadmap but **not
yet functional**, so it is not exposed as a configuration path or a tool.

Use [app passwords](./authentication.md#app-passwords) for any authenticated
workflow.

## AI alt-text generation

AI-assisted alt-text generation is planned but **not yet built** — no vision
model is wired in, so there is no tool that analyzes image content. For media
metadata that is actually derived from an upload, see
[`analyze_image`](../api/tools/analyze-image.md). To extract media references
from an existing post, use
[`get_post_context`](../api/tools/get-post-context.md) with `includeMedia: true`.

## Conversation context resource

The placeholder **`atproto://conversation-context`** resource has been
**removed**. MCP offers no client-write mechanism for resources and no tool
populated its store, so it could only ever read as empty. It would be
re-registered only together with a real population path. The three registered
resources (`atproto://timeline`, `atproto://profile`,
`atproto://notifications`) are functional and call the real API when
authenticated.

## Shipped: HTTP transport

The **Streamable HTTP transport has shipped**: `--transport http` serves MCP at
`http://<host>:<port>/mcp` (loopback `127.0.0.1:3000` by default), with
`--port` / `--host` (or `MCP_SERVER_PORT` / `MCP_SERVER_HOST`) controlling the
binding. stdio remains the default transport and the standard setup for MCP
clients such as Claude Desktop, which spawn the server themselves.

Still not available in HTTP mode: a `GET /health` endpoint (only `/mcp` is
served) and built-in TLS/authentication. See
[Configuration](./configuration.md) and [Deployment](./deployment.md) for
setup and security notes.
