# handle_oauth_callback

Exchange an OAuth authorization code for AT Protocol access tokens.

::: danger Not implemented

`handle_oauth_callback` is registered and visible to MCP clients but is **not
functional** — the authorization-code-for-token exchange is not implemented, so
this tool **always** returns an authentication error (code
`AUTHENTICATION_FAILED`) whose message explains that token exchange is not
implemented, rather than creating a session. See
[Experimental & Roadmap](../../guide/experimental.md).

:::

## Use app passwords instead

This tool cannot complete a login. For working authentication, use
[app passwords](../../guide/authentication.md): set `ATPROTO_IDENTIFIER` and
`ATPROTO_PASSWORD` (generate an app password in your Bluesky Settings).

## Authentication

**Optional:** Public tool (no authentication required) — but it never succeeds.

## Parameters

### `code` (required)

- **Type:** `string`
- **Description:** Authorization code from the OAuth callback.

### `state` (required)

- **Type:** `string`
- **Description:** State parameter from the OAuth callback (must match the value
  issued by `start_oauth_flow`).

## Behavior

Even when `state` matches a pending authorization started by
[start_oauth_flow](./start-oauth-flow.md), the server does not perform a real
token exchange. The call validates the state binding and then throws an
`AuthenticationError`, so the result is always an error. The long "OAuth token
exchange is not implemented..." text is the error **message**; the error
**code** is `AUTHENTICATION_FAILED` (with HTTP status 401):

```json
{
  "error": "OAuth token exchange is not implemented. Use app-password authentication (ATPROTO_IDENTIFIER + ATPROTO_PASSWORD), or complete the OAuth flow with a real AT Protocol authorization server. This server can generate an authorization URL (start_oauth_flow) but cannot yet exchange the authorization code for tokens.",
  "code": "AUTHENTICATION_FAILED"
}
```

A session is never fabricated — there is no DID, handle, or access token
returned.

## Related Tools

- **[start_oauth_flow](./start-oauth-flow.md)** — Generate a heuristic OAuth
  authorization URL (experimental, also a dead end)
- **[refresh_oauth_tokens](./refresh-oauth-tokens.md)** — Not implemented
- **[revoke_oauth_tokens](./revoke-oauth-tokens.md)** — Not implemented

## See Also

- [Authentication Guide](../../guide/authentication.md) — use app passwords
- [Experimental & Roadmap](../../guide/experimental.md)
