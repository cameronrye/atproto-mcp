/**
 * Tests for parameterized MCP resource templates and URI resolution
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type IResourceTemplate,
  createResourceTemplates,
  createResources,
  resolveResourceUri,
} from '../index.js';
import { ValidationError } from '../../types/index.js';
import type { AtpClient } from '../../utils/atp-client.js';
import type { AtpAgent } from '@atproto/api';

// Mock AtpClient. The real client's getAgent() falls back to the public API
// agent when unauthenticated, so the mock returns an agent in both modes.
const createMockAtpClient = (authenticated = true) => {
  const mockAgent = {
    getProfile: vi.fn(),
    app: { bsky: { feed: { getAuthorFeed: vi.fn() } } },
  } as unknown as AtpAgent;

  const client = {
    isAuthenticated: vi.fn().mockReturnValue(authenticated),
    getAgent: vi.fn().mockReturnValue(mockAgent),
  } as unknown as AtpClient;

  return { client, agent: mockAgent };
};

const mockProfileResponse = {
  data: {
    did: 'did:plc:abc123',
    handle: 'alice.bsky.social',
    displayName: 'Alice',
    description: 'Test bio',
    avatar: 'https://example.com/avatar.jpg',
    followersCount: 10,
    followsCount: 5,
    postsCount: 42,
    indexedAt: '2024-01-01T00:00:00Z',
  },
};

const mockFeedResponse = {
  data: {
    feed: [
      {
        post: {
          uri: 'at://did:plc:abc123/app.bsky.feed.post/123',
          cid: 'bafytest123',
          author: {
            did: 'did:plc:abc123',
            handle: 'alice.bsky.social',
            displayName: 'Alice',
            avatar: 'https://example.com/avatar.jpg',
          },
          record: {
            text: 'Hello world',
            createdAt: '2024-01-01T00:00:00Z',
          },
          replyCount: 1,
          repostCount: 2,
          likeCount: 3,
          indexedAt: '2024-01-01T00:00:01Z',
        },
      },
    ],
    cursor: 'next-page',
  },
};

describe('createResourceTemplates', () => {
  it('returns the profile and feed templates', () => {
    const { client } = createMockAtpClient();
    const templates = createResourceTemplates(client);

    expect(templates.map(t => t.uriTemplate)).toEqual([
      'atproto://profile/{actor}',
      'atproto://feed/{actor}',
    ]);
    for (const template of templates) {
      expect(template.name).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(template.mimeType).toBe('application/json');
    }
  });
});

describe('profile template matcher', () => {
  let template: IResourceTemplate;

  beforeEach(() => {
    const { client } = createMockAtpClient();
    template = createResourceTemplates(client).find(
      t => t.uriTemplate === 'atproto://profile/{actor}'
    )!;
  });

  it('matches a handle', () => {
    expect(template.matcher('atproto://profile/alice.bsky.social')).toEqual({
      actor: 'alice.bsky.social',
    });
  });

  it('matches a DID', () => {
    expect(template.matcher('atproto://profile/did:plc:abc123')).toEqual({
      actor: 'did:plc:abc123',
    });
  });

  it('decodes a URL-encoded DID', () => {
    expect(template.matcher('atproto://profile/did%3Aplc%3Aabc123')).toEqual({
      actor: 'did:plc:abc123',
    });
  });

  it('does not match the static profile URI', () => {
    expect(template.matcher('atproto://profile')).toBeNull();
  });

  it('does not match an empty actor segment', () => {
    expect(template.matcher('atproto://profile/')).toBeNull();
  });

  it('does not match extra path segments', () => {
    expect(template.matcher('atproto://profile/alice.bsky.social/extra')).toBeNull();
  });

  it('rejects an invalid actor', () => {
    expect(template.matcher('atproto://profile/not_a_handle')).toBeNull();
  });

  it('rejects malformed percent-encoding', () => {
    expect(template.matcher('atproto://profile/%E0%A4%A')).toBeNull();
  });

  it('does not match other schemes', () => {
    expect(template.matcher('https://profile/alice.bsky.social')).toBeNull();
  });
});

describe('feed template matcher', () => {
  let template: IResourceTemplate;

  beforeEach(() => {
    const { client } = createMockAtpClient();
    template = createResourceTemplates(client).find(
      t => t.uriTemplate === 'atproto://feed/{actor}'
    )!;
  });

  it('matches a handle', () => {
    expect(template.matcher('atproto://feed/alice.bsky.social')).toEqual({
      actor: 'alice.bsky.social',
    });
  });

  it('matches a URL-encoded DID', () => {
    expect(template.matcher('atproto://feed/did%3Aplc%3Aabc123')).toEqual({
      actor: 'did:plc:abc123',
    });
  });

  it('does not match the bare feed URI', () => {
    expect(template.matcher('atproto://feed')).toBeNull();
  });

  it('rejects an invalid actor', () => {
    expect(template.matcher('atproto://feed/bad_actor')).toBeNull();
  });
});

describe('profile template read', () => {
  it('reads a public profile by actor', async () => {
    const { client, agent } = createMockAtpClient();
    agent.getProfile = vi.fn().mockResolvedValue(mockProfileResponse);
    const template = createResourceTemplates(client).find(
      t => t.uriTemplate === 'atproto://profile/{actor}'
    )!;

    const content = await template.read({ actor: 'alice.bsky.social' });

    expect(agent.getProfile).toHaveBeenCalledWith({ actor: 'alice.bsky.social' });
    expect(content.uri).toBe('atproto://profile/alice.bsky.social');
    expect(content.mimeType).toBe('application/json');

    const data = JSON.parse(content.text!);
    expect(data.profile.did).toBe('did:plc:abc123');
    expect(data.profile.handle).toBe('alice.bsky.social');
    expect(data.timestamp).toBeTruthy();
    // Unlike the static self-profile resource, no session data is exposed.
    expect(data.session).toBeUndefined();
  });

  it('works in unauthenticated mode', async () => {
    const { client, agent } = createMockAtpClient(false);
    agent.getProfile = vi.fn().mockResolvedValue(mockProfileResponse);
    const template = createResourceTemplates(client).find(
      t => t.uriTemplate === 'atproto://profile/{actor}'
    )!;

    const content = await template.read({ actor: 'did:plc:abc123' });

    expect(content.text).toBeTruthy();
    expect(agent.getProfile).toHaveBeenCalledWith({ actor: 'did:plc:abc123' });
  });

  it('rejects an invalid actor parameter', async () => {
    const { client } = createMockAtpClient();
    const template = createResourceTemplates(client).find(
      t => t.uriTemplate === 'atproto://profile/{actor}'
    )!;

    await expect(template.read({ actor: 'not_a_handle' })).rejects.toThrow(ValidationError);
  });

  it('propagates not-found errors from the API', async () => {
    const { client, agent } = createMockAtpClient();
    agent.getProfile = vi.fn().mockRejectedValue(new Error('Profile not found'));
    const template = createResourceTemplates(client).find(
      t => t.uriTemplate === 'atproto://profile/{actor}'
    )!;

    await expect(template.read({ actor: 'missing.bsky.social' })).rejects.toThrow(
      'Profile not found'
    );
  });
});

describe('feed template read', () => {
  it('reads an author feed by actor', async () => {
    const { client, agent } = createMockAtpClient();
    agent.app.bsky.feed.getAuthorFeed = vi.fn().mockResolvedValue(mockFeedResponse) as never;
    const template = createResourceTemplates(client).find(
      t => t.uriTemplate === 'atproto://feed/{actor}'
    )!;

    const content = await template.read({ actor: 'alice.bsky.social' });

    expect(agent.app.bsky.feed.getAuthorFeed).toHaveBeenCalledWith({
      actor: 'alice.bsky.social',
      limit: 50,
    });
    expect(content.uri).toBe('atproto://feed/alice.bsky.social');
    expect(content.mimeType).toBe('application/json');

    const data = JSON.parse(content.text!);
    expect(data.actor).toBe('alice.bsky.social');
    expect(data.posts).toHaveLength(1);
    expect(data.posts[0].uri).toBe('at://did:plc:abc123/app.bsky.feed.post/123');
    expect(data.posts[0].text).toBe('Hello world');
    expect(data.posts[0].author.handle).toBe('alice.bsky.social');
    expect(data.posts[0].likeCount).toBe(3);
    expect(data.cursor).toBe('next-page');
  });

  it('works in unauthenticated mode', async () => {
    const { client, agent } = createMockAtpClient(false);
    agent.app.bsky.feed.getAuthorFeed = vi.fn().mockResolvedValue(mockFeedResponse) as never;
    const template = createResourceTemplates(client).find(
      t => t.uriTemplate === 'atproto://feed/{actor}'
    )!;

    const content = await template.read({ actor: 'alice.bsky.social' });

    expect(JSON.parse(content.text!).posts).toHaveLength(1);
  });

  it('rejects an invalid actor parameter', async () => {
    const { client } = createMockAtpClient();
    const template = createResourceTemplates(client).find(
      t => t.uriTemplate === 'atproto://feed/{actor}'
    )!;

    await expect(template.read({ actor: 'nodots' })).rejects.toThrow(ValidationError);
  });

  it('propagates errors from the API', async () => {
    const { client, agent } = createMockAtpClient();
    agent.app.bsky.feed.getAuthorFeed = vi
      .fn()
      .mockRejectedValue(new Error('Actor not found')) as never;
    const template = createResourceTemplates(client).find(
      t => t.uriTemplate === 'atproto://feed/{actor}'
    )!;

    await expect(template.read({ actor: 'missing.bsky.social' })).rejects.toThrow(
      'Actor not found'
    );
  });
});

describe('resolveResourceUri', () => {
  const setup = (authenticated = true) => {
    const { client, agent } = createMockAtpClient(authenticated);
    const resources = createResources(client);
    const templates = createResourceTemplates(client);
    return { client, agent, resources, templates };
  };

  it('resolves static URIs before templates', () => {
    const { resources, templates } = setup();

    const resolved = resolveResourceUri('atproto://profile', resources, templates);

    expect(resolved).not.toBeNull();
    expect(resolved!.name).toBe('User Profile');
    expect(resolved!.uri).toBe('atproto://profile');
  });

  it('resolves all three existing static URIs', () => {
    const { resources, templates } = setup();

    for (const uri of ['atproto://timeline', 'atproto://profile', 'atproto://notifications']) {
      expect(resolveResourceUri(uri, resources, templates)).not.toBeNull();
    }
  });

  it('resolves a templated profile URI and reads it', async () => {
    const { agent, resources, templates } = setup();
    agent.getProfile = vi.fn().mockResolvedValue(mockProfileResponse);

    const resolved = resolveResourceUri(
      'atproto://profile/alice.bsky.social',
      resources,
      templates
    );

    expect(resolved).not.toBeNull();
    expect(resolved!.mimeType).toBe('application/json');

    const content = await resolved!.read();
    expect(content.uri).toBe('atproto://profile/alice.bsky.social');
    expect(JSON.parse(content.text!).profile.handle).toBe('alice.bsky.social');
  });

  it('echoes the requested URI back for encoded actors', async () => {
    const { agent, resources, templates } = setup();
    agent.getProfile = vi.fn().mockResolvedValue(mockProfileResponse);

    const requested = 'atproto://profile/did%3Aplc%3Aabc123';
    const resolved = resolveResourceUri(requested, resources, templates);

    expect(resolved).not.toBeNull();
    const content = await resolved!.read();
    expect(content.uri).toBe(requested);
    expect(agent.getProfile).toHaveBeenCalledWith({ actor: 'did:plc:abc123' });
  });

  it('resolves a templated feed URI', async () => {
    const { agent, resources, templates } = setup();
    agent.app.bsky.feed.getAuthorFeed = vi.fn().mockResolvedValue(mockFeedResponse) as never;

    const resolved = resolveResourceUri('atproto://feed/alice.bsky.social', resources, templates);

    expect(resolved).not.toBeNull();
    const content = await resolved!.read();
    expect(JSON.parse(content.text!).posts).toHaveLength(1);
  });

  it('reports templated resources as available even when unauthenticated', async () => {
    const { resources, templates } = setup(false);

    const resolved = resolveResourceUri(
      'atproto://profile/alice.bsky.social',
      resources,
      templates
    );

    expect(resolved).not.toBeNull();
    await expect(resolved!.isAvailable()).resolves.toBe(true);
  });

  it('delegates availability of static resources to the resource', async () => {
    const { resources, templates } = setup(false);

    const resolved = resolveResourceUri('atproto://profile', resources, templates);

    expect(resolved).not.toBeNull();
    await expect(resolved!.isAvailable()).resolves.toBe(false);
  });

  it('returns null for unknown URIs', () => {
    const { resources, templates } = setup();

    expect(resolveResourceUri('atproto://unknown', resources, templates)).toBeNull();
  });

  it('returns null for a templated URI with an invalid actor', () => {
    const { resources, templates } = setup();

    expect(resolveResourceUri('atproto://profile/bad_actor', resources, templates)).toBeNull();
    expect(resolveResourceUri('atproto://feed/', resources, templates)).toBeNull();
  });
});
