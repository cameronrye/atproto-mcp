import { describe, expect, it } from 'vitest';
import { assertSafePath, isBlockedAddress, parseSafeHttpUrl } from '../url-safety.js';

describe('isBlockedAddress', () => {
  it('blocks IPv4 loopback, private, link-local, and reserved ranges', () => {
    for (const ip of [
      '127.0.0.1',
      '127.1.2.3',
      '0.0.0.0',
      '10.0.0.1',
      '10.255.255.255',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.0.1',
      '192.168.1.1',
      '169.254.169.254', // cloud metadata endpoint
      '169.254.0.1',
      '100.64.0.1', // CGNAT
      '224.0.0.1', // multicast
      '255.255.255.255',
    ]) {
      expect(isBlockedAddress(ip), `${ip} should be blocked`).toBe(true);
    }
  });

  it('blocks IPv6 loopback, ULA, link-local, and IPv4-mapped private', () => {
    for (const ip of [
      '::1',
      '::',
      'fc00::1',
      'fd12:3456::1',
      'fe80::1',
      '::ffff:127.0.0.1', // IPv4-mapped loopback
      '::ffff:10.0.0.1', // IPv4-mapped private
      '::7f00:1', // IPv4-compatible 127.0.0.1
      '::a00:1', // IPv4-compatible 10.0.0.1
      '2002:7f00:1::1', // 6to4 wrapping 127.0.0.1
      '2002:a00:1::1', // 6to4 wrapping 10.0.0.1
    ]) {
      expect(isBlockedAddress(ip), `${ip} should be blocked`).toBe(true);
    }
  });

  it('allows public IPv4 and IPv6 addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111']) {
      expect(isBlockedAddress(ip), `${ip} should be allowed`).toBe(false);
    }
  });
});

describe('parseSafeHttpUrl', () => {
  it('accepts http(s) URLs', () => {
    expect(parseSafeHttpUrl('https://example.com/page').protocol).toBe('https:');
    expect(parseSafeHttpUrl('http://example.com').protocol).toBe('http:');
  });

  it('rejects non-http(s) schemes', () => {
    for (const url of [
      'file:///etc/passwd',
      'gopher://example.com',
      'ftp://example.com',
      'data:text/plain,hi',
    ]) {
      expect(() => parseSafeHttpUrl(url), `${url} should be rejected`).toThrow(/scheme|protocol/i);
    }
  });

  it('rejects URLs whose host is a literal blocked IP', () => {
    for (const url of [
      'http://127.0.0.1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://[::1]/',
      'http://10.0.0.5/',
    ]) {
      expect(() => parseSafeHttpUrl(url), `${url} should be rejected`).toThrow(
        /private|internal|blocked/i
      );
    }
  });
});

describe('assertSafePath', () => {
  it('allows a path inside the base directory', () => {
    expect(() => assertSafePath('/srv/media/photo.jpg', '/srv/media')).not.toThrow();
    expect(() => assertSafePath('/srv/media/sub/photo.jpg', '/srv/media')).not.toThrow();
  });

  it('rejects traversal outside the base directory', () => {
    expect(() => assertSafePath('/srv/media/../secrets.txt', '/srv/media')).toThrow(
      /outside|allowed/i
    );
    expect(() => assertSafePath('/etc/passwd', '/srv/media')).toThrow(/outside|allowed/i);
  });
});
