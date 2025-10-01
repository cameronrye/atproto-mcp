# Error Types

Error classes and handling patterns.

## Base Error Class

### BaseError

```typescript
abstract class BaseError extends Error {
  public readonly timestamp: string;
  public readonly context: Record<string, unknown> | undefined;

  constructor(
    message: string,
    public readonly code: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.context = context;
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
    };
  }
}
```

**Description:** Base class for all custom errors.

**Fields:**
- `message` - Error message
- `code` - Error code
- `timestamp` - When error occurred
- `context` - Additional context data
- `stack` - Stack trace

## AT Protocol Errors

### AtpError

```typescript
class AtpError extends BaseError {
  constructor(
    message: string,
    code: string,
    public readonly statusCode?: number,
    public readonly details?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, code, context);
  }
}
```

**Description:** Errors from AT Protocol operations.

**Additional Fields:**
- `statusCode` - HTTP status code
- `details` - Error details from API

**Example:**
```typescript
throw new AtpError(
  'Failed to create post',
  'POST_CREATION_FAILED',
  400,
  { reason: 'Invalid text format' }
);
```

### AuthenticationError

```typescript
class AuthenticationError extends AtpError {
  constructor(
    message: string,
    details?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, 'AUTHENTICATION_FAILED', 401, details, context);
  }
}
```

**Description:** Authentication failures.

**Common Causes:**
- Invalid credentials
- Expired session
- Missing authentication
- Invalid tokens

**Example:**
```typescript
throw new AuthenticationError(
  'Session expired',
  { sessionAge: '2 hours' }
);
```

### RateLimitError

```typescript
class RateLimitError extends AtpError {
  constructor(
    message: string,
    public readonly retryAfter?: number,
    context?: Record<string, unknown>
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, { retryAfter }, context);
  }
}
```

**Description:** Rate limit exceeded.

**Additional Fields:**
- `retryAfter` - Seconds until retry allowed

**Example:**
```typescript
throw new RateLimitError(
  'Rate limit exceeded',
  60 // Retry after 60 seconds
);
```

## Validation Errors

### ValidationError

```typescript
class ValidationError extends BaseError {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', { ...context, field, value });
  }
}
```

**Description:** Input validation failures.

**Additional Fields:**
- `field` - Field that failed validation
- `value` - Invalid value

**Example:**
```typescript
throw new ValidationError(
  'Post text cannot exceed 300 characters',
  'text',
  longText
);
```

## Configuration Errors

### ConfigurationError

```typescript
class ConfigurationError extends BaseError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'CONFIGURATION_ERROR', context);
  }
}
```

**Description:** Configuration issues.

**Common Causes:**
- Missing required config
- Invalid config values
- Conflicting settings

**Example:**
```typescript
throw new ConfigurationError(
  'OAuth client ID is required',
  { authMethod: 'oauth' }
);
```

## MCP Errors

### McpError

```typescript
class McpError extends BaseError {
  constructor(
    message: string,
    public readonly mcpCode: number,
    public readonly data?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, `MCP_${mcpCode}`, context);
  }
}
```

**Description:** MCP protocol errors.

**MCP Error Codes:**
- `-32700` - Parse error
- `-32600` - Invalid request
- `-32601` - Method not found
- `-32602` - Invalid params
- `-32603` - Internal error

**Example:**
```typescript
throw new McpError(
  'Invalid tool parameters',
  -32602,
  { tool: 'create_post' }
);
```

## Error Handling Patterns

### Try-Catch

```typescript
try {
  await createPost({ text: 'Hello world!' });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Authentication failed:', error.message);
    await refreshSession();
  } else if (error instanceof RateLimitError) {
    console.error('Rate limited, retry after:', error.retryAfter);
    await sleep(error.retryAfter * 1000);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Error Recovery

```typescript
async function createPostWithRetry(params: ICreatePostParams) {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      return await createPost(params);
    } catch (error) {
      attempts++;
      
      if (error instanceof RateLimitError && attempts < maxAttempts) {
        await sleep(error.retryAfter * 1000);
        continue;
      }
      
      throw error;
    }
  }
}
```

### Error Logging

```typescript
function logError(error: Error): void {
  if (error instanceof BaseError) {
    console.error({
      name: error.name,
      code: error.code,
      message: error.message,
      timestamp: error.timestamp,
      context: error.context,
      stack: error.stack
    });
  } else {
    console.error(error);
  }
}
```

## Error Codes

### Common Error Codes

- `AUTHENTICATION_FAILED` - Authentication error
- `RATE_LIMIT_EXCEEDED` - Rate limit hit
- `VALIDATION_ERROR` - Invalid input
- `CONFIGURATION_ERROR` - Config issue
- `NOT_FOUND` - Resource not found
- `UNAUTHORIZED` - Not authorized
- `DUPLICATE` - Duplicate resource
- `INVALID_OPERATION` - Invalid operation

### HTTP Status Codes

- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable

## Best Practices

### Error Creation
- Use specific error classes
- Provide clear messages
- Include relevant context
- Set appropriate codes

### Error Handling
- Catch specific error types
- Implement retry logic
- Log errors appropriately
- Provide user feedback

### Error Recovery
- Retry transient errors
- Refresh expired sessions
- Handle rate limits
- Fallback gracefully

### Error Reporting
- Log error details
- Sanitize sensitive data
- Track error patterns
- Monitor error rates

## See Also

- [Core Types](./core.md)
- [Error Handling Guide](../../guide/error-handling.md)
- [Troubleshooting](../../guide/troubleshooting.md)

