# revoke_oauth_tokens

Revoke OAuth access and refresh tokens to log out.

## Authentication

**Optional:** Public tool (no authentication required)

## Parameters

### `accessToken` (required)
- **Type:** `string`
- **Description:** Access token to revoke

### `refreshToken` (optional)
- **Type:** `string`
- **Description:** Refresh token to revoke

## Response

```typescript
{
  success: boolean;
  message: string;
}
```

## Examples

### Revoke Both Tokens

```json
{
  "accessToken": "access_token_value",
  "refreshToken": "refresh_token_value"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OAuth tokens revoked successfully. You have been logged out."
}
```

### Revoke Access Token Only

```json
{
  "accessToken": "access_token_value"
}
```

## When to Revoke

### User Logout
- User explicitly logs out
- Revoke both access and refresh tokens
- Clear all session data

### Security Events
- Suspicious activity detected
- Password change
- Account compromise suspected
- Device lost or stolen

### Session Management
- User switches accounts
- Application uninstall
- Session timeout
- Forced logout by admin

## Error Handling

### Common Errors

#### Invalid Token
```json
{
  "error": "Invalid access token",
  "code": "INVALID_TOKEN"
}
```

#### Already Revoked
```json
{
  "error": "Token has already been revoked",
  "code": "TOKEN_REVOKED"
}
```

## Best Practices

### Logout Flow
1. **Call Revoke Tool**: Revoke tokens on server
2. **Clear Storage**: Remove tokens from local storage
3. **Clear Session**: Clear user session data
4. **Clear Cache**: Clear any cached user data
5. **Redirect**: Redirect to login page

### Security
- **Revoke Both**: Always revoke both access and refresh tokens
- **Server-Side**: Perform revocation on server when possible
- **Verify Success**: Confirm revocation succeeded
- **Audit Log**: Log revocation events for security

### Error Handling
- **Graceful Failure**: Clear local tokens even if revocation fails
- **Network Errors**: Handle offline scenarios
- **Already Revoked**: Treat as success if already revoked
- **User Feedback**: Confirm logout to user

### Multi-Device
- **Device Tracking**: Track active sessions per device
- **Selective Revocation**: Allow revoking specific devices
- **Notification**: Notify user of logout on other devices
- **Re-authentication**: Require re-auth for sensitive operations

## Implementation Example

### Web Application
```javascript
async function logout() {
  try {
    // Revoke tokens on server
    await revokeOAuthTokens({
      accessToken: getAccessToken(),
      refreshToken: getRefreshToken()
    });
  } catch (error) {
    console.error('Token revocation failed:', error);
    // Continue with local cleanup even if revocation fails
  } finally {
    // Clear local storage
    clearTokens();
    clearUserData();
    clearCache();
    
    // Redirect to login
    window.location.href = '/login';
  }
}
```

### Mobile Application
```javascript
async function logout() {
  try {
    await revokeTokens();
  } catch (error) {
    // Log error but continue logout
    logError(error);
  }
  
  // Clear secure storage
  await secureStorage.clear();
  
  // Clear app state
  resetAppState();
  
  // Navigate to login
  navigation.navigate('Login');
}
```

## Token Revocation Effects

### Immediate Effects
- Access token becomes invalid
- Refresh token becomes invalid
- All API requests with these tokens fail
- User is effectively logged out

### Cascading Effects
- Active sessions terminated
- Cached data may become stale
- Real-time connections closed
- Pending operations may fail

## Security Considerations

### Token Leakage
If tokens are compromised:
1. Revoke immediately
2. Force password reset
3. Audit account activity
4. Notify user of security event

### Partial Revocation
- Revoking access token only: User can get new access token with refresh token
- Revoking refresh token only: Access token remains valid until expiration
- **Best Practice**: Always revoke both

### Revocation Verification
```javascript
async function verifyRevocation(accessToken) {
  try {
    // Try to use the token
    await makeAuthenticatedRequest(accessToken);
    return false; // Token still valid
  } catch (error) {
    if (error.code === 'AUTHENTICATION_FAILED') {
      return true; // Token successfully revoked
    }
    throw error;
  }
}
```

## Related Tools

- **[start_oauth_flow](./start-oauth-flow.md)** - Start OAuth flow
- **[handle_oauth_callback](./handle-oauth-callback.md)** - Complete OAuth flow
- **[refresh_oauth_tokens](./refresh-oauth-tokens.md)** - Refresh access tokens

## See Also

- [Authentication Guide](../../guide/authentication.md)
- [Session Management](../../guide/authentication.md#session-management)
- [Security Best Practices](../../guide/authentication.md#security)

