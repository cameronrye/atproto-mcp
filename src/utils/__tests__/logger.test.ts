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

  it('strips control chars from a logged stack trace but preserves newlines', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const err = new Error('boom');
    // An attacker-influenced error message is echoed in the stack's first line;
    // a raw CR or other control char there would let it forge extra log lines.
    err.stack = 'Error: boom\r\n\x07INJECTED fake line\n  at someFn (file.ts:1:1)';
    new Logger('Test').error('failed', err);

    const output = errSpy.mock.calls.map(call => String(call[0])).join('\n');
    expect(output).not.toContain('\r');
    expect(output).not.toContain('\x07');
    // The genuine stack newlines (frames) are kept for readability.
    expect(output).toContain('\n  at someFn (file.ts:1:1)');
  });
});
