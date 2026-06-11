# AT Protocol

A short background page on the Authenticated Transfer Protocol (atproto) — just
enough context to understand what this MCP server talks to. For authoritative,
up-to-date details, follow the links to the official documentation rather than
relying on this summary.

## What is AT Protocol?

The **Authenticated Transfer Protocol (AT Protocol or atproto)** is an open,
decentralized protocol for large-scale social applications, created by Bluesky.
Users own their identity and data, and can move between services without losing
their social graph or content.

This MCP server is a client of the AT Protocol: it authenticates against a
Personal Data Server (by default `bsky.social`) and exposes protocol operations
as MCP tools, resources, and prompts.

If you want to understand the protocol itself in depth, start here:

- [AT Protocol overview](https://atproto.com) — concepts, specifications, and
  guides
- [Lexicon reference](https://atproto.com/lexicons) — the schemas that define
  records
- [Bluesky API reference](https://docs.bsky.app) — the `app.bsky.*` endpoints
  this server calls
- [`@atproto/api` SDK](https://www.npmjs.com/package/@atproto/api) — the
  official client library

## Core concepts (and the tools that use them)

The table below maps the AT Protocol building blocks to the MCP tools this
server exposes. See the [API Reference](../api/index.md) for the full catalog of
43 tools.

| AT Protocol concept                                                  | What it is                                                                                                            | Related MCP tools                                                                                                                                                        |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Identity** — DIDs (`did:plc:...`) and handles (`name.bsky.social`) | A portable, cryptographic account identifier plus a human-readable handle that maps to it                             | [`get_user_profile`](../api/tools/get-user-profile.md), [`update_profile`](../api/tools/update-profile.md)                                                               |
| **Records** — typed entries in your repository                       | Posts, follows, likes, etc., each described by a [Lexicon](https://atproto.com/lexicons) such as `app.bsky.feed.post` | [`create_post`](../api/tools/create-post.md), [`like_post`](../api/tools/like-post.md), [`repost`](../api/tools/repost.md), [`follow_user`](../api/tools/follow-user.md) |
| **Feeds & timelines** — aggregated views over records                | The home timeline and other feeds assembled by App Views                                                              | [`get_timeline`](../api/tools/get-timeline.md), [`search_posts`](../api/tools/search-posts.md)                                                                           |
| **Embeds & blobs** — images, video, external links                   | Media is uploaded as blobs and referenced from a post's `embed`                                                       | [`upload_image`](../api/tools/upload-image.md)                                                                                                                           |
| **Moderation** — mutes, blocks, reports, labels                      | Per-user and service-level moderation primitives                                                                      | [`mute_user`](../api/tools/mute-user.md), [`block_user`](../api/tools/block-user.md), [`report_content`](../api/tools/report-content.md)                                 |

### Identifiers worth knowing

- **DID** — `did:plc:abc123...`: the stable account identifier that survives
  handle and PDS changes.
- **Handle** — `name.bsky.social` or a custom domain: a human-readable alias for
  a DID.
- **AT-URI** — `at://did:plc:abc123.../app.bsky.feed.post/xyz789`: addresses a
  single record as `at://<DID>/<collection>/<record-key>`.
- **CID** — a content-addressed hash of a record, used to pin and verify an
  exact version.

For the precise formats and rules, see the
[AT Protocol specifications](https://atproto.com/specs/at-uri-scheme).

## Authentication

This server connects to a Personal Data Server and signs requests on your
behalf.

### App passwords (recommended)

App passwords are the supported authentication path. Create one in Bluesky
**Settings → App Passwords**, then provide it to the server via
`ATPROTO_IDENTIFIER` and `ATPROTO_PASSWORD`. App passwords are scoped, can be
revoked individually, and never expose your main password. See
[Authentication](./authentication.md) for setup.

Run without credentials and only the public tools work (notably
[`search_posts`](../api/tools/search-posts.md) and
[`get_user_profile`](../api/tools/get-user-profile.md)); most tools require
authentication.

### OAuth (planned)

AT Protocol supports OAuth 2.0, and Bluesky has shipped it. In this server,
OAuth login is **planned but not yet functional**, so it is not exposed as a
tool — use app passwords for working authentication. See
[Experimental & Roadmap](./experimental.md) for the current state.

## Rate limits

The AT Protocol enforces its own rate limits at the PDS, separate from this
server's per-tool limiting. The published numbers change over time, so do not
hard-code them — see the official
[Bluesky rate limits documentation](https://docs.bsky.app/docs/advanced-guides/rate-limits)
for current values.

This server additionally applies a local limit of 100 requests per minute per
tool. When you hit a limit (local or upstream), back off and retry. See
[Error Handling](./error-handling.md) for handling rate-limit responses.

## Where to go deeper

The protocol covers much more than this server uses — federation (relays, App
Views, feed generators), the firehose, custom Lexicons, labeling services, and
rich-text facets. Rather than restate it here (and risk drifting out of date),
consult the authoritative sources:

- [How it works](https://atproto.com/guides/overview) — federation,
  repositories, and data flow
- [Lexicon](https://atproto.com/guides/lexicon) — defining and extending schemas
- [Bluesky API reference](https://docs.bsky.app) — the endpoints behind these
  tools

## Next Steps

- **[Tools & Resources](./tools-resources.md)** - Explore MCP tools
- **[Examples](../examples/basic-usage.md)** - See the tools in action
- **[API Reference](../api/index.md)** - Detailed tool documentation

---

**Previous**: [MCP Protocol](./mcp-protocol.md) ← | **Next**:
[Tools & Resources](./tools-resources.md) →
