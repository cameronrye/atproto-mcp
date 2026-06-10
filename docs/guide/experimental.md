# Experimental & Roadmap

This page is the single source of truth for capabilities that are **planned but
not yet built**. These features are not exposed as MCP tools today; they are
documented here so you know what is and is not on the roadmap.

::: warning Not production-ready

Nothing on this page works end-to-end today. If you need working functionality,
use [app-password authentication](./authentication.md) and the tools documented
in the [main API reference](../api/index.md).

:::

## Status at a glance

| Feature              | Status                                                            |
| -------------------- | ---------------------------------------------------------------- |
| Firehose streaming   | Planned — not exposed as tools; firehose decoding not built      |
| OAuth login          | Planned — not exposed as tools; app passwords are the supported path |
| AI alt-text          | Planned — no vision model wired in                               |
| Conversation context | Placeholder — `atproto://conversation-context` never auto-populated |
| HTTP transport       | Planned — server is stdio-only today                             |

## Firehose streaming

Real-time firehose streaming (keyword/user monitoring of the AT Protocol
firehose) is on the roadmap but **not yet built**. AT Protocol firehose frames
are CAR / DAG-CBOR encoded, and that decoding has not been implemented yet, so no
streaming tools are exposed.

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

The **`atproto://conversation-context`** resource is registered and readable,
but the server does not auto-populate it during a session. Reading it returns
empty / near-empty context in normal operation. The other three resources
(`atproto://timeline`, `atproto://profile`, `atproto://notifications`) are
functional and call the real API when authenticated.

## Planned: HTTP transport

The server currently communicates **only over stdio** (`StdioServerTransport`) —
the standard transport for MCP clients such as Claude Desktop. It does **not**
listen on a TCP port; the `--port` / `--host` flags and the `MCP_SERVER_PORT` /
`MCP_SERVER_HOST` environment variables are accepted but reserved (ignored by
the stdio transport).

An HTTP / SSE transport — which would enable a long-running networked deployment
with a real health endpoint — is a possible future direction but is **not yet
available**. Until it ships, deploy the server over stdio (see
[Deployment](./deployment.md)).
