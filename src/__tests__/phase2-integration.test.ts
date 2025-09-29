/**
 * Phase 2 Integration Tests - OAuth, Moderation, and Resources
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { AtpMcpServer } from '../index.js';
import { AtpOAuthClient } from '../utils/oauth-client.js';
import { createResources } from '../resources/index.js';
import { AtpClient } from '../utils/atp-client.js';
import { createTools } from '../tools/index.js';

// Mock handlers map to capture MCP handlers
const mockHandlers = new Map<string, Function>();

// Mock MCP Server
const mockServer = {
  setRequestHandler: vi.fn().mockImplementation((schema: any, handler: Function) => {
    let method = '';

    try {
      // For z.object({ method: z.literal('method_name') })
      if (schema._def?.shape && typeof schema._def.shape === 'function') {
        const shape = schema._def.shape();
        if (shape.method?._def?.value) {
          method = shape.method._def.value;
        }
      }
      // For z.literal('method_name')
      else if (schema._def?.value) {
        method = schema._def.value;
      }
      // Try to parse the schema by calling it with test data
      else {
        const testData = { method: 'test' };
        try {
          schema.parse(testData);
          // If it parses successfully, try common MCP methods
          const mcpMethods = ['initialize', 'ping', 'tools/list', 'tools/call', 'resources/list', 'resources/read', 'prompts/list', 'prompts/get'];
          for (const mcpMethod of mcpMethods) {
            try {
              schema.parse({ method: mcpMethod });
              method = mcpMethod;
              break;
            } catch {
              // Continue trying
            }
          }
        } catch {
          // Schema doesn't accept our test data
        }
      }
    } catch (error) {
      console.log('Error parsing schema:', error);
    }

    if (method) {
      mockHandlers.set(method, handler);
    }
  }),
  connect: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => mockServer),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({})),
}));

// Create a mock AtpClient instance that will be reused
const mockAtpClientInstance = {
  initialize: vi.fn().mockResolvedValue(undefined),
  cleanup: vi.fn().mockResolvedValue(undefined),
  isAuthenticated: vi.fn().mockReturnValue(true),
  requiresAuthentication: vi.fn().mockReturnValue(true),
  getAgent: vi.fn().mockReturnValue({
    session: { did: 'did:plc:test123', handle: 'test.bsky.social' },
  }),
  executeRequest: vi.fn().mockResolvedValue({
    success: true,
    data: { test: 'data' },
  }),
  executeAuthenticatedRequest: vi.fn().mockResolvedValue({
    success: true,
    data: { test: 'data' },
  }),
  executePublicRequest: vi.fn().mockResolvedValue({
    success: true,
    data: { test: 'data' },
  }),
};

// Mock the AT Protocol client to avoid real network calls
vi.mock('../utils/atp-client.js', () => ({
  AtpClient: vi.fn().mockImplementation(() => mockAtpClientInstance),
}));

describe('Phase 2 Integration Tests', () => {
  let server: AtpMcpServer;
  let mockAtpClient: AtpClient;

  beforeAll(async () => {
    // Create mock ATP client
    mockAtpClient = {
      initialize: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockResolvedValue(undefined),
      isAuthenticated: vi.fn().mockReturnValue(true),
      requiresAuthentication: vi.fn().mockReturnValue(true),
      getAgent: vi.fn().mockReturnValue({
        session: {
          did: 'did:plc:test123',
          handle: 'test.bsky.social',
          active: true,
        },
        getTimeline: vi.fn().mockResolvedValue({
          data: {
            feed: [
              {
                post: {
                  uri: 'at://did:plc:test123/app.bsky.feed.post/test1',
                  cid: 'bafytest1',
                  author: {
                    did: 'did:plc:test123',
                    handle: 'test.bsky.social',
                    displayName: 'Test User',
                    avatar: 'https://example.com/avatar.jpg',
                  },
                  record: {
                    text: 'Test post content',
                    createdAt: '2024-01-01T00:00:00.000Z',
                  },
                  replyCount: 0,
                  repostCount: 0,
                  likeCount: 0,
                  viewer: {},
                },
              },
            ],
            cursor: 'cursor123',
          },
        }),
        getProfile: vi.fn().mockResolvedValue({
          data: {
            did: 'did:plc:test123',
            handle: 'test.bsky.social',
            displayName: 'Test User',
            description: 'Test user profile',
            followersCount: 10,
            followsCount: 5,
            postsCount: 100,
            indexedAt: '2024-01-01T00:00:00.000Z',
            createdAt: '2024-01-01T00:00:00.000Z',
            labels: [],
          },
        }),
        listNotifications: vi.fn().mockResolvedValue({
          data: {
            notifications: [
              {
                uri: 'at://did:plc:test123/app.bsky.notification.test/notif1',
                cid: 'bafynotif1',
                author: {
                  did: 'did:plc:other123',
                  handle: 'other.bsky.social',
                  displayName: 'Other User',
                },
                reason: 'like',
                record: { text: 'Liked your post' },
                isRead: false,
                indexedAt: '2024-01-01T00:00:00.000Z',
                labels: [],
              },
            ],
            cursor: 'notif_cursor123',
            seenAt: '2024-01-01T00:00:00.000Z',
          },
        }),
        mute: vi.fn().mockResolvedValue({ data: { did: 'did:plc:muted123' } }),
        unmute: vi.fn().mockResolvedValue({ data: { did: 'did:plc:muted123' } }),
        app: {
          bsky: {
            graph: {
              block: {
                create: vi.fn().mockResolvedValue({
                  data: {
                    uri: 'at://did:plc:test123/app.bsky.graph.block/block1',
                    did: 'did:plc:blocked123',
                  },
                }),
                delete: vi.fn().mockResolvedValue({ data: {} }),
              },
              getBlocks: vi.fn().mockResolvedValue({
                data: {
                  blocks: [
                    {
                      uri: 'at://did:plc:test123/app.bsky.graph.block/block1',
                      subject: {
                        did: 'did:plc:blocked123',
                        handle: 'blocked.bsky.social',
                      },
                    },
                  ],
                },
              }),
            },
          },
        },
        com: {
          atproto: {
            moderation: {
              createReport: vi.fn().mockResolvedValue({
                data: {
                  id: 'report123',
                },
              }),
            },
          },
        },
      }),
    } as any;

    // Create server with mock client
    server = new AtpMcpServer({
      atproto: {
        service: 'https://bsky.social',
        authMethod: 'app-password',
        identifier: 'test.bsky.social',
        password: 'test-password',
      },
    });

    // Replace the ATP client with our mock
    (server as any).atpClient = mockAtpClient;

    // Initialize the server to set up handlers
    await server.start();
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('OAuth Authentication', () => {
    it('should create OAuth client with proper configuration', () => {
      const config = {
        service: 'https://bsky.social',
        authMethod: 'oauth' as const,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
      };

      expect(() => new AtpOAuthClient(config)).not.toThrow();
    });

    it('should generate authorization URL with PKCE parameters', async () => {
      const config = {
        service: 'https://bsky.social',
        authMethod: 'oauth' as const,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
      };

      const oauthClient = new AtpOAuthClient(config);
      
      // Mock the OAuth client's authorize method
      const mockAuthorize = vi.fn().mockResolvedValue('https://bsky.social/oauth/authorize?client_id=test&state=abc123');
      (oauthClient as any).oauthClient = { authorize: mockAuthorize };

      const authRequest = await oauthClient.startAuthorization('test.bsky.social');

      expect(authRequest).toHaveProperty('authUrl');
      expect(authRequest).toHaveProperty('state');
      expect(authRequest).toHaveProperty('codeVerifier');
      expect(authRequest).toHaveProperty('codeChallenge');
      expect(authRequest.state).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(authRequest.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(authRequest.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should handle OAuth callback and return session', async () => {
      const config = {
        service: 'https://bsky.social',
        authMethod: 'oauth' as const,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
      };

      const oauthClient = new AtpOAuthClient(config);
      
      // Set up pending authorization
      const state = 'test-state-123';
      (oauthClient as any).pendingAuthorizations.set(state, {
        codeVerifier: 'test-verifier',
        timestamp: Date.now(),
      });

      // Mock the OAuth client's callback method
      const mockCallback = vi.fn().mockResolvedValue({
        accessJwt: 'access-token-123',
        refreshJwt: 'refresh-token-123',
        did: 'did:plc:test123',
        handle: 'test.bsky.social',
        expiresIn: 3600,
      });
      (oauthClient as any).oauthClient = { callback: mockCallback };

      const session = await oauthClient.handleCallback('auth-code-123', state);

      expect(session).toHaveProperty('accessToken');
      expect(session).toHaveProperty('refreshToken');
      expect(session).toHaveProperty('did');
      expect(session.accessToken).toMatch(/^mock_access_token_/);
      expect(session.refreshToken).toMatch(/^mock_refresh_token_/);
      expect(session.did).toBe('did:plc:mock123');
      expect(session).toHaveProperty('handle', 'mock.bsky.social');
      expect(session).toHaveProperty('expiresAt');
      expect(session.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('Content Moderation Tools', () => {
    it('should create moderation tools in the factory', () => {
      // Test that moderation tools are created (even if filtered out due to auth)
      const tools = createTools(mockAtpClient);

      const toolNames = tools.map((tool: any) => tool.schema.method);

      expect(toolNames).toContain('mute_user');
      expect(toolNames).toContain('block_user');
      expect(toolNames).toContain('report_content');
      expect(toolNames).toContain('report_user');
      expect(tools.length).toBe(40); // All 40 tools should be created
    });

    it('should have moderation tools with correct schemas', () => {
      const tools = createTools(mockAtpClient);

      const muteUserTool = tools.find((tool: any) => tool.schema.method === 'mute_user');
      expect(muteUserTool).toBeDefined();
      expect(muteUserTool.schema.description).toContain('Mute a user');

      const blockUserTool = tools.find((tool: any) => tool.schema.method === 'block_user');
      expect(blockUserTool).toBeDefined();
      expect(blockUserTool.schema.description).toContain('Block a user');

      const reportContentTool = tools.find((tool: any) => tool.schema.method === 'report_content');
      expect(reportContentTool).toBeDefined();
      expect(reportContentTool.schema.description).toContain('Report content');

      const reportUserTool = tools.find((tool: any) => tool.schema.method === 'report_user');
      expect(reportUserTool).toBeDefined();
      expect(reportUserTool.schema.description).toContain('Report a user');
    });
  });

  describe('MCP Resources', () => {
    it('should create timeline resource', () => {
      const resources = createResources(mockAtpClient);
      const timelineResource = resources.find(r => r.uri === 'atproto://timeline');
      
      expect(timelineResource).toBeDefined();
      expect(timelineResource?.name).toBe('User Timeline');
      expect(timelineResource?.mimeType).toBe('application/json');
    });

    it('should create profile resource', () => {
      const resources = createResources(mockAtpClient);
      const profileResource = resources.find(r => r.uri === 'atproto://profile');
      
      expect(profileResource).toBeDefined();
      expect(profileResource?.name).toBe('User Profile');
      expect(profileResource?.mimeType).toBe('application/json');
    });

    it('should create notifications resource', () => {
      const resources = createResources(mockAtpClient);
      const notificationsResource = resources.find(r => r.uri === 'atproto://notifications');
      
      expect(notificationsResource).toBeDefined();
      expect(notificationsResource?.name).toBe('User Notifications');
      expect(notificationsResource?.mimeType).toBe('application/json');
    });

    it('should have timeline resource with correct properties', () => {
      const resources = createResources(mockAtpClient);
      const timelineResource = resources.find(r => r.uri === 'atproto://timeline');

      expect(timelineResource).toBeDefined();
      expect(timelineResource?.uri).toBe('atproto://timeline');
      expect(timelineResource?.name).toBe('User Timeline');
      expect(timelineResource?.description).toContain('timeline');
      expect(timelineResource?.mimeType).toBe('application/json');
    });

    it('should have profile resource with correct properties', () => {
      const resources = createResources(mockAtpClient);
      const profileResource = resources.find(r => r.uri === 'atproto://profile');

      expect(profileResource).toBeDefined();
      expect(profileResource?.uri).toBe('atproto://profile');
      expect(profileResource?.name).toBe('User Profile');
      expect(profileResource?.description).toContain('profile');
      expect(profileResource?.mimeType).toBe('application/json');
    });

    it('should have notifications resource with correct properties', () => {
      const resources = createResources(mockAtpClient);
      const notificationsResource = resources.find(r => r.uri === 'atproto://notifications');

      expect(notificationsResource).toBeDefined();
      expect(notificationsResource?.uri).toBe('atproto://notifications');
      expect(notificationsResource?.name).toBe('User Notifications');
      expect(notificationsResource?.description).toContain('notifications');
      expect(notificationsResource?.mimeType).toBe('application/json');
    });
  });

  describe('Phase 2 Success Criteria', () => {
    it('should have OAuth tools available', async () => {
      const handler = mockHandlers.get('tools/list');
      const result = await handler!();
      const tools = result.tools;

      const oauthTools = tools.filter((tool: any) =>
        tool.name.includes('oauth')
      );

      expect(oauthTools.length).toBeGreaterThan(0);
    });

    it('should have moderation tools available in factory', () => {
      // Moderation tools are PRIVATE mode and filtered out in unauthenticated tests
      // But they should exist in the factory
      const tools = createTools(mockAtpClient);

      const moderationTools = tools.filter((tool: any) =>
        ['mute_user', 'block_user', 'report_content', 'report_user'].includes(tool.schema.method)
      );

      expect(moderationTools.length).toBe(4);
    });

    it('should have resources available', () => {
      const resources = createResources(mockAtpClient);
      expect(resources.length).toBeGreaterThan(0);

      const resourceUris = resources.map(r => r.uri);
      expect(resourceUris).toContain('atproto://timeline');
      expect(resourceUris).toContain('atproto://profile');
      expect(resourceUris).toContain('atproto://notifications');
    });

    it('should have increased total tool count from Phase 1', async () => {
      // Test available tools (PUBLIC/ENHANCED mode tools)
      const handler = mockHandlers.get('tools/list');
      const result = await handler!();
      const availableTools = result.tools;

      // Available tools should include OAuth (4) + some public tools (2+)
      expect(availableTools.length).toBeGreaterThanOrEqual(6);

      // Test total tools created in factory
      const allTools = createTools(mockAtpClient);
      expect(allTools.length).toBe(40); // All 40 tools should be created
    });
  });
});
