# refresh_oauth_tokens

Refresh OAuth access tokens using a refresh token.

## Authentication

**Optional:** Public tool (no authentication required)

## Parameters

### `refreshToken` (required)
- **Type:** `string`
- **Description:** Refresh token from previous authentication

## Response

```typescript
{
  success: boolean;
  session: {
    did: string;          // User's DID
    handle: string;       // User's handle
    expiresAt: string;    // ISO 8601 timestamp when new access token expires
  };
  message: string;
}
```

## Examples

### Refresh Tokens

```json
{
  "refreshToken": "refresh_token_from_previous_auth"
}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "did": "did:plc:abc123xyz789",
    "handle": "alice.bsky.social",
    "expiresAt": "2024-01-15T14:30:00.000Z"
  },
  "message": "OAuth tokens refreshed successfully."
}
```

## When to Refresh

### Access Token Expiration
- Access tokens expire after **2 hours**
- Refresh before expiration for seamless experience
- Implement proactive refresh strategy

### Refresh Strategies

#### Proactive Refresh
Refresh tokens before they expire:
```javascript
// Refresh 5 minutes before expiration
const expiresAt = new Date(session.expiresAt);
const refreshAt = new Date(expiresAt.getTime() - 5 * 60 * 1000);

if (Date.now() >= refreshAt.getTime()) {
  await refreshTokens();
}
```

#### Reactive Refresh
Refresh when API returns 401:
```javascript
try {
  await apiCall();
} catch (error) {
  if (error.code === 'AUTHENTICATION_FAILED') {
    await refreshTokens();
    await apiCall(); // Retry
  }
}
```

#### Background Refresh
Refresh periodically in background:
```javascript
setInterval(async () => {
  if (shouldRefresh()) {
    await refreshTokens();
  }
}, 60 * 60 * 1000); // Check every hour
```

## Error Handling

### Common Errors

#### Invalid Refresh Token
```json
{
  "error": "Invalid or expired refresh token",
  "code": "INVALID_GRANT"
}
```

#### Refresh Token Expired
```json
{
  "error": "Refresh token has expired",
  "code": "EXPIRED_TOKEN"
}
```

#### Refresh Token Revoked
```json
{
  "error": "Refresh token has been revoked",
  "code": "TOKEN_REVOKED"
}
```

## Best Practices

### Token Management
- **Store Securely**: Keep refresh tokens in secure storage
- **Update Storage**: Replace old tokens with new ones
- **Track Expiration**: Monitor refresh token expiration (90 days)
- **Rotation**: Implement token rotation for security

### Error Recovery
- **Re-authentication**: Prompt user to log in again if refresh fails
- **Clear Session**: Clear stored tokens on refresh failure
- **User Notification**: Inform user of session expiration
- **Graceful Degradation**: Handle expired sessions gracefully

### Performance
- **Minimize Refreshes**: Don't refresh unnecessarily
- **Cache Tokens**: Cache new tokens immediately
- **Async Refresh**: Refresh asynchronously to avoid blocking
- **Queue Requests**: Queue API requests during refresh

### Security
- **Secure Storage**: Encrypt refresh tokens at rest
- **Secure Transport**: Only send over HTTPS
- **Token Binding**: Bind tokens to specific devices/sessions
- **Revocation**: Implement token revocation on logout

## Token Lifecycle

### Access Token
- **Lifetime**: 2 hours
- **Purpose**: Authenticate API requests
- **Refresh**: Use refresh token to get new access token
- **Storage**: Short-term secure storage

### Refresh Token
- **Lifetime**: 90 days
- **Purpose**: Obtain new access tokens
- **Refresh**: Cannot be refreshed (must re-authenticate)
- **Storage**: Long-term secure storage

## Implementation Example

### Web Application
```javascript
class TokenManager {
  async refreshIfNeeded() {
    const expiresAt = this.getTokenExpiration();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (now >= expiresAt - fiveMinutes) {
      const refreshToken = this.getRefreshToken();
      const result = await this.refreshTokens(refreshToken);
      this.storeTokens(result.session);
      return true;
    }
    return false;
  }
}
```

### Mobile Application
```javascript
class AuthManager {
  async ensureValidToken() {
    if (this.isTokenExpired()) {
      try {
        await this.refreshTokens();
      } catch (error) {
        await this.logout();
        throw new Error('Session expired. Please log in again.');
      }
    }
  }
}
```

## Related Tools

- **[start_oauth_flow](./start-oauth-flow.md)** - Start OAuth flow
- **[handle_oauth_callback](./handle-oauth-callback.md)** - Complete OAuth flow
- **[revoke_oauth_tokens](./revoke-oauth-tokens.md)** - Revoke tokens and logout

## See Also

- [Authentication Guide](../../guide/authentication.md)
- [Token Management](../../guide/authentication.md#token-management)
- [Security Best Practices](../../guide/authentication.md#security)

