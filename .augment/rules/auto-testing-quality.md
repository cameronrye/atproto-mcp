# Testing & Quality Assurance (Auto-Applied)

**Description**: Automatically applied when working with tests, quality assurance, or code reliability

## Testing Strategy
- Write tests first (TDD approach) for all new features
- Maintain minimum 90% code coverage for critical paths
- Use Vitest as the primary testing framework
- Implement unit, integration, and end-to-end tests
- Mock external dependencies (AT Protocol API calls) in unit tests

## Test Structure
- Follow the AAA pattern (Arrange, Act, Assert)
- Use descriptive test names that explain the scenario
- Group related tests using `describe` blocks
- Use `beforeEach`/`afterEach` for test setup and cleanup
- Create test utilities for common setup patterns

## MCP Server Testing
- Test all MCP tools with various input scenarios
- Verify proper JSON-RPC message handling
- Test error conditions and edge cases
- Mock AT Protocol responses for consistent testing
- Validate tool output schemas match specifications

## AT Protocol Testing
- Mock AT Protocol API responses using MSW (Mock Service Worker)
- Test authentication flows including token refresh
- Verify proper handling of AT Protocol errors
- Test rate limiting and retry mechanisms
- Validate AT Protocol data transformations

## Quality Gates
- All tests must pass before merging
- No TypeScript errors or warnings allowed
- ESLint rules must pass with zero violations
- Prettier formatting must be consistent
- No console.log statements in production code

## Test Data Management
- Use factories for creating test data
- Store test fixtures in dedicated directories
- Use realistic but anonymized data for tests
- Implement test database seeding for integration tests
- Clean up test data after each test run

## Performance Testing
- Benchmark critical operations (AT Protocol calls, data processing)
- Test memory usage and potential leaks
- Verify response times meet acceptable thresholds
- Test concurrent request handling
- Monitor resource usage during test runs

## Security Testing
- Test input validation with malicious payloads
- Verify authentication and authorization flows
- Test for common vulnerabilities (injection, XSS, etc.)
- Validate secure handling of sensitive data
- Test rate limiting and abuse prevention

## Continuous Integration
- Run full test suite on every pull request
- Generate and publish test coverage reports
- Fail builds on test failures or coverage drops
- Run tests against multiple Node.js versions
- Include security scanning in CI pipeline
