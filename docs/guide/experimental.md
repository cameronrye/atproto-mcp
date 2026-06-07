# Experimental & Roadmap

This page is the single source of truth for features that are **registered and
visible to MCP clients but not yet functional**, plus capabilities that are
**planned but not yet built**.

The server deliberately lists every tool and resource in `tools/list` /
`resources/list` regardless of whether it is fully implemented, so a connected
client can discover the full surface area. The features below will appear in
that listing but behave as described here until their underlying implementation
lands.

::: warning Not production-ready

Nothing on this page works end-to-end today. If you need working functionality,
use [app-password authentication](./authentication.md) and the tools documented
in the [main API reference](../api/index.md).

:::

## Status at a glance

| Feature              | Tools / resources                                                                                                   | Status                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Firehose streaming   | `start_streaming`, `stop_streaming`, `get_streaming_status`, `get_recent_events`, `monitor_keywords`, `track_users` | Not implemented — firehose decoding is gated off           |
| OAuth login          | `start_oauth_flow`, `handle_oauth_callback`, `refresh_oauth_tokens`, `revoke_oauth_tokens`                          | Experimental / not implemented — cannot complete a login   |
| AI alt-text          | `generate_alt_text`                                                                                                 | Placeholder — returns writing guidance, not image analysis |
| Conversation context | `atproto://conversation-context`                                                                                    | Placeholder — registered but never auto-populated          |
| HTTP transport       | —                                                                                                                   | Planned — server is stdio-only today                       |

## Firehose streaming

The six streaming tools are wired up but the firehose decoder is disabled behind
a feature flag (`FIREHOSE_DECODING_IMPLEMENTED = false`). AT Protocol firehose
frames are CAR / DAG-CBOR encoded, and that decoding has not been implemented
yet.

Concretely:

- **`start_streaming`** returns `success: false` with
  `subscription.status: "not_implemented"` and never opens a socket.
- **`stop_streaming`** runs, but there is never an active subscription to stop.
- **`get_streaming_status`**, **`get_recent_events`**, **`monitor_keywords`**,
  and **`track_users`** operate on a permanently-empty in-memory event buffer.
  They never error, but they always return zero events and include
  `firehoseDecodingImplemented: false` plus an explanatory `note` in their
  response.

There is no way to receive real-time events until firehose decoding is
implemented.

## OAuth login

App-password authentication is the supported way to authenticate (see
[Authentication](./authentication.md)). The OAuth tools exist but cannot
complete a login:

- **`start_oauth_flow`** builds a heuristic PKCE authorization URL. It does
  **not** perform AT Protocol authorization-server metadata discovery or pushed
  authorization requests (PAR), and because the callback exchange is
  unimplemented, the flow is a dead end. Treat it as **experimental**.
- **`handle_oauth_callback`**, **`refresh_oauth_tokens`**, and
  **`revoke_oauth_tokens`** always return an error (`OAUTH_NOT_IMPLEMENTED`).

Use [app passwords](./authentication.md#app-passwords) for any authenticated
workflow.

## AI alt-text generation

**`generate_alt_text`** is a placeholder. No vision model is wired in, so it
does not analyze image content. It returns alt-text **writing guidance and a
template** to help a human (or an upstream LLM) compose good alt text. For media
metadata that is actually derived from the upload, see
[`analyze_image`](../api/tools/analyze-image.md) and
[`extract_media_from_post`](../api/tools/extract-media-from-post.md).

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
