# start_oauth_flow

Start OAuth authorization flow for AT Protocol authentication.

## Authentication

**Optional:** Public tool (no authentication required to start flow)

## Parameters

### `identifier` (required)
- **Type:** `string`
- **Description:** User identifier (handle or DID)
- **Examples:**
  - Handle: `user.bsky.social`
  - DID: `did:plc:abc123xyz789`

## Response

```typescript
{
  success: boolean;
  authUrl: string;        // Authorization URL to visit
  state: string;          // State parameter for CSRF protection
  instructions: string;   // Instructions for completing flow
  expiresIn: number;      // Seconds until authorization expires (1800 = 30 min)
}
```

## Examples

### Start OAuth Flow

```json
{
  "identifier": "alice.bsky.social"
}
```

**Response:**
```json
{
  "success": true,
  "authUrl": "https://bsky.social/oauth/authorize?client_id=...&state=...&redirect_uri=...",
  "state": "abc123xyz789",
  "instructions": "Visit the authorization URL in your browser, complete the OAuth flow, and use the returned authorization code with the handle_oauth_callback tool.",
  "expiresIn": 1800
}
```

## OAuth Flow Steps

1. **Start Flow** - Call this tool with user identifier
2. **User Authorization** - Direct user to `authUrl` in browser
3. **User Consent** - User logs in and grants permissions
4. **Callback** - User is redirected to your redirect URI with authorization code
5. **Complete Flow** - Call `handle_oauth_callback` with code and state

## Error Handling

### Common Errors

#### Invalid Identifier
```json
{
  "error": "Identifier (handle or DID) is required",
  "code": "VALIDATION_ERROR"
}
```

#### OAuth Not Configured
```json
{
  "error": "OAuth client credentials not configured",
  "code": "CONFIGURATION_ERROR"
}
```

#### User Not Found
```json
{
  "error": "User not found",
  "code": "NOT_FOUND"
}
```

## Configuration

OAuth requires environment variables:

```bash
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_REDIRECT_URI=https://your-app.com/oauth/callback
```

### Obtaining OAuth Credentials

1. Register your application with AT Protocol
2. Provide your redirect URI
3. Receive client ID and secret
4. Store securely in environment variables

## Best Practices

### Security
- **State Parameter**: Always validate state in callback to prevent CSRF
- **HTTPS Only**: Use HTTPS for redirect URIs in production
- **Secure Storage**: Never expose client secret in client-side code
- **Token Storage**: Store tokens securely (encrypted, httpOnly cookies)

### User Experience
- **Clear Instructions**: Explain what permissions are being requested
- **Timeout Handling**: Authorization expires in 30 minutes
- **Error Recovery**: Provide clear error messages and retry options
- **Mobile Support**: Handle mobile OAuth flows appropriately

### Implementation
- **State Management**: Store state parameter to validate callback
- **Redirect Handling**: Implement proper redirect URI endpoint
- **Error Handling**: Handle authorization denials gracefully
- **Session Management**: Maintain user session after authentication

## OAuth Scopes

AT Protocol OAuth supports these scopes:
- `atproto` - Full access to AT Protocol operations
- `transition:generic` - Generic transition scope

## Security Considerations

### PKCE (Proof Key for Code Exchange)
- Recommended for public clients
- Protects against authorization code interception
- Automatically handled by the OAuth client

### Token Lifetime
- Access tokens expire after 2 hours
- Refresh tokens expire after 90 days
- Use `refresh_oauth_tokens` to get new access tokens

## Related Tools

- **[handle_oauth_callback](./handle-oauth-callback.md)** - Complete OAuth flow
- **[refresh_oauth_tokens](./refresh-oauth-tokens.md)** - Refresh access tokens
- **[revoke_oauth_tokens](./revoke-oauth-tokens.md)** - Revoke tokens and logout

## See Also

- [Authentication Guide](../../guide/authentication.md)
- [OAuth Configuration](../../guide/configuration.md#oauth)
- [Security Best Practices](../../guide/authentication.md#security)

