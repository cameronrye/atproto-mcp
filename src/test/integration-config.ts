/**
 * Integration Test Configuration
 *
 * Manages configuration for real-world integration tests with AT Protocol servers.
 * Supports both authenticated and unauthenticated testing modes.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Load .env.test if it exists
const envTestPath = resolve(process.cwd(), '.env.test');
if (existsSync(envTestPath)) {
  config({ path: envTestPath });
}

export interface IIntegrationTestConfig {
  // Test execution control
  enabled: boolean;

  // Test account credentials
  testAccount: {
    identifier: string;
    password: string;
    service: string;
  } | null;

  // Test behavior configuration
  rateLimitDelay: number;
  requestTimeout: number;
  cleanupEnabled: boolean;

  // Safety limits
  maxPostsPerRun: number;
  maxFollowsPerRun: number;
  maxLikesPerRun: number;

  // Known test accounts (public, for read-only testing)
  publicAccounts: {
    bluesky: string;
    jay: string;
    blueskyDid: string;
  };

  // Feature flags
  features: {
    writeOperations: boolean;
    mediaUploads: boolean;
    batchOperations: boolean;
    analytics: boolean;
    moderation: boolean;
    streaming: boolean;
  };

  // Environment info
  isCI: boolean;
  logLevel: string;
}

/**
 * Get integration test configuration from environment variables
 */
export function getIntegrationTestConfig(): IIntegrationTestConfig {
  const enabled = process.env['RUN_INTEGRATION_TESTS'] === 'true';

  // Check if test account credentials are provided
  const hasTestAccount = !!(
    process.env['ATPROTO_TEST_IDENTIFIER'] && process.env['ATPROTO_TEST_PASSWORD']
  );

  return {
    enabled,

    testAccount: hasTestAccount
      ? {
          identifier: process.env['ATPROTO_TEST_IDENTIFIER']!,
          password: process.env['ATPROTO_TEST_PASSWORD']!,
          service: process.env['ATPROTO_TEST_SERVICE'] || 'https://bsky.social',
        }
      : null,

    rateLimitDelay: parseInt(process.env['TEST_RATE_LIMIT_DELAY'] || '2000', 10),
    requestTimeout: parseInt(process.env['TEST_REQUEST_TIMEOUT'] || '60000', 10),
    cleanupEnabled: process.env['TEST_CLEANUP_ENABLED'] !== 'false',

    maxPostsPerRun: parseInt(process.env['TEST_MAX_POSTS_PER_RUN'] || '10', 10),
    maxFollowsPerRun: parseInt(process.env['TEST_MAX_FOLLOWS_PER_RUN'] || '5', 10),
    maxLikesPerRun: parseInt(process.env['TEST_MAX_LIKES_PER_RUN'] || '10', 10),

    publicAccounts: {
      bluesky: process.env['TEST_PUBLIC_ACCOUNT_1'] || 'bsky.app',
      jay: process.env['TEST_PUBLIC_ACCOUNT_2'] || 'jay.bsky.team',
      blueskyDid: process.env['TEST_PUBLIC_DID'] || 'did:plc:z72i7hdynmk6r22z27h6tvur',
    },

    features: {
      writeOperations: process.env['TEST_WRITE_OPERATIONS'] !== 'false',
      mediaUploads: process.env['TEST_MEDIA_UPLOADS'] !== 'false',
      batchOperations: process.env['TEST_BATCH_OPERATIONS'] !== 'false',
      analytics: process.env['TEST_ANALYTICS'] !== 'false',
      moderation: process.env['TEST_MODERATION'] !== 'false',
      streaming: process.env['TEST_STREAMING'] === 'true',
    },

    isCI: process.env['CI'] === 'true' || process.env['GITHUB_ACTIONS'] === 'true',
    logLevel: process.env['LOG_LEVEL'] || 'info',
  };
}

/**
 * Check if integration tests should run
 */
export function shouldRunIntegrationTests(): boolean {
  return getIntegrationTestConfig().enabled;
}

/**
 * Check if authenticated tests can run
 */
export function canRunAuthenticatedTests(): boolean {
  const config = getIntegrationTestConfig();
  return config.enabled && config.testAccount !== null;
}

/**
 * Get test account credentials or throw error
 */
export function getTestAccountCredentials(): {
  identifier: string;
  password: string;
  service: string;
} {
  const config = getIntegrationTestConfig();

  if (!config.testAccount) {
    throw new Error(
      'Test account credentials not configured. ' +
        'Please create .env.test with ATPROTO_TEST_IDENTIFIER and ATPROTO_TEST_PASSWORD'
    );
  }

  return config.testAccount;
}

/**
 * Helper to add delay between tests (rate limiting)
 */
export function delay(ms?: number): Promise<void> {
  const config = getIntegrationTestConfig();
  const delayMs = ms ?? config.rateLimitDelay;
  return new Promise(resolve => setTimeout(resolve, delayMs));
}
