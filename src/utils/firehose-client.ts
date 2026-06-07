/**
 * AT Protocol Firehose Client for real-time streaming
 */

import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { Logger } from './logger.js';
import type { IAtpConfig } from '../types/index.js';

export interface IFirehoseEvent {
  type: 'commit' | 'handle' | 'migrate' | 'tombstone';
  seq: number;
  time: string;
  repo: string;
  commit?: {
    rev: string;
    operation: 'create' | 'update' | 'delete';
    collection: string;
    rkey: string;
    record?: any;
    cid?: string;
  };
}

export interface IFirehoseSubscription {
  id: string;
  collections?: string[];
  onEvent: (event: IFirehoseEvent) => void;
  onError?: (error: Error) => void;
}

/**
 * Whether AT Protocol firehose frame (CAR/DAG-CBOR) decoding is implemented.
 *
 * While this is `false`, {@link FirehoseClient.parseFirehoseMessage} decodes
 * nothing, so no events are ever emitted and the streaming tools' event buffer
 * stays empty. Tools read this flag so they can tell the caller "not
 * implemented" instead of presenting an empty buffer as "nothing matched".
 */
export const FIREHOSE_DECODING_IMPLEMENTED = false;

export class FirehoseClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private logger: Logger;
  private config: IAtpConfig;
  private subscriptions = new Map<string, IFirehoseSubscription>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private isConnecting = false;
  private isShuttingDown = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private lastSeq: number | null = null;
  private warnedParserNotImplemented = false;

  constructor(config: IAtpConfig) {
    super();
    this.config = config;
    this.logger = new Logger('FirehoseClient');
  }

  /**
   * Connect to the AT Protocol firehose
   */
  async connect(): Promise<void> {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;
    this.isShuttingDown = false;

    try {
      const firehoseUrl = this.getFirehoseUrl();
      this.logger.info('Connecting to AT Protocol firehose', { url: firehoseUrl });

      this.ws = new WebSocket(firehoseUrl);

      this.ws.on('open', () => {
        this.logger.info('Firehose connection established');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.startHeartbeat();
        this.emit('connected');
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          this.handleMessage(data);
        } catch (error) {
          this.logger.error('Error handling firehose message', error);
          this.emit('error', error);
        }
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        this.logger.warn('Firehose connection closed', {
          code,
          reason: reason.toString(),
          reconnectAttempts: this.reconnectAttempts,
        });

        this.cleanup();
        this.emit('disconnected', { code, reason: reason.toString() });

        if (!this.isShuttingDown && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (error: Error) => {
        this.logger.error('Firehose connection error', error);
        this.cleanup();
        this.emit('error', error);

        if (!this.isShuttingDown && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      });
    } catch (error) {
      this.isConnecting = false;
      this.logger.error('Failed to connect to firehose', error);
      throw error;
    }
  }

  /**
   * Disconnect from the firehose
   */
  async disconnect(): Promise<void> {
    this.isShuttingDown = true;
    this.cleanup();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.logger.info('Firehose client disconnected');
    this.emit('disconnected', { code: 1000, reason: 'Client disconnect' });
  }

  /**
   * Subscribe to firehose events
   */
  subscribe(subscription: IFirehoseSubscription): void {
    this.subscriptions.set(subscription.id, subscription);
    this.logger.info('Added firehose subscription', {
      id: subscription.id,
      collections: subscription.collections,
    });
  }

  /**
   * Unsubscribe from firehose events
   */
  unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
    this.logger.info('Removed firehose subscription', { id: subscriptionId });
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get the last processed sequence number
   */
  getLastSeq(): number | null {
    return this.lastSeq;
  }

  /**
   * Get firehose WebSocket URL.
   *
   * The repo firehose (com.atproto.sync.subscribeRepos) is served by a relay, not
   * by the AppView/PDS service used for normal API calls. Default to the public
   * Bluesky relay; override with ATPROTO_RELAY.
   */
  private getFirehoseUrl(): string {
    const relay = process.env['ATPROTO_RELAY'] ?? 'wss://bsky.network';
    const baseUrl = relay.replace(/^(wss?|https?):\/\//, '');
    return `wss://${baseUrl}/xrpc/com.atproto.sync.subscribeRepos`;
  }

  /**
   * Handle incoming firehose message
   */
  private handleMessage(data: Buffer): void {
    try {
      // Parse CAR (Content Addressable aRchive) format
      // This is a simplified parser - in production, use proper CAR parsing library
      const event = this.parseFirehoseMessage(data);

      if (event) {
        this.lastSeq = event.seq;
        this.processEvent(event);
      }
    } catch (error) {
      this.logger.error('Failed to parse firehose message', error);
    }
  }

  /**
   * Parse a firehose frame.
   *
   * Firehose frames are DAG-CBOR headers followed by a CAR block; decoding them
   * correctly requires a CAR/CBOR decoder (e.g. @atproto/repo + @ipld/car), which
   * is not yet wired in here. This previously FABRICATED a fake post for every
   * frame, surfacing made-up data as if it were real firehose activity. Until a
   * real decoder is implemented, return null (emit nothing) rather than lie.
   */
  private parseFirehoseMessage(_data: Buffer): IFirehoseEvent | null {
    if (!this.warnedParserNotImplemented) {
      this.warnedParserNotImplemented = true;
      this.logger.warn(
        'Firehose frame decoding is not implemented; real-time events will not be emitted. ' +
          'No fabricated events are produced.'
      );
    }
    return null;
  }

  /**
   * Process firehose event and notify subscribers
   */
  private processEvent(event: IFirehoseEvent): void {
    this.emit('event', event);

    // Notify matching subscriptions
    for (const subscription of this.subscriptions.values()) {
      try {
        // Check if subscription matches the event
        if (this.matchesSubscription(event, subscription)) {
          subscription.onEvent(event);
        }
      } catch (error) {
        this.logger.error('Error in subscription handler', error);
        if (subscription.onError) {
          subscription.onError(error as Error);
        }
      }
    }
  }

  /**
   * Check if event matches subscription criteria
   */
  private matchesSubscription(event: IFirehoseEvent, subscription: IFirehoseSubscription): boolean {
    // If no collections specified, match all events
    if (!subscription.collections || subscription.collections.length === 0) {
      return true;
    }

    // Check if event collection matches subscription
    if (event.commit?.collection) {
      return subscription.collections.includes(event.commit.collection);
    }

    return false;
  }

  /**
   * Schedule reconnection attempt.
   *
   * Both the 'close' and 'error' handlers can fire for a single failed
   * connection, so guard against double-scheduling. The timer is unref'd so a
   * pending reconnect never keeps the Node process alive on its own.
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.isShuttingDown) {
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);

    this.logger.info('Scheduling firehose reconnection', {
      attempt: this.reconnectAttempts,
      delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isShuttingDown) {
        this.connect().catch(error => {
          this.logger.error('Reconnection attempt failed', error);
        });
      }
    }, delay);
    this.reconnectTimer.unref();
  }

  /**
   * Start heartbeat to keep connection alive. The interval is unref'd so it
   * never keeps the process alive after the rest of the server has shut down.
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000); // Ping every 30 seconds
    this.heartbeatInterval.unref();
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.isConnecting = false;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
