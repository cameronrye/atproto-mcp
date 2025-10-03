# Real AT Protocol Integration Tests

This document describes the integration test suite for the AT Protocol MCP Server.

## ⚠️ Important Note

**As of 2025, most AT Protocol endpoints now require authentication.** This includes endpoints that were previously public such as:
- `search_posts` - Now returns 403 Forbidden without authentication (changed to PRIVATE mode)
- `get_followers` - Requires authentication (PRIVATE mode)
- `get_follows` - Requires authentication (PRIVATE mode)
- `get_thread` - Requires authentication (PRIVATE mode)
- `get_custom_feed` - Requires authentication (PRIVATE mode)

These integration tests focus on the endpoints that genuinely work without authentication:
- `get_user_profile` - ENHANCED mode (works without auth, provides more data with auth)
- OAuth tools - PUBLIC mode (start_oauth_flow, handle_oauth_callback, refresh_oauth_tokens, revoke_oauth_tokens)

## Overview

The integration tests in `real-integration.test.ts` connect to actual AT Protocol servers (specifically Bluesky's public instance at `bsky.social`) to validate that the MCP server correctly interacts with real infrastructure for publicly accessible functionality.

## Why Integration Tests?

While unit tests validate individual components in isolation, integration tests ensure:

1. **Real-world compatibility**: The MCP server works with actual AT Protocol servers
2. **API contract compliance**: Responses match AT Protocol specifications
3. **Network resilience**: Proper handling of timeouts, rate limits, and errors
4. **Data format validation**: DIDs, URIs, CIDs, and timestamps are correctly formatted
5. **End-to-end functionality**: All public tools work as documented

## Test Coverage

### Tools Tested

Currently, only one tool works without authentication:

1. **get_user_profile** - Profile retrieval (ENHANCED mode)
   - Handle-based lookup
   - DID-based lookup (DID resolution)
   - Profile data validation
   - Error handling for invalid actors
   - Follower/following counts
   - Post counts

### Tools That Require Authentication

The following tools were originally planned for testing but now require authentication (all PRIVATE mode):

- ❌ **search_posts** - Returns 403 Forbidden without authentication (API changed in 2025)
- ❌ **get_followers** - Requires authentication
- ❌ **get_follows** - Requires authentication
- ❌ **get_thread** - Requires authentication
- ❌ **get_custom_feed** - Requires authentication
- ❌ All write operations (create_post, like_post, follow_user, etc.)
- ❌ All moderation tools (mute_user, block_user, report_content, etc.)
- ❌ All list management tools (create_list, add_to_list, etc.)
- ❌ All media tools (upload_image, upload_video, etc.)
- ❌ All streaming tools (start_streaming, stop_streaming, etc.)

To test these tools, you would need to:
1. Provide authentication credentials (app password or OAuth)
2. Create separate authenticated integration tests
3. Implement proper credential management and security

### Additional Test Categories

- **Server Initialization**: Validates unauthenticated mode setup
- **Error Handling**: Tests invalid inputs, missing parameters, network errors
- **Pagination**: Ensures cursor-based pagination works correctly
- **Rate Limiting**: Validates respectful API usage
- **AT Protocol Compliance**: Validates DIDs, URIs, CIDs, timestamps

## Prerequisites

### Required

- **Internet connection**: Tests connect to live servers
- **Access to bsky.social**: Or another configured AT Protocol server
- **Node.js 20+**: As specified in package.json

### NOT Required

- **Authentication**: Tests only use public endpoints
- **App passwords**: Not needed for these tests
- **OAuth credentials**: Not needed for these tests

## Running the Tests

### Quick Start

```bash
# Run integration tests
npm run test:integration
```

### Watch Mode

```bash
# Re-run tests on file changes
npm run test:integration:watch
```

### Interactive UI

```bash
# Run with Vitest UI for interactive debugging
npm run test:integration:ui
```

### Verbose Output

```bash
# Run with detailed console output
npm run test:integration -- --reporter=verbose
```

## Configuration

### Test Configuration

The tests use the following configuration (in `real-integration.test.ts`):

```typescript
const TEST_CONFIG = {
  service: 'https://bsky.social',
  rateLimitDelay: 1000,        // 1 second between tests
  requestTimeout: 30000,        // 30 second timeout
  testAccounts: {
    bluesky: 'bsky.app',
    jay: 'jay.bsky.team',
    blueskyDid: 'did:plc:z72i7hdynmk6r22z27h6tvur',
  },
  testFeeds: {
    discover: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
  },
};
```

### Customizing Configuration

To test against a different AT Protocol server:

1. Edit `TEST_CONFIG.service` in `real-integration.test.ts`
2. Update test accounts to valid accounts on that server
3. Update test feeds to valid feeds on that server

## Rate Limiting

The tests are designed to be respectful of public server resources:

- **1 second delay** between each test (configurable via `rateLimitDelay`)
- **30 second timeout** for network requests (configurable via `requestTimeout`)
- **Small result limits** (typically 5-10 items per request)
- **Minimal test data** (only what's needed to validate functionality)

### Best Practices

1. **Don't run too frequently**: These tests hit real servers
2. **Use in CI sparingly**: Consider running only on main branch or releases
3. **Monitor for rate limits**: If you see 429 errors, increase delays
4. **Be a good citizen**: Don't abuse public infrastructure

## Troubleshooting

### Tests are Skipped

**Problem**: Tests show as "skipped" in output

**Solution**: Set the environment variable:
```bash
npm run test:integration
```

### Network Timeouts

**Problem**: Tests fail with timeout errors

**Solution**: 
1. Check your internet connection
2. Verify bsky.social is accessible
3. Increase `requestTimeout` in test config
4. Check for firewall/proxy issues

### Rate Limiting Errors

**Problem**: Tests fail with 429 (Too Many Requests) errors

**Solution**:
1. Increase `rateLimitDelay` in test config
2. Run tests less frequently
3. Wait a few minutes before retrying

### Invalid Test Data

**Problem**: Tests fail because test accounts/feeds don't exist

**Solution**:
1. Verify test accounts still exist on bsky.social
2. Update `TEST_CONFIG` with valid accounts
3. Check that test feeds are still public

### Server Unavailable

**Problem**: Tests fail with connection errors

**Solution**:
1. Check if bsky.social is down: https://status.bsky.app
2. Try again later
3. Configure a different AT Protocol server

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: pnpm install
      - name: Run Integration Tests
        run: npm run test:integration
        env:
          CI: true
```

### Recommendations

- **Don't run on every commit**: Too resource-intensive
- **Run on main branch**: Validate production-ready code
- **Run on schedule**: Daily or weekly checks
- **Run on releases**: Before publishing new versions

## Test Output

### Successful Run

```
🚀 Starting Real AT Protocol Integration Tests
📡 Connecting to: https://bsky.social
⚠️  These tests connect to real AT Protocol servers

✅ Server started in unauthenticated mode
✅ All public tool instances created

✓ Server Initialization (2)
  ✓ should start server in unauthenticated mode
  ✓ should have public agent configured

✓ search_posts - Public Post Search (6)
  ✓ should search for posts with basic text query
  ✓ should search posts by specific author
  ✓ should support pagination with cursor
  ...

✅ Integration tests completed
```

### Failed Test

```
❌ FAIL  src/__tests__/real-integration.test.ts
  ● get_user_profile › should get profile by handle

    Error: Profile not found
    
    at GetUserProfileTool.execute (...)
    at ...
```

## Maintenance

### Updating Test Data

Test accounts and feeds may become invalid over time. To update:

1. Find new public accounts on bsky.social
2. Find new public feeds in the Bluesky app
3. Update `TEST_CONFIG` in `real-integration.test.ts`
4. Run tests to verify

### Adding New Tests

When adding new public tools:

1. Import the tool class
2. Create tool instance in `beforeAll`
3. Add new `describe` block with tests
4. Follow existing patterns for structure
5. Update this README

## Security Considerations

### What These Tests Do NOT Do

- ❌ Test authenticated operations
- ❌ Create, modify, or delete data
- ❌ Access private/protected content
- ❌ Require user credentials
- ❌ Store or transmit sensitive data

### What These Tests DO

- ✅ Only read public data
- ✅ Use public API endpoints
- ✅ Respect rate limits
- ✅ Follow AT Protocol specifications
- ✅ Validate data formats only

## Support

For issues with integration tests:

1. Check this README first
2. Review test output for specific errors
3. Check [AT Protocol Status](https://status.bsky.app)
4. Open an issue on GitHub with:
   - Test output
   - Environment details
   - Steps to reproduce

## License

These tests are part of the atproto-mcp project and follow the same MIT license.

