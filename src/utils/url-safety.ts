/**
 * SSRF / path-traversal safety helpers.
 *
 * MCP tool arguments (URLs, file paths) are effectively untrusted — they may be
 * supplied by an LLM acting on third-party content. Before the server makes an
 * outbound request or reads a local file on the caller's behalf, these helpers
 * reject private/internal network destinations and paths outside an allowed
 * directory.
 */

import { lookup } from 'node:dns/promises';
import { isIP, isIPv4, isIPv6 } from 'node:net';
import path from 'node:path';

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    n = (n << 8) | value;
  }
  return n >>> 0;
}

function inV4Cidr(ipInt: number, base: string, prefix: number): boolean {
  const baseInt = ipv4ToInt(base);
  if (baseInt === null) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

// IPv4 ranges that must never be reached from a tool-supplied URL.
const V4_BLOCKED: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local (incl. 169.254.169.254 cloud metadata)
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved (incl. 255.255.255.255)
];

function isBlockedIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // unparseable → block to be safe
  return V4_BLOCKED.some(([base, prefix]) => inV4Cidr(n, base, prefix));
}

/** Expand an IPv6 literal (with optional `::` and embedded IPv4) to 16 bytes. */
function ipv6ToBytes(ip: string): number[] | null {
  let addr = ip;
  const zone = addr.indexOf('%');
  if (zone >= 0) addr = addr.slice(0, zone);

  // Embedded IPv4 form, e.g. ::ffff:1.2.3.4
  const lastColon = addr.lastIndexOf(':');
  const tail = addr.slice(lastColon + 1);
  if (tail.includes('.')) {
    const v4 = ipv4ToInt(tail);
    if (v4 === null) return null;
    const hi = ((v4 >>> 16) & 0xffff).toString(16);
    const lo = (v4 & 0xffff).toString(16);
    addr = `${addr.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const halves = addr.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tailParts = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : null;

  let hextets: string[];
  if (tailParts === null) {
    hextets = head;
    if (hextets.length !== 8) return null;
  } else {
    const missing = 8 - head.length - tailParts.length;
    if (missing < 0) return null;
    hextets = [...head, ...Array(missing).fill('0'), ...tailParts];
  }

  const bytes: number[] = [];
  for (const hextet of hextets) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(hextet)) return null;
    const value = parseInt(hextet, 16);
    bytes.push((value >> 8) & 0xff, value & 0xff);
  }
  return bytes.length === 16 ? bytes : null;
}

function isBlockedIPv6(ip: string): boolean {
  const b = ipv6ToBytes(ip);
  if (!b) return true;
  if (b.every(x => x === 0)) return true; // :: unspecified
  if (b.slice(0, 15).every(x => x === 0) && b[15] === 1) return true; // ::1 loopback
  if ((b[0]! & 0xfe) === 0xfc) return true; // fc00::/7 unique-local
  if (b[0] === 0xfe && (b[1]! & 0xc0) === 0x80) return true; // fe80::/10 link-local
  if (b[0] === 0xff) return true; // ff00::/8 multicast
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return true; // 2001:db8::/32 docs
  // IPv4-mapped ::ffff:a.b.c.d
  if (b.slice(0, 10).every(x => x === 0) && b[10] === 0xff && b[11] === 0xff) {
    return isBlockedIPv4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`);
  }
  return false;
}

/**
 * True if the given IP literal is loopback / private / link-local / reserved,
 * i.e. must not be reachable via a tool-supplied URL. Non-IP input returns true
 * (callers resolve hostnames via DNS and check the resulting addresses).
 */
export function isBlockedAddress(ip: string): boolean {
  if (isIPv4(ip)) return isBlockedIPv4(ip);
  if (isIPv6(ip)) return isBlockedIPv6(ip);
  return true;
}

function stripBrackets(host: string): string {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

/**
 * Parse a URL, require an http(s) scheme, and reject literal private/internal IP
 * hosts. Does not perform DNS resolution (see {@link safeFetch}).
 */
export function parseSafeHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      `Unsupported URL scheme/protocol "${url.protocol}" — only http and https are allowed`
    );
  }
  const host = stripBrackets(url.hostname);
  if (isIP(host) && isBlockedAddress(host)) {
    throw new Error(`Refusing to fetch private/internal address ${host} (blocked)`);
  }
  return url;
}

/**
 * Resolve a (possibly relative) file path against an allowed base directory and
 * ensure it does not escape that directory. Returns the resolved absolute path.
 */
export function assertSafePath(filePath: string, baseDir: string): string {
  const resolvedBase = path.resolve(baseDir);
  const resolved = path.resolve(resolvedBase, filePath);
  const rel = path.relative(resolvedBase, resolved);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(
      `Refusing to access "${filePath}": resolved path is outside the allowed directory (${resolvedBase})`
    );
  }
  return resolved;
}

async function assertResolvedHostIsPublic(hostname: string): Promise<void> {
  const host = stripBrackets(hostname);
  if (isIP(host)) {
    if (isBlockedAddress(host)) {
      throw new Error(`Refusing to fetch private/internal address ${host}`);
    }
    return;
  }
  const results = await lookup(host, { all: true });
  if (results.length === 0) {
    throw new Error(`Could not resolve host: ${host}`);
  }
  for (const { address } of results) {
    if (isBlockedAddress(address)) {
      throw new Error(`Refusing to fetch ${host}: resolves to private/internal address ${address}`);
    }
  }
}

async function readCapped(response: Response, maxBytes: number): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.length > maxBytes) {
      throw new Error(`Response exceeds the maximum allowed size of ${maxBytes} bytes`);
    }
    return buf;
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`Response exceeds the maximum allowed size of ${maxBytes} bytes`);
      }
      chunks.push(Buffer.from(value));
    }
  }
  return Buffer.concat(chunks);
}

export interface ISafeFetchResult {
  url: string;
  status: number;
  contentType: string | null;
  body: Buffer;
}

export interface ISafeFetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
}

/**
 * SSRF-safe fetch: enforces an http(s)-only scheme, resolves DNS and rejects any
 * private/internal resolved address, follows redirects manually (re-validating
 * each hop), and caps both response size and total time.
 */
export async function safeFetch(
  rawUrl: string,
  options: ISafeFetchOptions = {}
): Promise<ISafeFetchResult> {
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxRedirects = options.maxRedirects ?? 3;

  let current = parseSafeHttpUrl(rawUrl);

  for (let redirect = 0; redirect <= maxRedirects; redirect++) {
    await assertResolvedHostIsPublic(current.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        ...(options.headers ? { headers: options.headers } : {}),
      });
    } finally {
      clearTimeout(timer);
    }

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      current = parseSafeHttpUrl(new URL(location, current).toString());
      continue;
    }

    const body = await readCapped(response, maxBytes);
    return {
      url: current.toString(),
      status: response.status,
      contentType: response.headers.get('content-type'),
      body,
    };
  }

  throw new Error(`Too many redirects while fetching ${rawUrl}`);
}
