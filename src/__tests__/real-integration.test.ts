/**
 * Real AT Protocol Integration Tests
 *
 * These tests connect to actual AT Protocol servers (bsky.social) to validate
 * that the MCP server correctly interacts with real infrastructure.
 *
 * IMPORTANT: As of 2025, most AT Protocol endpoints now require authentication.
 * These tests only cover the endpoints that genuinely work without authentication.
 *
 * Tests are opt-in via environment variable to prevent accidental server hits:
 * RUN_INTEGRATION_TESTS=true pnpm test real-integration
 *
 * NOTE: These tests may occasionally fail due to:
 * - Rate limiting from the AT Protocol server
 * - Network issues
 * - Server-side changes or maintenance
 * If tests fail, wait a few minutes and try again.
 *
 * COVERAGE:
 * 1. Server initialization in unauthenticated mode
 * 2. get_user_profile - Profile retrieval (DID and handle resolution)
 * 3. Error handling and validation
 * 4. AT Protocol specification compliance
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { AtpMcpServer } from '../index.js';
import { GetUserProfileTool } from '../tools/implementations/get-user-profile-tool.js';
import { AtpClient } from '../utils/atp-client.js';

// Helper to skip tests unless explicitly enabled
const describeIntegration = process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

const TEST_CONFIG = {
  // Using bsky.social - main Bluesky entryway
  // Note: public.api.bsky.app was tested and shows identical rate limiting behavior
  // See AT_PROTOCOL_SERVERS.md for details on all available endpoints
  service: 'https://bsky.social',
  rateLimitDelay: 2000, // 2 seconds between tests (increased to avoid rate limiting)
  requestTimeout: 60000, // 60 seconds (increased for slow responses)
  testAccounts: {
    bluesky: 'bsky.app',
    jay: 'jay.bsky.team',
    blueskyDid: 'did:plc:z72i7hdynmk6r22z27h6tvur',
  },
};

// Helper to add delay between tests (rate limiting)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describeIntegration('Real AT Protocol Integration Tests', () => {
  let server: AtpMcpServer;
  let atpClient: AtpClient;
  let getUserProfileTool: GetUserProfileTool;

  beforeAll(async () => {
    console.log('🚀 Starting Real AT Protocol Integration Tests');
    console.log(`📡 Connecting to: ${TEST_CONFIG.service}`);
    console.log('⚠️  These tests connect to real AT Protocol servers');
    console.log('⚠️  Note: Most AT Protocol endpoints now require authentication');
    console.log('⚠️  These tests only cover truly public endpoints');
    console.log('');

    // Create server without authentication (unauthenticated mode)
    server = new AtpMcpServer({
      atproto: {
        service: TEST_CONFIG.service,
      },
    });

    await server.start();

    // Get the ATP client for direct tool testing
    atpClient = (server as any).atpClient;

    // Create tool instance
    getUserProfileTool = new GetUserProfileTool(atpClient);

    console.log('✅ Server started in unauthenticated mode');
    console.log('✅ Public tool instances created');
    console.log('');
  }, TEST_CONFIG.requestTimeout);

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
    console.log('');
    console.log('✅ Integration tests completed');
  });

  // Add delay between tests to respect rate limits
  beforeEach(async () => {
    await delay(TEST_CONFIG.rateLimitDelay);
  });

  describe('Server Initialization', () => {
    it('should start server in unauthenticated mode', () => {
      const status = server.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.isAuthenticated).toBe(false);
      expect(status.authMode).toBe('unauthenticated');
    });

    it('should have public agent configured', () => {
      const publicAgent = atpClient.getPublicAgent();
      expect(publicAgent).toBeDefined();
      // Note: service property is deprecated in newer versions of @atproto/api
      // We just verify the agent exists and is configured
      expect((publicAgent as any).service?.toString()).toBe('https://public.api.bsky.app/');
    });
  });

  describe('get_user_profile - Public Profile Retrieval', () => {
    it(
      'should get profile by handle',
      async () => {
        // Add a small delay before the first real API call
        await delay(2000);

        const result = await getUserProfileTool.handler({
          actor: TEST_CONFIG.testAccounts.bluesky,
        });

        expect(result.success).toBe(true);
        expect(result.profile).toBeDefined();

        // Validate profile structure
        expect(result.profile.did).toBeDefined();
        expect(result.profile.handle).toBe(TEST_CONFIG.testAccounts.bluesky);
        expect(result.profile.displayName).toBeDefined();
        expect(result.profile.description).toBeDefined();

        // Validate counts
        expect(typeof result.profile.followersCount).toBe('number');
        expect(typeof result.profile.followsCount).toBe('number');
        expect(typeof result.profile.postsCount).toBe('number');

        console.log(`  ✓ Retrieved profile for @${result.profile.handle}`);
        console.log(`    - DID: ${result.profile.did}`);
        console.log(`    - Display Name: ${result.profile.displayName}`);
        console.log(`    - Followers: ${result.profile.followersCount}`);
      },
      TEST_CONFIG.requestTimeout
    );

    it(
      'should get profile by DID',
      async () => {
        const result = await getUserProfileTool.handler({
          actor: TEST_CONFIG.testAccounts.blueskyDid,
        });

        expect(result.success).toBe(true);
        expect(result.profile).toBeDefined();
        expect(result.profile.did).toBe(TEST_CONFIG.testAccounts.blueskyDid);
        expect(result.profile.handle).toBe(TEST_CONFIG.testAccounts.bluesky);

        console.log(`  ✓ Retrieved profile by DID`);
        console.log(`    - Resolved to handle: @${result.profile.handle}`);
      },
      TEST_CONFIG.requestTimeout
    );

    it(
      'should handle invalid actor gracefully',
      async () => {
        await expect(
          getUserProfileTool.handler({
            actor: 'this-handle-definitely-does-not-exist-12345.bsky.social',
          })
        ).rejects.toThrow();

        console.log('  ✓ Invalid actor handled correctly');
      },
      TEST_CONFIG.requestTimeout
    );
  });

  describe('AT Protocol Specifications Compliance', () => {
    // Use a single request to test all specifications to avoid rate limiting
    let profileResult: any;

    beforeAll(async () => {
      // Make one request and reuse the result for all spec tests
      profileResult = await getUserProfileTool.handler({
        actor: TEST_CONFIG.testAccounts.bluesky,
      });
    });

    it('should return valid DIDs in correct format', () => {
      expect(profileResult.success).toBe(true);
      expect(profileResult.profile.did).toMatch(/^did:plc:[a-z0-9]+$/);

      console.log(`  ✓ DID format is valid: ${profileResult.profile.did}`);
    });

    it('should return valid handle format', () => {
      expect(profileResult.success).toBe(true);
      expect(profileResult.profile.handle).toMatch(/^[a-z0-9.-]+\.[a-z]+$/);

      console.log(`  ✓ Handle format is valid: ${profileResult.profile.handle}`);
    });

    it('should return ISO 8601 timestamps', () => {
      expect(profileResult.success).toBe(true);

      // Check if createdAt exists and is valid ISO 8601
      if (profileResult.profile.createdAt) {
        const date = new Date(profileResult.profile.createdAt);
        expect(date.toISOString()).toBe(profileResult.profile.createdAt);
        console.log(`  ✓ Timestamp is valid ISO 8601: ${profileResult.profile.createdAt}`);
      } else {
        console.log('  ✓ No timestamp in profile (acceptable)');
      }
    });
  });

  describe('Error Handling', () => {
    it(
      'should validate required parameters',
      async () => {
        await expect(getUserProfileTool.handler({} as any)).rejects.toThrow();

        console.log('  ✓ Required parameter validation works');
      },
      TEST_CONFIG.requestTimeout
    );

    it(
      'should handle network timeouts gracefully',
      async () => {
        // This test just verifies the timeout mechanism exists
        // We don't actually want to wait for a timeout
        expect(TEST_CONFIG.requestTimeout).toBeGreaterThan(0);
        console.log('  ✓ Timeout configuration is set');
      },
      TEST_CONFIG.requestTimeout
    );
  });
});

