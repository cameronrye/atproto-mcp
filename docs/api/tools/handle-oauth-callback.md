# handle_oauth_callback

Handle OAuth callback and exchange authorization code for access tokens.

## Authentication

**Optional:** Public tool (no authentication required)

## Parameters

### `code` (required)
- **Type:** `string`
- **Description:** Authorization code from OAuth callback

### `state` (required)
- **Type:** `string`
- **Description:** State parameter from OAuth callback (must match original)

## Response

```typescript
{
  success: boolean;
  session: {
    did: string;          // User's DID
    handle: string;       // User's handle
    expiresAt: string;    // ISO 8601 timestamp when access token expires
  };
  message: string;
}
```

## Examples

### Handle OAuth Callback

```json
{
  "code": "authorization_code_from_callback",
  "state": "abc123xyz789"
}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "did": "did:plc:abc123xyz789",
    "handle": "alice.bsky.social",
    "expiresAt": "2024-01-15T12:30:00.000Z"
  },
  "message": "OAuth authentication completed successfully. You can now use AT Protocol tools."
}
```

## OAuth Callback Flow

### 1. User Completes Authorization
After visiting the authorization URL from `start_oauth_flow`, the user:
- Logs in to their AT Protocol account
- Reviews requested permissions
- Grants or denies access

### 2. Redirect to Your Application
The OAuth provider redirects to your redirect URI with parameters:
```
https://your-app.com/oauth/callback?code=AUTH_CODE&state=STATE_VALUE
```

### 3. Extract Parameters
Extract `code` and `state` from the callback URL:
```javascript
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const state = urlParams.get('state');
```

### 4. Call This Tool
Pass the extracted parameters to complete authentication:
```json
{
  "code": "extracted_code",
  "state": "extracted_state"
}
```

## Error Handling

### Common Errors

#### Invalid Authorization Code
```json
{
  "error": "Invalid or expired authorization code",
  "code": "INVALID_GRANT"
}
```

#### State Mismatch
```json
{
  "error": "State parameter does not match",
  "code": "INVALID_STATE"
}
```

#### Authorization Denied
```json
{
  "error": "User denied authorization",
  "code": "ACCESS_DENIED"
}
```

#### Expired Code
```json
{
  "error": "Authorization code has expired",
  "code": "EXPIRED_CODE"
}
```

## Best Practices

### Security
- **Validate State**: Always verify state matches the original value
- **One-Time Use**: Authorization codes can only be used once
- **Time Limit**: Codes expire after 10 minutes
- **Secure Transport**: Only use HTTPS for callbacks

### Token Management
- **Store Securely**: Store access and refresh tokens securely
- **Encrypt Storage**: Use encryption for token storage
- **HttpOnly Cookies**: Use httpOnly cookies for web applications
- **Token Rotation**: Implement token rotation for security

### Error Handling
- **User-Friendly Messages**: Provide clear error messages
- **Retry Logic**: Allow users to retry authorization
- **Logging**: Log errors for debugging (without exposing tokens)
- **Fallback**: Provide alternative authentication methods

### Session Management
- **Create Session**: Create user session after successful authentication
- **Store User Info**: Store DID and handle for future requests
- **Track Expiration**: Monitor token expiration and refresh proactively
- **Logout Handling**: Implement proper logout with token revocation

## Token Storage

### Web Applications
```javascript
// Store in httpOnly cookie (server-side)
res.cookie('access_token', accessToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 7200000 // 2 hours
});
```

### Mobile Applications
- Use secure storage (Keychain on iOS, Keystore on Android)
- Encrypt tokens before storage
- Clear tokens on logout

### Desktop Applications
- Use OS-specific secure storage
- Encrypt tokens at rest
- Clear tokens on application exit

## Session Information

### DID (Decentralized Identifier)
- Permanent user identifier
- Never changes
- Use for internal references

### Handle
- User-friendly identifier
- Can change
- Use for display purposes

### Expires At
- When access token expires (typically 2 hours)
- Refresh before expiration
- Use `refresh_oauth_tokens` to get new tokens

## Related Tools

- **[start_oauth_flow](./start-oauth-flow.md)** - Start OAuth flow
- **[refresh_oauth_tokens](./refresh-oauth-tokens.md)** - Refresh access tokens
- **[revoke_oauth_tokens](./revoke-oauth-tokens.md)** - Revoke tokens and logout

## See Also

- [Authentication Guide](../../guide/authentication.md)
- [OAuth Flow Diagram](../../guide/authentication.md#oauth-flow)
- [Security Best Practices](../../guide/authentication.md#security)

