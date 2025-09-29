/**
 * Core type definitions for the AT Protocol MCP Server
 */

// Branded types for AT Protocol identifiers
export type DID = string & { readonly __brand: 'DID' };
export type ATURI = string & { readonly __brand: 'ATURI' };
export type NSID = string & { readonly __brand: 'NSID' };
export type CID = string & { readonly __brand: 'CID' };

// AT Protocol specific types
export interface IAtpSession {
  did: DID;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
  active: boolean;
}

export interface IAtpProfile {
  did: DID;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
}

export interface IAtpPost {
  uri: ATURI;
  cid: CID;
  author: IAtpProfile;
  record: {
    text: string;
    createdAt: string;
    reply?: {
      root: { uri: ATURI; cid: CID };
      parent: { uri: ATURI; cid: CID };
    };
    embed?: unknown;
    langs?: string[];
    labels?: unknown;
    tags?: string[];
  };
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  indexedAt: string;
  viewer?: {
    repost?: ATURI;
    like?: ATURI;
  };
}

// MCP Server configuration
export interface IMcpServerConfig {
  port: number;
  host: string;
  name: string;
  version: string;
  description: string;
  atproto: IAtpConfig;
}

export interface IAtpConfig {
  service: string;
  identifier?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  authMethod?: 'app-password' | 'oauth'; // Now optional to support unauthenticated mode
}

// Tool parameter schemas
export interface ICreatePostParams {
  text: string;
  reply?: {
    root: ATURI;
    parent: ATURI;
  };
  embed?: {
    images?: Array<{
      alt: string;
      image: Blob;
    }>;
    external?: {
      uri: string;
      title: string;
      description: string;
    };
  };
  langs?: string[];
}

export interface IReplyToPostParams {
  text: string;
  root: ATURI;
  parent: ATURI;
  langs?: string[];
}

export interface ILikePostParams {
  uri: ATURI;
  cid: CID;
}

export interface IUnlikePostParams {
  likeUri: ATURI;
}

export interface IRepostParams {
  uri: ATURI;
  cid: CID;
  text?: string; // Quote text
}

export interface IUnrepostParams {
  repostUri: ATURI;
}

export interface IFollowUserParams {
  actor: string; // DID or handle
}

export interface IUnfollowUserParams {
  followUri: ATURI;
}

export interface IGetUserProfileParams {
  actor: string; // DID or handle
}

export interface ISearchPostsParams {
  q: string;
  limit?: number;
  cursor?: string;
  sort?: 'top' | 'latest';
  since?: string;
  until?: string;
  mentions?: string;
  author?: string;
  lang?: string;
  domain?: string;
  url?: string;
}

export interface IGetTimelineParams {
  algorithm?: string;
  limit?: number;
  cursor?: string;
}

export interface IGetFollowersParams {
  actor: string;
  limit?: number;
  cursor?: string;
}

export interface IGetFollowsParams {
  actor: string;
  limit?: number;
  cursor?: string;
}

export interface IGetNotificationsParams {
  limit?: number;
  cursor?: string;
  seenAt?: string;
}

export interface IDeletePostParams {
  uri: ATURI;
}

export interface IUpdateProfileParams {
  displayName?: string;
  description?: string;
  avatar?: Blob;
  banner?: Blob;
}

// Error types with comprehensive error handling
export abstract class BaseError extends Error {
  public readonly timestamp: string;
  public readonly context: Record<string, unknown> | undefined;

  constructor(
    message: string,
    public readonly code: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.context = context;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
    };
  }
}

export class AtpError extends BaseError {
  constructor(
    message: string,
    code: string,
    public readonly statusCode?: number,
    public readonly details?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, code, context);
  }
}

export class McpError extends BaseError {
  constructor(
    message: string,
    public readonly mcpCode: number,
    public readonly data?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, `MCP_${mcpCode}`, context);
  }
}

export class AuthenticationError extends AtpError {
  constructor(message: string, details?: unknown, context?: Record<string, unknown>) {
    super(message, 'AUTHENTICATION_FAILED', 401, details, context);
  }
}

export class RateLimitError extends AtpError {
  constructor(
    message: string,
    public readonly retryAfter?: number,
    context?: Record<string, unknown>
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, { retryAfter }, context);
  }
}

export class ValidationError extends BaseError {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', { ...context, field, value });
  }
}

export class ConfigurationError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIGURATION_ERROR', context);
  }
}

// Utility types
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

export interface IPaginatedResponse<T> {
  data: T[];
  cursor?: string;
  hasMore: boolean;
}

// Resource types
export interface IResourceInfo {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

export interface IPromptTemplate {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

// Authentication types
export interface IOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

export interface IAppPasswordConfig {
  identifier: string;
  password: string;
}
