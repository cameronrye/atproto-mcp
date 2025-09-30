# Core Development Standards (Always Applied)

## TypeScript Standards
- Use strict TypeScript configuration with `noImplicitAny`, `strictNullChecks`, and `noImplicitReturns`
- Prefer explicit return types for all public functions and methods
- Use `const` assertions for immutable data structures
- Implement proper error handling with custom error classes extending `Error`
- Use branded types for domain-specific identifiers (DIDs, ATURIs, etc.)

## AT Protocol Integration
- Always use the official `@atproto/api` package for AT Protocol interactions
- Implement proper authentication flow with session management
- Use proper AT Protocol identifiers (DIDs, AT-URIs, NSIDs) with type safety
- Handle AT Protocol rate limits gracefully with exponential backoff
- Validate all AT Protocol responses against expected schemas

## MCP Server Architecture
- Follow the official MCP specification strictly
- Implement all required MCP server capabilities (tools, resources, prompts)
- Use proper JSON-RPC 2.0 message formatting
- Implement comprehensive error handling with proper MCP error codes
- Provide detailed tool descriptions and parameter schemas using Zod

## Code Organization
- Use barrel exports (`index.ts`) for clean module interfaces
- Organize code by feature/domain, not by file type
- Keep functions pure and side-effect free where possible
- Use dependency injection for testability
- Implement proper separation of concerns (data, business logic, presentation)

## Error Handling
- Create custom error classes for different error types
- Always include context in error messages
- Log errors with appropriate severity levels
- Implement graceful degradation for non-critical failures
- Use Result/Either patterns for operations that can fail

## Security
- Validate all inputs using Zod schemas
- Sanitize data before AT Protocol operations
- Implement proper authentication and authorization
- Never log sensitive information (tokens, passwords, private keys)
- Use environment variables for all configuration secrets

## Performance
- Implement connection pooling for AT Protocol clients
- Use streaming for large data operations
- Implement proper caching strategies with TTL
- Avoid blocking operations in the main thread
- Use async/await consistently, never mix with callbacks

## Documentation
- Document all public APIs with JSDoc comments
- Include usage examples in documentation
- Maintain up-to-date README with setup instructions
- Document all environment variables and configuration options
- Provide troubleshooting guides for common issues
