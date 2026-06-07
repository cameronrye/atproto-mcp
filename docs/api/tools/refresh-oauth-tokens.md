# refresh_oauth_tokens

Refresh OAuth access tokens using a refresh token.

::: danger Not implemented

`refresh_oauth_tokens` is registered and visible to MCP clients but is **not
functional** — OAuth token refresh is not implemented, so this tool **always**
returns an error (`OAUTH_NOT_IMPLEMENTED`). See
[Experimental & Roadmap](../../guide/experimental.md).

:::

## Use app passwords instead

Because the OAuth flow never issues tokens (see
[handle_oauth_callback](./handle-oauth-callback.md)), there is nothing to
refresh. For working authentication, use
[app passwords](../../guide/authentication.md): set `ATPROTO_IDENTIFIER` and
`ATPROTO_PASSWORD` (generate an app password in your Bluesky Settings).

## Authentication

**Optional:** Public tool (no authentication required) — but it never succeeds.

## Parameters

### `refreshToken` (required)

- **Type:** `string`
- **Description:** Refresh token from a previous authentication.

## Behavior

The call always throws and returns an error regardless of the input:

```json
{
  "error": "OAuth token exchange is not implemented. Use app-password authentication (ATPROTO_IDENTIFIER + ATPROTO_PASSWORD), or complete the OAuth flow with a real AT Protocol authorization server. This server can generate an authorization URL (start_oauth_flow) but cannot yet exchange the authorization code for tokens.",
  "code": "OAUTH_NOT_IMPLEMENTED"
}
```

No refreshed session is fabricated.

## Related Tools

- **[start_oauth_flow](./start-oauth-flow.md)** — Generate a heuristic OAuth
  authorization URL (experimental, also a dead end)
- **[handle_oauth_callback](./handle-oauth-callback.md)** — Not implemented
- **[revoke_oauth_tokens](./revoke-oauth-tokens.md)** — Not implemented

## See Also

- [Authentication Guide](../../guide/authentication.md) — use app passwords
- [Experimental & Roadmap](../../guide/experimental.md)
