import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger, LogLevel } from '../logger.js';

/**
 * The server speaks MCP over stdio, where process.stdout is the JSON-RPC channel.
 * Any non-protocol bytes on stdout corrupt the stream and break clients, so the
 * logger must never write to stdout — every level goes to stderr.
 */
describe('Logger stdio safety', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes debug/info/warn to stderr, never stdout', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const log = new Logger('Test', LogLevel.DEBUG);
    log.setLogLevel(LogLevel.DEBUG); // override any LOG_LEVEL set by the test env
    log.debug('debug message');
    log.info('info message');
    log.warn('warn message');

    expect(logSpy).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledTimes(3);
  });

  it('writes error logs to stderr', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    new Logger('Test').error('boom', new Error('x'));

    expect(logSpy).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledTimes(1);
  });
});
