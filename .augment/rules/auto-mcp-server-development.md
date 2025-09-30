# MCP Server Development Guidelines (Auto-Applied)

**Description**: Automatically applied when working with MCP server implementation, tools, resources, or protocol handling

## MCP Server Architecture
- Use `@modelcontextprotocol/sdk` for all MCP server functionality
- Implement the `Server` class with proper initialization
- Define clear separation between MCP protocol and business logic
- Use proper TypeScript types from the MCP SDK
- Implement graceful server shutdown and cleanup

## Tool Implementation
- Define tools with comprehensive Zod schemas for parameters
- Provide detailed descriptions for each tool and parameter
- Implement proper input validation using the defined schemas
- Return structured responses with consistent error handling
- Use meaningful tool names that clearly indicate functionality

## Resource Management
- Implement resources for exposing AT Protocol data to LLMs
- Use proper resource URIs following MCP conventions
- Implement efficient resource caching and invalidation
- Handle resource subscriptions for real-time updates
- Provide comprehensive resource metadata

## Prompt Templates
- Create reusable prompt templates for common AT Protocol operations
- Use proper parameter substitution in templates
- Provide clear template descriptions and usage examples
- Implement template validation and error handling
- Support dynamic template generation based on context

## JSON-RPC Protocol Handling
- Follow JSON-RPC 2.0 specification strictly
- Implement proper request/response correlation
- Handle batch requests efficiently
- Provide detailed error responses with proper error codes
- Log all protocol interactions for debugging

## Error Management
- Use MCP-specific error codes and messages
- Implement proper error propagation from AT Protocol to MCP
- Provide actionable error messages for LLM clients
- Log errors with sufficient context for troubleshooting
- Handle protocol-level errors gracefully

## Configuration & Environment
- Use environment variables for all configuration
- Implement proper configuration validation at startup
- Support different environments (development, staging, production)
- Provide clear documentation for all configuration options
- Use secure defaults for all settings

## Logging & Monitoring
- Implement structured logging with appropriate levels
- Log all MCP tool invocations with parameters and results
- Monitor AT Protocol API usage and rate limits
- Track server performance metrics
- Implement health check endpoints

## Security Considerations
- Validate all MCP client requests thoroughly
- Implement proper authentication if required
- Sanitize all data before AT Protocol operations
- Never expose sensitive AT Protocol credentials
- Implement request rate limiting to prevent abuse

## Performance Optimization
- Implement connection pooling for AT Protocol clients
- Use async/await for all I/O operations
- Cache frequently accessed AT Protocol data
- Implement request batching where possible
- Monitor and optimize memory usage

## Development Workflow
- Use hot reloading for development efficiency
- Implement comprehensive debugging support
- Provide clear development setup instructions
- Use consistent code formatting and linting
- Implement proper dependency management
