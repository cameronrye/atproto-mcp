/**
 * Lifecycle tests for FirehoseClient against a real local WebSocket server.
 *
 * These exercise the socket/reconnect/subscription lifecycle (not frame
 * decoding, which is intentionally not implemented). They guard against socket
 * leaks on reconnect and stale subscriptions surviving a disconnect.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocketServer, type WebSocket as WsSocket } from 'ws';
import type { AddressInfo } from 'net';
import { FirehoseClient } from '../firehose-client.js';
import type { IAtpConfig } from '../../types/index.js';

const baseConfig: IAtpConfig = {
  service: 'https://bsky.social',
  authMethod: 'app-password',
} as IAtpConfig;

function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor timed out'));
      setTimeout(tick, 20);
    };
    tick();
  });
}

describe('FirehoseClient lifecycle', () => {
  let server: WebSocketServer;
  let port: number;
  let connections: WsSocket[] = [];
  let client: FirehoseClient | null = null;
  const prevRelay = process.env['ATPROTO_RELAY'];

  beforeEach(async () => {
    connections = [];
    await new Promise<void>(resolve => {
      server = new WebSocketServer({ port: 0 }, resolve);
    });
    port = (server.address() as AddressInfo).port;
    process.env['ATPROTO_RELAY'] = `ws://127.0.0.1:${port}`;
    server.on('connection', socket => connections.push(socket));
  });

  afterEach(async () => {
    if (client) await client.disconnect();
    client = null;
    for (const c of connections) c.terminate();
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (prevRelay === undefined) delete process.env['ATPROTO_RELAY'];
    else process.env['ATPROTO_RELAY'] = prevRelay;
  });

  it('connects to a ws:// relay and reports connected', async () => {
    client = new FirehoseClient(baseConfig);
    await client.connect();
    await waitFor(() => client!.isConnected());
    expect(client.isConnected()).toBe(true);
    expect(connections.length).toBe(1);
  });

  it('clears subscriptions on disconnect', async () => {
    client = new FirehoseClient(baseConfig);
    client.subscribe({ id: 'sub1', onEvent: () => {} });
    client.subscribe({ id: 'sub2', onEvent: () => {} });
    expect(client.getSubscriptionCount()).toBe(2);

    await client.connect();
    await waitFor(() => client!.isConnected());
    await client.disconnect();

    expect(client.isConnected()).toBe(false);
    expect(client.getSubscriptionCount()).toBe(0);
  });

  it('reconnects automatically after the server drops the connection', async () => {
    client = new FirehoseClient(baseConfig);
    await client.connect();
    await waitFor(() => connections.length === 1);

    // Server-initiated drop should trigger an automatic reconnect.
    connections[0]!.close();

    await waitFor(() => connections.length >= 2, 8000);
    expect(connections.length).toBeGreaterThanOrEqual(2);
  });
});
