/**
 * Real-time streaming tools for AT Protocol firehose
 */

import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import type { AtpClient } from '../../utils/atp-client.js';
import { FirehoseClient, type FirehoseSubscription } from '../../utils/firehose-client.js';

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
      'Start real-time streaming of AT Protocol events from the firehose. Optionally filter by specific collections.',
    params: StartStreamingSchema,
  };

  public static firehoseClient: FirehoseClient | null = null;
  public static eventBuffer: any[] = [];
  public static maxBufferSize = 100;

  constructor(atpClient: AtpClient) {
    super(atpClient, 'StartStreaming');
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
      const subscription: FirehoseSubscription = {
        id: params.subscriptionId,
        collections: params.collections,
        onEvent: event => {
          this.logger.debug('Received firehose event', {
            subscriptionId: params.subscriptionId,
            type: event.type,
            seq: event.seq,
            collection: event.commit?.collection,
          });
        },
        onError: error => {
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
    description: 'Get the current status of firehose streaming and recent events.',
    params: GetStreamingStatusSchema,
  };

  constructor(atpClient: AtpClient) {
    super(atpClient, 'GetStreamingStatus');
  }

  protected async execute(): Promise<{
    success: boolean;
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
    description: 'Get recent events from the firehose stream buffer.',
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
