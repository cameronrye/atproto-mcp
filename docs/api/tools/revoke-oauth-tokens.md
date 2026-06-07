# revoke_oauth_tokens

Revoke OAuth access and refresh tokens to log out.

::: danger Not implemented

`revoke_oauth_tokens` is registered and visible to MCP clients but is **not
functional** — OAuth token revocation is not implemented, so this tool
**always** returns an error (`OAUTH_NOT_IMPLEMENTED`) rather than reporting
success for a no-op. See [Experimental & Roadmap](../../guide/experimental.md).

:::

## Use app passwords instead

The OAuth flow never issues tokens (see
[handle_oauth_callback](./handle-oauth-callback.md)), so there is nothing to
revoke. For working authentication, use
[app passwords](../../guide/authentication.md): set `ATPROTO_IDENTIFIER` and
`ATPROTO_PASSWORD` (generate an app password in your Bluesky Settings). To stop
using an app password, delete it from your Bluesky Settings.

## Authentication

**Optional:** Public tool (no authentication required) — but it never succeeds.

## Parameters

### `accessToken` (required)

- **Type:** `string`
- **Description:** Access token to revoke.

### `refreshToken` (optional)

- **Type:** `string`
- **Description:** Refresh token to revoke.

## Behavior

The call always throws and returns an error regardless of the input. It does not
silently succeed for a no-op:

```json
{
  "error": "OAuth token exchange is not implemented. Use app-password authentication (ATPROTO_IDENTIFIER + ATPROTO_PASSWORD), or complete the OAuth flow with a real AT Protocol authorization server. This server can generate an authorization URL (start_oauth_flow) but cannot yet exchange the authorization code for tokens.",
  "code": "OAUTH_NOT_IMPLEMENTED"
}
```

## Related Tools

- **[start_oauth_flow](./start-oauth-flow.md)** — Generate a heuristic OAuth
  authorization URL (experimental, also a dead end)
- **[handle_oauth_callback](./handle-oauth-callback.md)** — Not implemented
- **[refresh_oauth_tokens](./refresh-oauth-tokens.md)** — Not implemented

## See Also

- [Authentication Guide](../../guide/authentication.md) — use app passwords
- [Experimental & Roadmap](../../guide/experimental.md)
