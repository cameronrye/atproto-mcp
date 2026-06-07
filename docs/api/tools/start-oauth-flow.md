# start_oauth_flow

Generate a PKCE OAuth authorization URL for AT Protocol authentication.

::: warning Experimental

`start_oauth_flow` only builds a **heuristic** PKCE authorization URL — it does
not perform AT Protocol authorization-server metadata discovery or pushed
authorization requests (PAR), and the constructed `${service}/oauth/authorize`
URL may not be honored by every PDS. More importantly, the login **cannot
complete**: the token-exchange step
([handle_oauth_callback](./handle-oauth-callback.md)) is not implemented, so
this flow is a dead end. See
[Experimental & Roadmap](../../guide/experimental.md).

:::

## Use app passwords instead

For working authentication today, use
[app passwords](../../guide/authentication.md): set `ATPROTO_IDENTIFIER` and
`ATPROTO_PASSWORD` (generate an app password in your Bluesky Settings). No OAuth
setup is required.

## Authentication

**Optional:** Public tool (no authentication required to call it).

## Parameters

### `identifier` (required)

- **Type:** `string`
- **Description:** User identifier (handle or DID).
- **Examples:**
  - Handle: `user.bsky.social`
  - DID: `did:plc:abc123xyz789`

## Response

The tool returns a stringified JSON payload similar to the following
(illustrative — the `authUrl` is generated heuristically and will not lead to a
completed login):

```json
{
  "success": true,
  "authUrl": "https://bsky.social/oauth/authorize?client_id=...&redirect_uri=...&response_type=code&scope=atproto&state=...&code_challenge=...&code_challenge_method=S256",
  "state": "<csrf-state>",
  "instructions": "EXPERIMENTAL: this authorization URL is generated heuristically and the token-exchange step (handle_oauth_callback) is not implemented, so the flow cannot currently complete a login. For working authentication, use app passwords (ATPROTO_IDENTIFIER + ATPROTO_PASSWORD) instead.",
  "expiresIn": 1800
}
```

The returned `state` is bound to a PKCE verifier on the server, and the URL
carries a `code_challenge`/`code_challenge_method=S256` (PKCE). However, even if
a user visits the URL and is redirected back with a code, calling
`handle_oauth_callback` to exchange it always fails — see that tool's page.

## Why this does not complete a login

1. The authorization URL is assembled as `https://<service>/oauth/authorize?...`
   rather than discovered from authorization-server metadata, so it is
   best-effort and PDS-dependent.
2. There is no pushed authorization request (PAR).
3. The authorization-code-to-token exchange in
   [handle_oauth_callback](./handle-oauth-callback.md) is not implemented and
   always returns `OAUTH_NOT_IMPLEMENTED`.

## Related Tools

- **[handle_oauth_callback](./handle-oauth-callback.md)** — Not implemented
  (always errors)
- **[refresh_oauth_tokens](./refresh-oauth-tokens.md)** — Not implemented
- **[revoke_oauth_tokens](./revoke-oauth-tokens.md)** — Not implemented

## See Also

- [Authentication Guide](../../guide/authentication.md) — use app passwords
- [Experimental & Roadmap](../../guide/experimental.md)
