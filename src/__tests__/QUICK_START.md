# Integration Tests - Quick Start Guide

## TL;DR

```bash
# Run integration tests
npm run test:integration
```

## What Are These Tests?

Integration tests that connect to **real AT Protocol servers** (bsky.social) to validate that all public MCP server tools work correctly with actual infrastructure.

## Why Run Them?

- ✅ Verify the MCP server works with real AT Protocol servers
- ✅ Validate all public tools function correctly
- ✅ Ensure data formats match AT Protocol specifications
- ✅ Test error handling with real network conditions
- ✅ Confirm pagination and rate limiting work properly

## Prerequisites

### Required
- Internet connection
- Access to bsky.social

### NOT Required
- Authentication credentials
- App passwords
- OAuth tokens

## Running Tests

### Basic Run
```bash
npm run test:integration
```

### Watch Mode (Re-run on Changes)
```bash
npm run test:integration:watch
```

### Interactive UI
```bash
npm run test:integration:ui
```

### With Detailed Output
```bash
npm run test:integration -- --reporter=verbose
```

## What Gets Tested?

### Tools (6 total)
1. **search_posts** - Search for posts with filters
2. **get_user_profile** - Get user profiles (handle & DID)
3. **get_followers** - Get follower lists
4. **get_follows** - Get following lists
5. **get_thread** - Get post threads/conversations
6. **get_custom_feed** - Get custom feed posts

### Features
- ✅ Basic functionality
- ✅ Pagination
- ✅ Error handling
- ✅ Parameter validation
- ✅ AT Protocol compliance (DIDs, URIs, CIDs, timestamps)

## Expected Output

```
🚀 Starting Real AT Protocol Integration Tests
📡 Connecting to: https://bsky.social
⚠️  These tests connect to real AT Protocol servers

✅ Server started in unauthenticated mode
✅ All public tool instances created

✓ Server Initialization (2)
✓ search_posts - Public Post Search (6)
✓ get_user_profile - Public Profile Retrieval (3)
✓ get_followers - Public Follower List Retrieval (2)
✓ get_follows - Public Following List Retrieval (2)
✓ get_thread - Public Thread Retrieval (2)
✓ get_custom_feed - Public Feed Retrieval (3)
✓ Error Handling and Edge Cases (4)
✓ AT Protocol Specifications Compliance (4)

✅ Integration tests completed

Test Files  1 passed (1)
     Tests  28 passed (28)
  Duration  ~45s
```

## Common Issues

### Tests Are Skipped

**Problem:**
```
Test Files  1 skipped (1)
     Tests  28 skipped (28)
```

**Solution:**
Set the environment variable:
```bash
npm run test:integration
```

### Network Timeout

**Problem:**
```
Error: Timeout of 30000ms exceeded
```

**Solution:**
- Check internet connection
- Verify bsky.social is accessible
- Try again in a few minutes

### Rate Limiting

**Problem:**
```
Error: 429 Too Many Requests
```

**Solution:**
- Wait a few minutes
- Tests already include 1s delays between requests
- Don't run tests too frequently

### Connection Refused

**Problem:**
```
Error: connect ECONNREFUSED
```

**Solution:**
- Check firewall settings
- Verify proxy configuration
- Ensure bsky.social is not blocked

## Test Duration

- **Typical run**: 30-60 seconds
- **Includes**: 1 second delay between tests (rate limiting)
- **Network dependent**: May vary based on connection speed

## Rate Limiting

Tests are designed to be respectful:
- ✅ 1 second delay between tests
- ✅ Small result limits (5-10 items)
- ✅ Minimal data requests
- ✅ No write operations

**Don't:**
- ❌ Run tests continuously
- ❌ Run in tight loops
- ❌ Modify rate limit delays to be faster

## When to Run

### Good Times
- ✅ Before committing major changes
- ✅ Before creating a pull request
- ✅ Before releasing a new version
- ✅ Weekly/monthly as part of maintenance

### Bad Times
- ❌ On every file save
- ❌ In pre-commit hooks
- ❌ On every CI build
- ❌ Multiple times in quick succession

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:      # Manual trigger

jobs:
  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: pnpm install
      - name: Run Integration Tests
        run: npm run test:integration
```

## Troubleshooting

### Get Help
1. Check [INTEGRATION_TESTS.md](./INTEGRATION_TESTS.md) for detailed docs
2. Review test output for specific errors
3. Check [AT Protocol Status](https://status.bsky.app)
4. Open an issue on GitHub

### Debug Mode
```bash
# Run with debug logging
DEBUG=* npm run test:integration
```

## What's NOT Tested

These tests do NOT:
- ❌ Test authenticated operations
- ❌ Create, modify, or delete data
- ❌ Access private content
- ❌ Require user credentials
- ❌ Test write operations

## Security

These tests are safe:
- ✅ Read-only operations
- ✅ Public data only
- ✅ No credentials required
- ✅ No sensitive data
- ✅ Respectful of rate limits

## Next Steps

After running tests:
1. Review any failures
2. Check test output for warnings
3. Update test data if needed (see [INTEGRATION_TESTS.md](./INTEGRATION_TESTS.md))
4. Consider adding to CI/CD (with caution)

## More Information

- **Detailed Documentation**: [INTEGRATION_TESTS.md](./INTEGRATION_TESTS.md)
- **Test File**: [real-integration.test.ts](./real-integration.test.ts)
- **Main README**: [../../README.md](../../README.md)

## Questions?

- Check the [detailed documentation](./INTEGRATION_TESTS.md)
- Review the [test file](./real-integration.test.ts) for examples
- Open an issue on GitHub

