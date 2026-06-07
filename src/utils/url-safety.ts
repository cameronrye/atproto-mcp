/**
 * SSRF / path-traversal safety helpers.
 *
 * MCP tool arguments (URLs, file paths) are effectively untrusted — they may be
 * supplied by an LLM acting on third-party content. Before the server makes an
 * outbound request or reads a local file on the caller's behalf, these helpers
 * reject private/internal network destinations and paths outside an allowed
 * directory.
 */

import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
import { type LookupAddress, type LookupOptions, lookup as dnsLookup } from 'node:dns';
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
  // IPv4-compatible ::a.b.c.d (first 12 bytes zero) — evaluate the embedded IPv4.
  // Loopback (::1) and unspecified (::) are already handled above.
  if (b.slice(0, 12).every(x => x === 0)) {
    return isBlockedIPv4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`);
  }
  // 6to4 2002:<ipv4>::/48 — evaluate the embedded IPv4 (bytes 2..5).
  if (b[0] === 0x20 && b[1] === 0x02) {
    return isBlockedIPv4(`${b[2]}.${b[3]}.${b[4]}.${b[5]}`);
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

/**
 * DNS lookup that validates every resolved address against the SSRF blocklist
 * and pins the connection to a validated address.
 *
 * Passed as the `lookup` option to node:http/https so the address that is
 * VALIDATED is exactly the address that is CONNECTED to. A plain `fetch()`
 * resolves DNS independently when it opens the socket, which leaves a DNS
 * rebinding time-of-check/time-of-use gap: a hostname can resolve to a public IP
 * during validation and to a private IP (e.g. 169.254.169.254) at connect time.
 * Pinning here closes that gap.
 */
function safeLookup(
  hostname: string,
  options: LookupOptions,
  callback: (
    err: NodeJS.ErrnoException | null,
    address: string | LookupAddress[],
    family?: number
  ) => void
): void {
  const wantsAll = options.all === true;
  const host = stripBrackets(hostname);

  if (isIP(host)) {
    if (isBlockedAddress(host)) {
      callback(new Error(`Refusing to connect to private/internal address ${host}`), '', 0);
      return;
    }
    const family = isIPv6(host) ? 6 : 4;
    callback(null, wantsAll ? [{ address: host, family }] : host, family);
    return;
  }

  dnsLookup(host, { all: true }, (err, addresses) => {
    if (err) {
      callback(err, '', 0);
      return;
    }
    const list: LookupAddress[] = Array.isArray(addresses) ? addresses : [];
    if (list.length === 0) {
      callback(new Error(`Could not resolve host: ${host}`), '', 0);
      return;
    }
    for (const entry of list) {
      if (isBlockedAddress(entry.address)) {
        callback(
          new Error(
            `Refusing to fetch ${host}: resolves to private/internal address ${entry.address}`
          ),
          '',
          0
        );
        return;
      }
    }
    if (wantsAll) {
      callback(null, list);
    } else {
      callback(null, list[0]!.address, list[0]!.family);
    }
  });
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

interface IHopResult {
  status: number;
  contentType: string | null;
  location: string | null;
  body: Buffer | null;
}

/**
 * Perform a single GET request, pinning DNS to a pre-validated address and
 * capping both response size and elapsed time. Redirect responses resolve with
 * their `location` (body discarded) so the caller can re-validate the next hop.
 */
function performRequest(
  url: URL,
  opts: { maxBytes: number; timeoutMs: number; headers?: Record<string, string> }
): Promise<IHopResult> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    let settled = false;
    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: stripBrackets(url.hostname),
        port: url.port !== '' ? Number(url.port) : isHttps ? 443 : 80,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: opts.headers ?? {},
        lookup: safeLookup,
      },
      res => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location ?? null;
        const contentType = res.headers['content-type'] ?? null;

        if (status >= 300 && status < 400 && location) {
          res.resume(); // discard a redirect's body
          finish(() => resolve({ status, contentType, location, body: null }));
          return;
        }

        // node:http does NOT auto-decompress (unlike fetch), so decode per
        // Content-Encoding. The size cap is applied to the DECOMPRESSED output to
        // bound memory even against a small but bomb-like compressed payload.
        const encoding = String(res.headers['content-encoding'] ?? '').toLowerCase();
        let stream: NodeJS.ReadableStream = res;
        if (encoding === 'gzip' || encoding === 'x-gzip') {
          stream = res.pipe(zlib.createGunzip());
        } else if (encoding === 'deflate') {
          stream = res.pipe(zlib.createInflate());
        } else if (encoding === 'br') {
          stream = res.pipe(zlib.createBrotliDecompress());
        }

        const chunks: Buffer[] = [];
        let total = 0;
        stream.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > opts.maxBytes) {
            req.destroy();
            finish(() =>
              reject(
                new Error(`Response exceeds the maximum allowed size of ${opts.maxBytes} bytes`)
              )
            );
            return;
          }
          chunks.push(chunk);
        });
        stream.on('end', () =>
          finish(() =>
            resolve({ status, contentType, location: null, body: Buffer.concat(chunks) })
          )
        );
        stream.on('error', e =>
          finish(() => reject(e instanceof Error ? e : new Error(String(e))))
        );
        // Surface transport errors too (e.g. socket reset before the decompressor sees data).
        res.on('error', e => finish(() => reject(e instanceof Error ? e : new Error(String(e)))));
      }
    );

    const timer = setTimeout(
      () => {
        req.destroy(new Error('Request timed out'));
      },
      Math.max(1, opts.timeoutMs)
    );
    timer.unref();

    req.on('error', e => finish(() => reject(e instanceof Error ? e : new Error(String(e)))));
    req.end();
  });
}

/**
 * SSRF-safe fetch: enforces an http(s)-only scheme, pins DNS to a validated
 * public address (so the validated IP is the connected IP — no rebinding TOCTOU),
 * follows redirects manually (re-validating each hop), and caps response size and
 * TOTAL elapsed time across all hops.
 */
export async function safeFetch(
  rawUrl: string,
  options: ISafeFetchOptions = {}
): Promise<ISafeFetchResult> {
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxRedirects = options.maxRedirects ?? 3;
  const deadline = Date.now() + timeoutMs;

  let current = parseSafeHttpUrl(rawUrl);

  for (let redirect = 0; redirect <= maxRedirects; redirect++) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new Error(`Timed out while fetching ${rawUrl}`);
    }

    const hop = await performRequest(current, {
      maxBytes,
      timeoutMs: remainingMs,
      ...(options.headers ? { headers: options.headers } : {}),
    });

    if (hop.location && hop.status >= 300 && hop.status < 400) {
      current = parseSafeHttpUrl(new URL(hop.location, current).toString());
      continue;
    }

    return {
      url: current.toString(),
      status: hop.status,
      contentType: hop.contentType,
      body: hop.body ?? Buffer.alloc(0),
    };
  }

  throw new Error(`Too many redirects while fetching ${rawUrl}`);
}
