/**
 * Regression test: processEvent must iterate a snapshot of the subscriptions, so
 * a handler that unsubscribes (or subscribes) another listener during dispatch
 * does not cause the live Map iteration to skip a still-valid subscriber.
 */

import { describe, it, expect, vi } from 'vitest';
import { FirehoseClient, type IFirehoseEvent } from '../firehose-client.js';

const event: IFirehoseEvent = {
  type: 'commit',
  seq: 1,
  time: new Date(0).toISOString(),
  repo: 'did:plc:repo',
  commit: { rev: 'r', operation: 'create', collection: 'app.bsky.feed.post', rkey: 'x' },
};

describe('FirehoseClient.processEvent subscription iteration', () => {
  it('still delivers to a subscriber that another handler unsubscribes mid-dispatch', () => {
    const client = new FirehoseClient({ service: 'https://bsky.social' } as never);

    const bHandler = vi.fn();

    // A's handler unsubscribes B during dispatch (mutating the Map mid-iteration).
    client.subscribe({
      id: 'A',
      onEvent: () => client.unsubscribe('B'),
    });
    client.subscribe({
      id: 'B',
      onEvent: bHandler,
    });

    // Invoke the private dispatcher directly (decoding is not wired up, so it is
    // never reached via the socket in this build).
    (client as unknown as { processEvent(e: IFirehoseEvent): void }).processEvent(event);

    // With live Map iteration, B is skipped because A deleted it before it was
    // reached. A snapshot delivers the in-flight event to B regardless.
    expect(bHandler).toHaveBeenCalledTimes(1);
  });
});
