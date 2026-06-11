/**
 * Tests for the ESM entry guard.
 *
 * Node realpath-resolves import.meta.url for the main module, but argv[1]
 * stays the literal invoked path. npm installs bins as symlinks
 * (node_modules/.bin/atproto-mcp -> ../atproto-mcp/dist/cli.js), so a naive
 * `import.meta.url === \`file://${process.argv[1]}\`` comparison is false and
 * `npx atproto-mcp` becomes a silent no-op.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isMainModule } from '../cli.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

describe('isMainModule', () => {
  let tempDir: string;
  let targetPath: string;
  let targetUrl: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'entry-guard-'));
    targetPath = join(tempDir, 'target.js');
    writeFileSync(targetPath, 'export {};\n');
    // What Node reports as import.meta.url for the main module: the
    // realpath-resolved file URL.
    targetUrl = pathToFileURL(realpathSync(targetPath)).href;
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns true when argv[1] is a symlink to the main module (npx scenario)', () => {
    const linkPath = join(tempDir, 'atproto-mcp');
    symlinkSync(targetPath, linkPath);

    expect(isMainModule(targetUrl, linkPath)).toBe(true);
  });

  it('returns true for direct invocation of the same path', () => {
    expect(isMainModule(targetUrl, targetPath)).toBe(true);
  });

  it('returns true for a path containing a space', () => {
    const spacedDir = join(tempDir, 'with space');
    mkdirSync(spacedDir);
    const spacedPath = join(spacedDir, 'spaced.js');
    writeFileSync(spacedPath, 'export {};\n');

    expect(isMainModule(pathToFileURL(realpathSync(spacedPath)).href, spacedPath)).toBe(true);
  });

  it('returns false when argv[1] is undefined', () => {
    expect(isMainModule(targetUrl, undefined)).toBe(false);
  });

  it('returns false (without throwing) when argv[1] does not exist', () => {
    expect(isMainModule(targetUrl, join(tempDir, 'does-not-exist.js'))).toBe(false);
  });

  it('returns false when argv[1] points at a different module', () => {
    const otherPath = join(tempDir, 'other.js');
    writeFileSync(otherPath, 'export {};\n');

    expect(isMainModule(targetUrl, otherPath)).toBe(false);
  });
});

describe('entry points invoked through a bin-style symlink', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'entry-guard-bin-'));
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('cli runs main() when invoked via symlink (--help prints usage)', async () => {
    const linkPath = join(tempDir, 'atproto-mcp');
    symlinkSync(join(REPO_ROOT, 'src', 'cli.ts'), linkPath);

    const { output, exitCode } = await runViaTsx(linkPath, ['--help']);

    expect(output).toContain('Usage: atproto-mcp');
    expect(exitCode).toBe(0);
  }, 30000);

  it('health check actually runs (does not fail open) when invoked via symlink', async () => {
    const linkPath = join(tempDir, 'health-check');
    symlinkSync(join(REPO_ROOT, 'src', 'health-check.ts'), linkPath);

    const { output, exitCode } = await runViaTsx(linkPath, []);

    expect(output).toContain('Health check passed');
    expect(exitCode).toBe(0);
  }, 30000);
});

/**
 * Run a TypeScript entry point through the tsx loader, the same way the
 * published bin is executed: node <symlink> [args].
 */
function runViaTsx(
  entryPath: string,
  args: string[]
): Promise<{ output: string; exitCode: number | null }> {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['--import', 'tsx', entryPath, ...args], {
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'error' },
    });

    let output = '';

    child.stdout?.on('data', data => {
      output += data.toString();
    });

    child.stderr?.on('data', data => {
      output += data.toString();
    });

    child.on('close', code => {
      resolve({ output, exitCode: code });
    });

    child.on('error', error => {
      output += String(error);
      resolve({ output, exitCode: -1 });
    });

    // Safety net: a buggy guard makes the cli exit immediately, but a fixed
    // cli without --help would keep running; kill after 20s regardless.
    setTimeout(() => {
      child.kill();
      resolve({ output, exitCode: null });
    }, 20000);
  });
}
