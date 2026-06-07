/**
 * Real-time streaming tools for AT Protocol firehose
 */

import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import {
  FIREHOSE_DECODING_IMPLEMENTED,
  FirehoseClient,
  type IFirehoseEvent,
  type IFirehoseSubscription,
} from '../../utils/firehose-client.js';

/**
 * Shared disclaimer surfaced to the calling LLM whenever firehose decoding is
 * not implemented, so an empty result is not mistaken for "nothing matched".
 */
const FIREHOSE_NOT_IMPLEMENTED_NOTE =
  'AT Protocol firehose frame (CAR/DAG-CBOR) decoding is not implemented in this build, ' +
  'so no live events are ever decoded into the buffer. Empty results here mean "streaming ' +
  'is not available", not "no activity".';

const StartStreamingSchema = z.object({
  collections: z.array(z.string()).optional().default([]),
  subscriptionId: z.string().min(1, 'Subscription ID is required'),
});

const StopStreamingSchema = z.object({
  subscriptionId: z.string().min(1, 'Subscription ID is required'),
});

const GetStreamingStatusSchema = z.object({});

export class StartStreamingTool extends BaseTool {
  public readonly schema = {
    method: 'start_streaming',
    description:
      'Start real-time streaming of AT Protocol firehose events, optionally filtered by ' +
      'collection. NOTE: firehose frame decoding is not implemented in this build, so this ' +
      'currently returns a "not implemented" status and delivers no events.',
    params: StartStreamingSchema,
  };

  public static firehoseClient: FirehoseClient | null = null;
  public static eventBuffer: any[] = [];
  public static maxBufferSize = 100;

  constructor(atpClient: AtpClient) {
    super(atpClient, 'StartStreaming');
  }

  /** Disconnect the shared firehose client (called on server shutdown). */
  static async shutdown(): Promise<void> {
    if (StartStreamingTool.firehoseClient) {
      await StartStreamingTool.firehoseClient.disconnect();
      StartStreamingTool.firehoseClient = null;
    }
    StartStreamingTool.eventBuffer = [];
  }

  protected async execute(params: { collections?: string[]; subscriptionId: string }): Promise<{
    success: boolean;
    message: string;
    subscription: {
      id: string;
      collections: string[];
      status: string;
    };
    firehoseStatus: {
      connected: boolean;
      lastSeq: number | null;
      subscriptionCount: number;
    };
  }> {
    try {
      this.logger.info('Starting firehose streaming', {
        subscriptionId: params.subscriptionId,
        collections: params.collections,
      });

      // Firehose frame decoding is not implemented, so opening a socket would
      // only buffer nothing and leak a connection. Refuse honestly instead of
      // reporting a stream as 'active' that can never deliver events.
      if (!FIREHOSE_DECODING_IMPLEMENTED) {
        this.logger.warn('start_streaming requested but firehose decoding is not implemented');
        return {
          success: false,
          message: `Real-time streaming is not available. ${FIREHOSE_NOT_IMPLEMENTED_NOTE}`,
          subscription: {
            id: params.subscriptionId,
            collections: params.collections || [],
            status: 'not_implemented',
          },
          firehoseStatus: {
            connected: false,
            lastSeq: null,
            subscriptionCount: 0,
          },
        };
      }

      // Initialize firehose client if not already done
      if (!StartStreamingTool.firehoseClient) {
        const config = {
          service: this.atpClient.getAgent().service.toString(),
          authMethod: 'app-password' as const,
        };

        StartStreamingTool.firehoseClient = new FirehoseClient(config);

        // Set up event handlers
        StartStreamingTool.firehoseClient.on('event', event => {
          // Buffer events for retrieval
          StartStreamingTool.eventBuffer.push({
            ...event,
            receivedAt: new Date().toISOString(),
          });

          // Keep buffer size manageable
          if (StartStreamingTool.eventBuffer.length > StartStreamingTool.maxBufferSize) {
            StartStreamingTool.eventBuffer.shift();
          }
        });

        StartStreamingTool.firehoseClient.on('connected', () => {
          this.logger.info('Firehose client connected');
        });

        StartStreamingTool.firehoseClient.on('disconnected', info => {
          this.logger.warn('Firehose client disconnected', info);
        });

        StartStreamingTool.firehoseClient.on('error', error => {
          this.logger.error('Firehose client error', error);
        });
      }

      // Connect if not already connected
      if (!StartStreamingTool.firehoseClient.isConnected()) {
        await StartStreamingTool.firehoseClient.connect();
      }

      // Create subscription
      const subscription: IFirehoseSubscription = {
        id: params.subscriptionId,
        collections: params.collections,
        onEvent: (event: IFirehoseEvent) => {
          this.logger.debug('Received firehose event', {
            subscriptionId: params.subscriptionId,
            type: event.type,
            seq: event.seq,
            collection: event.commit?.collection,
          });
        },
        onError: (error: Error) => {
          this.logger.error('Subscription error', error, {
            subscriptionId: params.subscriptionId,
          });
        },
      };

      StartStreamingTool.firehoseClient.subscribe(subscription);

      this.logger.info('Firehose streaming started', {
        subscriptionId: params.subscriptionId,
        collections: params.collections,
      });

      return {
        success: true,
        message: `Started streaming AT Protocol events for subscription ${params.subscriptionId}`,
        subscription: {
          id: params.subscriptionId,
          collections: params.collections || [],
          status: 'active',
        },
        firehoseStatus: {
          connected: StartStreamingTool.firehoseClient.isConnected(),
          lastSeq: StartStreamingTool.firehoseClient.getLastSeq(),
          subscriptionCount: (StartStreamingTool.firehoseClient as any).subscriptions?.size || 0,
        },
      };
    } catch (error) {
      this.logger.error('Failed to start streaming', error);
      this.formatError(error);
    }
  }
}

export class StopStreamingTool extends BaseTool {
  public readonly schema = {
    method: 'stop_streaming',
    description: 'Stop a specific real-time streaming subscription.',
    params: StopStreamingSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'StopStreaming');
  }

  protected async execute(params: { subscriptionId: string }): Promise<{
    success: boolean;
    message: string;
    subscription: {
      id: string;
      status: string;
    };
  }> {
    try {
      this.logger.info('Stopping firehose streaming', {
        subscriptionId: params.subscriptionId,
      });

      if (!StartStreamingTool.firehoseClient) {
        return {
          success: false,
          message: 'No active firehose client found',
          subscription: {
            id: params.subscriptionId,
            status: 'not_found',
          },
        };
      }

      StartStreamingTool.firehoseClient.unsubscribe(params.subscriptionId);

      this.logger.info('Firehose streaming stopped', {
        subscriptionId: params.subscriptionId,
      });

      return {
        success: true,
        message: `Stopped streaming subscription ${params.subscriptionId}`,
        subscription: {
          id: params.subscriptionId,
          status: 'stopped',
        },
      };
    } catch (error) {
      this.logger.error('Failed to stop streaming', error);
      this.formatError(error);
    }
  }
}

export class GetStreamingStatusTool extends BaseTool {
  public readonly schema = {
    method: 'get_streaming_status',
    description:
      'Get the current status of firehose streaming and recent events. NOTE: firehose ' +
      'decoding is not implemented, so the event buffer is empty in normal operation.',
    params: GetStreamingStatusSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'GetStreamingStatus');
  }

  protected async execute(): Promise<{
    success: boolean;
    firehoseDecodingImplemented: boolean;
    note?: string;
    firehoseStatus: {
      connected: boolean;
      lastSeq: number | null;
      subscriptionCount: number;
    };
    recentEvents: Array<{
      type: string;
      seq: number;
      time: string;
      repo: string;
      collection?: string;
      operation?: string;
      receivedAt: string;
    }>;
    eventBufferSize: number;
  }> {
    try {
      this.logger.info('Getting streaming status');

      const firehoseStatus = {
        connected: StartStreamingTool.firehoseClient?.isConnected() || false,
        lastSeq: StartStreamingTool.firehoseClient?.getLastSeq() || null,
        subscriptionCount: (StartStreamingTool.firehoseClient as any)?.subscriptions?.size || 0,
      };

      const recentEvents = StartStreamingTool.eventBuffer.slice(-10).map(event => ({
        type: event.type,
        seq: event.seq,
        time: event.time,
        repo: event.repo,
        collection: event.commit?.collection,
        operation: event.commit?.operation,
        receivedAt: event.receivedAt,
      }));

      return {
        success: true,
        firehoseDecodingImplemented: FIREHOSE_DECODING_IMPLEMENTED,
        ...(FIREHOSE_DECODING_IMPLEMENTED ? {} : { note: FIREHOSE_NOT_IMPLEMENTED_NOTE }),
        firehoseStatus,
        recentEvents,
        eventBufferSize: StartStreamingTool.eventBuffer.length,
      };
    } catch (error) {
      this.logger.error('Failed to get streaming status', error);
      this.formatError(error);
    }
  }
}

export class GetRecentEventsTool extends BaseTool {
  public readonly schema = {
    method: 'get_recent_events',
    description:
      'Get recent events from the firehose stream buffer. NOTE: firehose decoding is not ' +
      'implemented, so the buffer is empty in normal operation.',
    params: z.object({
      limit: z.number().min(1).max(100).default(20),
      collection: z.string().optional(),
    }),
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'GetRecentEvents');
  }

  protected async execute(params: { limit?: number; collection?: string }): Promise<{
    success: boolean;
    firehoseDecodingImplemented: boolean;
    note?: string;
    events: Array<{
      type: string;
      seq: number;
      time: string;
      repo: string;
      collection?: string;
      operation?: string;
      record?: any;
      receivedAt: string;
    }>;
    totalBuffered: number;
    filtered: boolean;
  }> {
    try {
      this.logger.info('Getting recent events', {
        limit: params.limit,
        collection: params.collection,
      });

      let events = StartStreamingTool.eventBuffer;
      let filtered = false;

      // Filter by collection if specified
      if (params.collection) {
        events = events.filter(event => event.commit?.collection === params.collection);
        filtered = true;
      }

      // Get the most recent events up to the limit
      const recentEvents = events.slice(-(params.limit || 20)).map(event => ({
        type: event.type,
        seq: event.seq,
        time: event.time,
        repo: event.repo,
        collection: event.commit?.collection,
        operation: event.commit?.operation,
        record: event.commit?.record,
        receivedAt: event.receivedAt,
      }));

      return {
        success: true,
        firehoseDecodingImplemented: FIREHOSE_DECODING_IMPLEMENTED,
        ...(FIREHOSE_DECODING_IMPLEMENTED ? {} : { note: FIREHOSE_NOT_IMPLEMENTED_NOTE }),
        events: recentEvents,
        totalBuffered: StartStreamingTool.eventBuffer.length,
        filtered,
      };
    } catch (error) {
      this.logger.error('Failed to get recent events', error);
      this.formatError(error);
    }
  }
}

export class MonitorKeywordsTool extends BaseTool {
  public readonly schema = {
    method: 'monitor_keywords',
    description:
      'Scan the in-memory firehose event buffer for posts containing specific keywords. ' +
      'NOTE: firehose decoding is not implemented, so the buffer is empty in normal ' +
      'operation and this returns no matches.',
    params: z.object({
      keywords: z.array(z.string()).min(1, 'At least one keyword is required'),
      limit: z.number().min(1).max(100).default(20),
      caseSensitive: z.boolean().default(false),
    }),
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'MonitorKeywords');
  }

  protected async execute(params: {
    keywords: string[];
    limit?: number;
    caseSensitive?: boolean;
  }): Promise<{
    success: boolean;
    firehoseDecodingImplemented: boolean;
    note?: string;
    keywords: string[];
    matches: Array<{
      keyword: string;
      post: {
        uri: string;
        text: string;
        author: string;
        createdAt: string;
      };
      seq: number;
      receivedAt: string;
    }>;
    totalMatches: number;
    totalScanned: number;
  }> {
    try {
      this.logger.info('Monitoring keywords', {
        keywords: params.keywords,
        limit: params.limit,
        caseSensitive: params.caseSensitive,
      });

      const matches: Array<{
        keyword: string;
        post: {
          uri: string;
          text: string;
          author: string;
          createdAt: string;
        };
        seq: number;
        receivedAt: string;
      }> = [];

      // Prepare keywords for matching
      const keywords = params.caseSensitive
        ? params.keywords
        : params.keywords.map(k => k.toLowerCase());

      // Scan event buffer for posts containing keywords
      const postEvents = StartStreamingTool.eventBuffer.filter(
        event =>
          event.commit?.collection === 'app.bsky.feed.post' &&
          event.commit?.operation === 'create' &&
          event.commit?.record
      );

      for (const event of postEvents) {
        const text = event.commit.record.text || '';
        const searchText = params.caseSensitive ? text : text.toLowerCase();

        // Check if any keyword matches
        for (let i = 0; i < keywords.length; i++) {
          const keyword = keywords[i];
          const originalKeyword = params.keywords[i];
          if (searchText.includes(keyword) && originalKeyword) {
            matches.push({
              keyword: originalKeyword, // Original keyword
              post: {
                uri: `at://${event.repo}/${event.commit.collection}/${event.commit.rkey}`,
                text,
                author: event.repo,
                createdAt: event.commit.record.createdAt || event.time,
              },
              seq: event.seq,
              receivedAt: event.receivedAt,
            });

            // Stop checking other keywords for this post
            break;
          }
        }

        // Stop if we've reached the limit
        if (matches.length >= (params.limit || 20)) {
          break;
        }
      }

      this.logger.info('Keyword monitoring complete', {
        keywords: params.keywords,
        totalMatches: matches.length,
        totalScanned: postEvents.length,
      });

      return {
        success: true,
        firehoseDecodingImplemented: FIREHOSE_DECODING_IMPLEMENTED,
        ...(FIREHOSE_DECODING_IMPLEMENTED ? {} : { note: FIREHOSE_NOT_IMPLEMENTED_NOTE }),
        keywords: params.keywords,
        matches: matches.slice(0, params.limit || 20),
        totalMatches: matches.length,
        totalScanned: postEvents.length,
      };
    } catch (error) {
      this.logger.error('Failed to monitor keywords', error);
      this.formatError(error);
    }
  }
}

export class TrackUsersTool extends BaseTool {
  public readonly schema = {
    method: 'track_users',
    description:
      'Scan the in-memory firehose event buffer for activity from specific users (matched ' +
      'by DID). NOTE: firehose decoding is not implemented, so the buffer is empty in normal ' +
      'operation and this returns no events.',
    params: z.object({
      users: z.array(z.string()).min(1, 'At least one user DID or handle is required'),
      limit: z.number().min(1).max(100).default(20),
      eventTypes: z
        .array(z.enum(['post', 'like', 'repost', 'follow', 'profile']))
        .optional()
        .default(['post']),
    }),
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'TrackUsers');
  }

  protected async execute(params: {
    users: string[];
    limit?: number;
    eventTypes?: string[];
  }): Promise<{
    success: boolean;
    firehoseDecodingImplemented: boolean;
    note?: string;
    users: string[];
    events: Array<{
      user: string;
      eventType: string;
      collection: string;
      operation: string;
      record?: any;
      seq: number;
      time: string;
      receivedAt: string;
    }>;
    totalEvents: number;
    totalScanned: number;
  }> {
    try {
      this.logger.info('Tracking users', {
        users: params.users,
        limit: params.limit,
        eventTypes: params.eventTypes,
      });

      // Map event types to collections
      const collectionMap: Record<string, string> = {
        post: 'app.bsky.feed.post',
        like: 'app.bsky.feed.like',
        repost: 'app.bsky.feed.repost',
        follow: 'app.bsky.graph.follow',
        profile: 'app.bsky.actor.profile',
      };

      const targetCollections = (params.eventTypes || ['post']).map(type => collectionMap[type]);

      const events: Array<{
        user: string;
        eventType: string;
        collection: string;
        operation: string;
        record?: any;
        seq: number;
        time: string;
        receivedAt: string;
      }> = [];

      // Scan event buffer for events from specified users
      for (const event of StartStreamingTool.eventBuffer) {
        // Check if event is from one of the tracked users
        if (!params.users.includes(event.repo)) {
          continue;
        }

        // Check if event type matches
        if (event.commit?.collection && targetCollections.includes(event.commit.collection)) {
          const eventType =
            Object.entries(collectionMap).find(
              ([_, col]) => col === event.commit!.collection
            )?.[0] || 'unknown';

          events.push({
            user: event.repo,
            eventType,
            collection: event.commit.collection,
            operation: event.commit.operation,
            record: event.commit.record,
            seq: event.seq,
            time: event.time,
            receivedAt: event.receivedAt,
          });

          // Stop if we've reached the limit
          if (events.length >= (params.limit || 20)) {
            break;
          }
        }
      }

      this.logger.info('User tracking complete', {
        users: params.users,
        totalEvents: events.length,
        totalScanned: StartStreamingTool.eventBuffer.length,
      });

      return {
        success: true,
        firehoseDecodingImplemented: FIREHOSE_DECODING_IMPLEMENTED,
        ...(FIREHOSE_DECODING_IMPLEMENTED ? {} : { note: FIREHOSE_NOT_IMPLEMENTED_NOTE }),
        users: params.users,
        events: events.slice(0, params.limit || 20),
        totalEvents: events.length,
        totalScanned: StartStreamingTool.eventBuffer.length,
      };
    } catch (error) {
      this.logger.error('Failed to track users', error);
      this.formatError(error);
    }
  }
}
