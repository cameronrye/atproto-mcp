/**
 * Parameterized MCP resource templates for AT Protocol data.
 *
 * Unlike the static resources in index.ts (which expose the authenticated
 * user's own data), templates expose any actor's PUBLIC data and therefore
 * work without authentication: AtpClient.getAgent() transparently falls back
 * to the public API agent (https://public.api.bsky.app) when no session is
 * active, exactly like the read-only tools.
 */

import { ValidationError } from '../types/index.js';
import type { AtpClient } from '../utils/atp-client.js';
import { Logger } from '../utils/logger.js';
import type { BaseResource, IResourceContent } from './base.js';

/**
 * A parameterized resource template. `uriTemplate` is an RFC 6570 URI
 * template suitable for the resources/templates/list response; `matcher`
 * extracts the template variables from a concrete URI (or returns null when
 * the URI does not belong to this template); `read` fetches the content for
 * previously matched parameters.
 */
export interface IResourceTemplate {
  readonly uriTemplate: string;
  readonly name: string;
  readonly description: string;
  readonly mimeType: string;
  matcher: (uri: string) => Record<string, string> | null;
  read: (params: Record<string, string>) => Promise<IResourceContent>;
}

/**
 * A resource resolved from a concrete URI: either a static resource or a
 * template bound to its matched parameters. `read()` always returns content
 * whose uri echoes the originally requested URI.
 */
export interface IResolvedResource {
  readonly uri: string;
  readonly name: string;
  readonly description: string;
  readonly mimeType: string;
  isAvailable: () => Promise<boolean>;
  read: () => Promise<IResourceContent>;
}

// Actor validation mirrors BaseTool.validateActor: a DID (did:method:id) or a
// DNS-style handle with at least two valid DNS labels. The identifier portion
// of a DID allows ':' so did:web host:port:path segments are not rejected.
const DID_PATTERN = /^did:[a-z0-9]+:[a-zA-Z0-9._:%-]+$/;
const DNS_LABEL_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

function isValidHandle(handle: string): boolean {
  const labels = handle.split('.');
  if (labels.length < 2) {
    return false;
  }
  return labels.every(label => DNS_LABEL_PATTERN.test(label));
}

function isValidActor(actor: string): boolean {
  if (!actor || actor.length > 2048) {
    return false;
  }
  return DID_PATTERN.test(actor) || isValidHandle(actor);
}

/**
 * Match a `<prefix>{actor}` URI: the actor is the single remaining path
 * segment, possibly percent-encoded. Returns null for empty/extra segments,
 * malformed percent-encoding, or an actor that is neither a DID nor a handle.
 */
function matchActorTemplate(uri: string, prefix: string): Record<string, string> | null {
  if (!uri.startsWith(prefix)) {
    return null;
  }

  const rawActor = uri.slice(prefix.length);
  if (rawActor.length === 0 || rawActor.includes('/')) {
    return null;
  }

  let actor: string;
  try {
    actor = decodeURIComponent(rawActor);
  } catch {
    // Malformed percent-encoding (decodeURIComponent throws URIError).
    return null;
  }

  return isValidActor(actor) ? { actor } : null;
}

/**
 * Extract and validate the `actor` template parameter. Templates validate at
 * match time too, but `read` can be called directly, so it must not trust its
 * input.
 */
function requireActor(params: Record<string, string>): string {
  const actor = params['actor'];
  if (!actor || !isValidActor(actor)) {
    throw new ValidationError(
      'Actor must be a valid DID (did:...) or handle (user.domain.com)',
      'actor',
      actor
    );
  }
  return actor;
}

/**
 * Profile template - exposes any actor's public profile as JSON
 */
export class ActorProfileTemplate implements IResourceTemplate {
  public readonly uriTemplate = 'atproto://profile/{actor}';
  public readonly name = 'Actor Profile';
  public readonly description =
    'Public profile information and statistics for any AT Protocol actor, addressed by handle (e.g. alice.bsky.social) or DID (e.g. did:plc:...). Works without authentication.';
  public readonly mimeType = 'application/json';

  private readonly logger: Logger;

  constructor(private readonly atpClient: AtpClient) {
    this.logger = new Logger('ActorProfileTemplate');
  }

  matcher(uri: string): Record<string, string> | null {
    return matchActorTemplate(uri, 'atproto://profile/');
  }

  async read(params: Record<string, string>): Promise<IResourceContent> {
    const actor = requireActor(params);

    try {
      this.logger.info('Reading actor profile resource', { actor });

      // getAgent() returns the public API agent when unauthenticated, so this
      // read path requires no session.
      const agent = this.atpClient.getAgent();
      const response = await agent.getProfile({ actor });

      const uri = `atproto://profile/${encodeURIComponent(actor)}`;
      const profileData = {
        uri,
        timestamp: new Date().toISOString(),
        profile: {
          did: response.data.did,
          handle: response.data.handle,
          displayName: response.data.displayName,
          description: response.data.description,
          avatar: response.data.avatar,
          banner: response.data.banner,
          followersCount: response.data.followersCount ?? 0,
          followsCount: response.data.followsCount ?? 0,
          postsCount: response.data.postsCount ?? 0,
          indexedAt: response.data.indexedAt,
          createdAt: response.data.createdAt,
          labels: response.data.labels ?? [],
        },
      };

      return {
        uri,
        mimeType: this.mimeType,
        text: JSON.stringify(profileData, null, 2),
      };
    } catch (error) {
      this.logger.error('Failed to read actor profile resource', error);
      throw error;
    }
  }
}

/**
 * Feed template - exposes any actor's public author feed as JSON
 */
export class ActorFeedTemplate implements IResourceTemplate {
  public readonly uriTemplate = 'atproto://feed/{actor}';
  public readonly name = 'Actor Feed';
  public readonly description =
    'Recent public posts by any AT Protocol actor, addressed by handle (e.g. alice.bsky.social) or DID (e.g. did:plc:...). Works without authentication.';
  public readonly mimeType = 'application/json';

  private readonly logger: Logger;

  constructor(private readonly atpClient: AtpClient) {
    this.logger = new Logger('ActorFeedTemplate');
  }

  matcher(uri: string): Record<string, string> | null {
    return matchActorTemplate(uri, 'atproto://feed/');
  }

  async read(params: Record<string, string>): Promise<IResourceContent> {
    const actor = requireActor(params);

    try {
      this.logger.info('Reading actor feed resource', { actor });

      // getAgent() returns the public API agent when unauthenticated, so this
      // read path requires no session.
      const agent = this.atpClient.getAgent();
      const response = await agent.app.bsky.feed.getAuthorFeed({
        actor,
        limit: 50,
      });

      const uri = `atproto://feed/${encodeURIComponent(actor)}`;
      const feedData = {
        uri,
        actor,
        timestamp: new Date().toISOString(),
        posts: response.data.feed.map((item: any) => ({
          uri: item.post.uri,
          cid: item.post.cid,
          author: {
            did: item.post.author.did,
            handle: item.post.author.handle,
            displayName: item.post.author.displayName,
            avatar: item.post.author.avatar,
          },
          text: item.post.record.text,
          createdAt: item.post.record.createdAt,
          replyCount: item.post.replyCount ?? 0,
          repostCount: item.post.repostCount ?? 0,
          likeCount: item.post.likeCount ?? 0,
          indexedAt: item.post.indexedAt,
          embed: item.post.embed,
          reply: item.post.record.reply,
        })),
        cursor: response.data.cursor,
      };

      return {
        uri,
        mimeType: this.mimeType,
        text: JSON.stringify(feedData, null, 2),
      };
    } catch (error) {
      this.logger.error('Failed to read actor feed resource', error);
      throw error;
    }
  }
}

/**
 * Create all parameterized MCP resource templates for AT Protocol data
 */
export function createResourceTemplates(atpClient: AtpClient): IResourceTemplate[] {
  return [new ActorProfileTemplate(atpClient), new ActorFeedTemplate(atpClient)];
}

/**
 * Resolve a concrete resource URI against the static resources first, then
 * the parameterized templates. Returns null when nothing matches (the server
 * should answer -32002 Resource not found).
 *
 * For template matches the returned `read()` echoes the originally requested
 * URI back in the content (clients correlate contents by the URI they asked
 * for, which may be percent-encoded differently than the canonical form), and
 * `isAvailable()` is always true because templates only serve public data.
 */
export function resolveResourceUri(
  uri: string,
  resources: readonly BaseResource[],
  templates: readonly IResourceTemplate[]
): IResolvedResource | null {
  const staticResource = resources.find(resource => resource.uri === uri);
  if (staticResource) {
    return {
      uri,
      name: staticResource.name,
      description: staticResource.description,
      mimeType: staticResource.mimeType,
      isAvailable: () => staticResource.isAvailable(),
      read: () => staticResource.read(),
    };
  }

  for (const template of templates) {
    const params = template.matcher(uri);
    if (params) {
      return {
        uri,
        name: template.name,
        description: template.description,
        mimeType: template.mimeType,
        isAvailable: () => Promise.resolve(true),
        read: async () => {
          const content = await template.read(params);
          return { ...content, uri };
        },
      };
    }
  }

  return null;
}
