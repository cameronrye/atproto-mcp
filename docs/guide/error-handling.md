# Error Handling

Comprehensive guide to handling errors in the AT Protocol MCP Server.

## Error Types

The server implements a hierarchical error system:

### 1. MCP Protocol Errors

Standard JSON-RPC 2.0 errors:

| Code | Name | Description |
|------|------|-------------|
| -32700 | Parse Error | Invalid JSON received |
| -32600 | Invalid Request | Invalid JSON-RPC request |
| -32601 | Method Not Found | Method does not exist |
| -32602 | Invalid Params | Invalid method parameters |
| -32603 | Internal Error | Internal server error |

### 2. AT Protocol Errors

AT Protocol-specific errors:

| Type | Description | HTTP Status |
|------|-------------|-------------|
| `AuthenticationError` | Authentication failed or required | 401 |
| `AuthorizationError` | Insufficient permissions | 403 |
| `NotFoundError` | Resource not found | 404 |
| `RateLimitError` | Rate limit exceeded | 429 |
| `ValidationError` | Invalid input data | 400 |
| `NetworkError` | Network or connection issue | 503 |

### 3. Application Errors

Server-specific errors:

| Type | Description |
|------|-------------|
| `ToolExecutionError` | Tool execution failed |
| `ResourceReadError` | Resource read failed |
| `PromptGenerationError` | Prompt generation failed |
| `ConfigurationError` | Invalid configuration |

## Error Structure

All errors follow a consistent structure:

```typescript
{
  error: {
    code: number;           // JSON-RPC error code
    message: string;        // Human-readable message
    data?: {                // Additional error details
      type: string;         // Error type
      details: string;      // Detailed description
      context?: object;     // Error context
      stack?: string;       // Stack trace (dev only)
    }
  }
}
```

## Common Errors

### Authentication Required

**Error**:
```json
{
  "error": {
    "code": -32603,
    "message": "Authentication required",
    "data": {
      "type": "AuthenticationError",
      "details": "This operation requires authentication. Please provide ATPROTO_IDENTIFIER and ATPROTO_PASSWORD.",
      "tool": "create_post"
    }
  }
}
```

**Solution**:
```bash
# Set authentication credentials
export ATPROTO_IDENTIFIER="your-handle.bsky.social"
export ATPROTO_PASSWORD="your-app-password"
atproto-mcp
```

### Invalid Parameters

**Error**:
```json
{
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "type": "ValidationError",
      "details": "Post text cannot exceed 300 characters",
      "field": "text",
      "value": "..."
    }
  }
}
```

**Solution**:
- Validate input before calling tools
- Check parameter requirements
- Follow schema constraints

### Rate Limit Exceeded

**Error**:
```json
{
  "error": {
    "code": -32603,
    "message": "Rate limit exceeded",
    "data": {
      "type": "RateLimitError",
      "details": "Too many requests. Please wait before retrying.",
      "retryAfter": 60,
      "limit": 100,
      "remaining": 0
    }
  }
}
```

**Solution**:
```typescript
// Implement exponential backoff
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.type === 'RateLimitError' && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

### Resource Not Found

**Error**:
```json
{
  "error": {
    "code": -32603,
    "message": "Resource not found",
    "data": {
      "type": "NotFoundError",
      "details": "Post not found or has been deleted",
      "uri": "at://did:plc:abc123.../app.bsky.feed.post/xyz789"
    }
  }
}
```

**Solution**:
- Verify resource URIs are correct
- Check if resource still exists
- Handle deleted content gracefully

### Network Error

**Error**:
```json
{
  "error": {
    "code": -32603,
    "message": "Network error",
    "data": {
      "type": "NetworkError",
      "details": "Failed to connect to AT Protocol service",
      "service": "https://bsky.social"
    }
  }
}
```

**Solution**:
- Check internet connectivity
- Verify service URL is correct
- Check for service outages
- Implement retry logic

## Error Handling Patterns

### Try-Catch Pattern

```typescript
try {
  const result = await tool.execute(params);
  return result;
} catch (error) {
  if (error.type === 'AuthenticationError') {
    // Handle authentication error
    console.error('Please authenticate first');
  } else if (error.type === 'RateLimitError') {
    // Handle rate limit
    console.error('Rate limit exceeded, retrying...');
    await delay(error.retryAfter * 1000);
    return retry();
  } else {
    // Handle other errors
    console.error('Operation failed:', error.message);
  }
}
```

### Graceful Degradation

```typescript
async function getUserProfile(actor: string) {
  try {
    // Try authenticated request first
    return await getProfileAuthenticated(actor);
  } catch (error) {
    if (error.type === 'AuthenticationError') {
      // Fall back to public request
      return await getProfilePublic(actor);
    }
    throw error;
  }
}
```

### Retry with Backoff

```typescript
async function executeWithRetry(
  operation: () => Promise<any>,
  maxRetries: number = 3,
  baseDelay: number = 1000
) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error.type === 'ValidationError' || 
          error.type === 'AuthenticationError') {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
```

### Circuit Breaker

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1 minute
  
  async execute(operation: () => Promise<any>) {
    // Check if circuit is open
    if (this.isOpen()) {
      throw new Error('Circuit breaker is open');
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private isOpen(): boolean {
    if (this.failures >= this.threshold) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      return timeSinceLastFailure < this.timeout;
    }
    return false;
  }
  
  private onSuccess() {
    this.failures = 0;
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
  }
}
```

## Error Logging

### Development

```bash
# Enable debug logging
LOG_LEVEL=debug atproto-mcp
```

Output includes:
- Full error messages
- Stack traces
- Request/response details
- Timing information

### Production

```bash
# Use info or warn level
LOG_LEVEL=info atproto-mcp
```

Output includes:
- Error messages (sanitized)
- Error types and codes
- Context information
- No sensitive data

### Structured Logging

```typescript
logger.error('Tool execution failed', {
  tool: 'create_post',
  error: error.message,
  type: error.type,
  code: error.code,
  context: {
    user: 'did:plc:...',
    timestamp: new Date().toISOString()
  }
});
```

## Error Recovery

### Automatic Recovery

The server implements automatic recovery for:

- **Session expiration**: Automatically refreshes sessions
- **Network timeouts**: Retries with exponential backoff
- **Temporary failures**: Implements circuit breaker pattern

### Manual Recovery

For persistent errors:

```bash
# Restart the server
atproto-mcp

# Clear cache
rm -rf ~/.cache/atproto-mcp

# Reset configuration
cp .env.example .env
```

## Debugging Errors

### Enable Debug Mode

```bash
atproto-mcp --log-level debug
```

### Check Logs

```bash
# View recent logs
tail -f ~/.local/share/atproto-mcp/logs/server.log

# Search for errors
grep ERROR ~/.local/share/atproto-mcp/logs/server.log
```

### Validate Configuration

```bash
# Check environment variables
env | grep ATPROTO

# Test authentication
atproto-mcp --log-level debug
```

### Test Tools

```bash
# Test specific tool
echo '{"method":"tools/call","params":{"name":"search_posts","arguments":{"q":"test"}}}' | atproto-mcp
```

## Error Prevention

### Input Validation

```typescript
// Validate before calling tools
function validatePostText(text: string) {
  if (!text || text.trim().length === 0) {
    throw new ValidationError('Post text cannot be empty');
  }
  if (text.length > 300) {
    throw new ValidationError('Post text cannot exceed 300 characters');
  }
}
```

### Rate Limiting

```typescript
// Implement client-side rate limiting
class RateLimiter {
  private requests: number[] = [];
  private readonly limit = 100;
  private readonly window = 60000; // 1 minute
  
  async checkLimit() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.window);
    
    if (this.requests.length >= this.limit) {
      throw new RateLimitError('Client rate limit exceeded');
    }
    
    this.requests.push(now);
  }
}
```

### Connection Management

```typescript
// Implement connection pooling
const agent = new AtpAgent({
  service: 'https://bsky.social',
  persistSession: true,
  maxRetries: 3,
  timeout: 30000
});
```

## Best Practices

### Error Handling

- ✅ Always handle errors explicitly
- ✅ Provide meaningful error messages
- ✅ Log errors with context
- ✅ Implement retry logic for transient errors
- ✅ Use circuit breakers for failing services

### Error Reporting

- ✅ Include error type and code
- ✅ Provide actionable error messages
- ✅ Sanitize sensitive data
- ✅ Include relevant context
- ✅ Log errors for debugging

### Error Recovery

- ✅ Implement automatic recovery when possible
- ✅ Provide manual recovery options
- ✅ Document recovery procedures
- ✅ Test error scenarios
- ✅ Monitor error rates

## Next Steps

- **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions
- **[Deployment](./deployment.md)** - Production deployment
- **[API Reference](../api/tools.md)** - Tool documentation

---

**Previous**: [Tools & Resources](./tools-resources.md) ← | **Next**: [Troubleshooting](./troubleshooting.md) →

