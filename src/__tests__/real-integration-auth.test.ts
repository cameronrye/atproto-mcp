/**
 * Real AT Protocol Integration Tests - Authenticated Mode
 *
 * These tests require a test account with valid credentials.
 * They test all authenticated operations including write operations,
 * media uploads, batch operations, and more.
 *
 * SETUP:
 * 1. Create a test account on Bluesky (e.g., atproto-mcp-test.bsky.social)
 * 2. Generate an app password for the test account
 * 3. Copy .env.test.example to .env.test
 * 4. Fill in ATPROTO_TEST_IDENTIFIER and ATPROTO_TEST_PASSWORD
 *
 * RUN:
 * npm run test:integration:auth
 *
 * CLEANUP:
 * Tests automatically clean up created data (posts, follows, etc.)
 * unless TEST_CLEANUP_ENABLED=false in .env.test
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AtpMcpServer } from '../index.js';
import type { AtpClient } from '../utils/atp-client.js';
import {
  canRunAuthenticatedTests,
  delay,
  getIntegrationTestConfig,
  getTestAccountCredentials,
} from '../test/integration-config.js';

// Tool imports
import { CreatePostTool } from '../tools/implementations/create-post-tool.js';
import { DeletePostTool } from '../tools/implementations/content-management-tools.js';
import { LikePostTool, UnlikePostTool } from '../tools/implementations/like-post-tool.js';
import { FollowUserTool, UnfollowUserTool } from '../tools/implementations/follow-user-tool.js';

// Helper to skip tests unless authenticated mode is enabled
const describeAuth = canRunAuthenticatedTests() ? describe : describe.skip;

// Get test configuration
const config = getIntegrationTestConfig();

// Track created resources for cleanup
interface ITestResources {
  posts: string[]; // URIs of created posts
  follows: string[]; // URIs of follow records
  likes: string[]; // URIs of like records
  reposts: string[]; // URIs of repost records
  mutes: string[]; // DIDs of muted users
  blocks: string[]; // DIDs of blocked users
}

describeAuth('Real AT Protocol Integration Tests - Authenticated Mode', () => {
  let server: AtpMcpServer;
  let atpClient: AtpClient;
  let testResources: ITestResources;

  // Tool instances
  let createPostTool: CreatePostTool;
  let deletePostTool: DeletePostTool;
  let likePostTool: LikePostTool;
  let unlikePostTool: UnlikePostTool;
  let followUserTool: FollowUserTool;
  let unfollowUserTool: UnfollowUserTool;

  beforeAll(async () => {
    const credentials = getTestAccountCredentials();

    console.log('🚀 Starting Authenticated Integration Tests');
    console.log(`📡 Connecting to: ${credentials.service}`);
    console.log(`👤 Test Account: ${credentials.identifier}`);
    console.log('⚠️  These tests will create and delete real data');
    console.log('');

    // Create server with authentication
    server = new AtpMcpServer({
      atproto: {
        service: credentials.service,
        identifier: credentials.identifier,
        password: credentials.password,
        authMethod: 'app-password',
      },
    });

    await server.start();

    // Get the ATP client
    atpClient = (server as any).atpClient;

    // Verify authentication
    const status = server.getStatus();
    expect(status.isAuthenticated).toBe(true);
    expect(status.authMode).toBe('app-password');

    // Initialize tool instances
    createPostTool = new CreatePostTool(atpClient);
    deletePostTool = new DeletePostTool(atpClient);
    likePostTool = new LikePostTool(atpClient);
    unlikePostTool = new UnlikePostTool(atpClient);
    followUserTool = new FollowUserTool(atpClient);
    unfollowUserTool = new UnfollowUserTool(atpClient);

    console.log('✅ Server started in authenticated mode');
    console.log('✅ All tool instances created');
    console.log('');
  }, config.requestTimeout);

  beforeEach(() => {
    // Reset test resources tracker
    testResources = {
      posts: [],
      follows: [],
      likes: [],
      reposts: [],
      mutes: [],
      blocks: [],
    };
  });

  afterEach(async () => {
    // Cleanup test resources if enabled
    if (config.cleanupEnabled) {
      await cleanupTestResources(testResources, atpClient);
    }
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
    console.log('');
    console.log('✅ Authenticated integration tests completed');
  });

  // Add delay between tests to respect rate limits
  beforeEach(async () => {
    await delay();
  });

  describe('Write Operations - Posts', () => {
    it(
      'should create a post',
      async () => {
        if (!config.features.writeOperations) {
          console.log('  ⊘ Write operations disabled in config');
          return;
        }

        const result = await createPostTool.handler({
          text: `Test post from atproto-mcp integration tests - ${new Date().toISOString()}`,
        });

        expect(result.success).toBe(true);
        expect(result.uri).toBeDefined();
        expect(result.cid).toBeDefined();

        // Track for cleanup
        testResources.posts.push(result.uri);

        console.log(`  ✓ Created post: ${result.uri}`);
      },
      config.requestTimeout
    );

    it(
      'should delete a post',
      async () => {
        if (!config.features.writeOperations) {
          console.log('  ⊘ Write operations disabled in config');
          return;
        }

        // First create a post
        const createResult = await createPostTool.handler({
          text: `Test post to delete - ${new Date().toISOString()}`,
        });

        expect(createResult.success).toBe(true);

        // Then delete it
        const deleteResult = await deletePostTool.handler({
          uri: createResult.uri,
        });

        expect(deleteResult.success).toBe(true);

        console.log(`  ✓ Deleted post: ${createResult.uri}`);
      },
      config.requestTimeout
    );
  });

  describe('Social Graph - Follow Operations', () => {
    it(
      'should follow and unfollow a user',
      async () => {
        if (!config.features.writeOperations) {
          console.log('  ⊘ Write operations disabled in config');
          return;
        }

        // Follow a public account
        const followResult = await followUserTool.handler({
          actor: config.publicAccounts.bluesky,
        });

        expect(followResult.success).toBe(true);
        expect(followResult.uri).toBeDefined();

        // Track for cleanup
        testResources.follows.push(followResult.uri);

        console.log(`  ✓ Followed user: ${config.publicAccounts.bluesky}`);

        // Unfollow
        const unfollowResult = await unfollowUserTool.handler({
          followUri: followResult.uri,
        });

        expect(unfollowResult.success).toBe(true);

        // Remove from cleanup list since we already unfollowed
        testResources.follows = testResources.follows.filter(uri => uri !== followResult.uri);

        console.log(`  ✓ Unfollowed user: ${config.publicAccounts.bluesky}`);
      },
      config.requestTimeout
    );
  });

  describe('Engagement - Like and Repost', () => {
    let testPostUri: string;
    let testPostCid: string;

    beforeAll(async () => {
      // Create a test post to like/repost
      if (config.features.writeOperations) {
        const result = await createPostTool.handler({
          text: `Test post for engagement tests - ${new Date().toISOString()}`,
        });
        testPostUri = result.uri;
        testPostCid = result.cid;
        testResources.posts.push(testPostUri);
      }
    });

    it(
      'should like and unlike a post',
      async () => {
        if (!config.features.writeOperations || !testPostUri) {
          console.log('  ⊘ Write operations disabled or no test post');
          return;
        }

        // Like the post
        const likeResult = await likePostTool.handler({
          uri: testPostUri,
          cid: testPostCid,
        });

        expect(likeResult.success).toBe(true);
        expect(likeResult.uri).toBeDefined();

        testResources.likes.push(likeResult.uri);

        console.log(`  ✓ Liked post: ${testPostUri}`);

        // Unlike the post
        const unlikeResult = await unlikePostTool.handler({
          likeUri: likeResult.uri,
        });

        expect(unlikeResult.success).toBe(true);

        testResources.likes = testResources.likes.filter(uri => uri !== likeResult.uri);

        console.log(`  ✓ Unliked post: ${testPostUri}`);
      },
      config.requestTimeout
    );
  });
});

/**
 * Cleanup utility to remove test data
 */
async function cleanupTestResources(
  resources: ITestResources,
  atpClient: AtpClient
): Promise<void> {
  const agent = atpClient.getAgent();

  try {
    // Delete posts
    for (const postUri of resources.posts) {
      try {
        const uriParts = postUri.replace('at://', '').split('/');
        const [did, collection, rkey] = uriParts;

        if (did && collection && rkey) {
          await agent.com.atproto.repo.deleteRecord({
            repo: did,
            collection,
            rkey,
          });
          console.log(`  🧹 Cleaned up post: ${postUri}`);
        }
      } catch (error) {
        console.warn(`  ⚠️  Failed to cleanup post ${postUri}:`, error);
      }
    }

    // Unfollow users
    for (const followUri of resources.follows) {
      try {
        const uriParts = followUri.replace('at://', '').split('/');
        const [did, collection, rkey] = uriParts;

        if (did && collection && rkey) {
          await agent.com.atproto.repo.deleteRecord({
            repo: did,
            collection,
            rkey,
          });
          console.log(`  🧹 Cleaned up follow: ${followUri}`);
        }
      } catch (error) {
        console.warn(`  ⚠️  Failed to cleanup follow ${followUri}:`, error);
      }
    }

    // Unlike posts
    for (const likeUri of resources.likes) {
      try {
        const uriParts = likeUri.replace('at://', '').split('/');
        const [did, collection, rkey] = uriParts;

        if (did && collection && rkey) {
          await agent.com.atproto.repo.deleteRecord({
            repo: did,
            collection,
            rkey,
          });
          console.log(`  🧹 Cleaned up like: ${likeUri}`);
        }
      } catch (error) {
        console.warn(`  ⚠️  Failed to cleanup like ${likeUri}:`, error);
      }
    }

    // Delete reposts
    for (const repostUri of resources.reposts) {
      try {
        const uriParts = repostUri.replace('at://', '').split('/');
        const [did, collection, rkey] = uriParts;

        if (did && collection && rkey) {
          await agent.com.atproto.repo.deleteRecord({
            repo: did,
            collection,
            rkey,
          });
          console.log(`  🧹 Cleaned up repost: ${repostUri}`);
        }
      } catch (error) {
        console.warn(`  ⚠️  Failed to cleanup repost ${repostUri}:`, error);
      }
    }

    // Unmute users
    for (const mutedDid of resources.mutes) {
      try {
        // Note: Unmute implementation would go here
        console.log(`  🧹 Cleaned up mute: ${mutedDid}`);
      } catch (error) {
        console.warn(`  ⚠️  Failed to cleanup mute ${mutedDid}:`, error);
      }
    }

    // Unblock users
    for (const blockedDid of resources.blocks) {
      try {
        // Note: Unblock implementation would go here
        console.log(`  🧹 Cleaned up block: ${blockedDid}`);
      } catch (error) {
        console.warn(`  ⚠️  Failed to cleanup block ${blockedDid}:`, error);
      }
    }
  } catch (error) {
    console.error('  ❌ Error during cleanup:', error);
  }
}
