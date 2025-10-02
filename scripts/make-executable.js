#!/usr/bin/env node

/**
 * Make CLI executable on Unix-like systems
 * This script is a cross-platform replacement for `chmod +x`
 * On Windows, this is a no-op since executability is determined by file extension
 */

import { chmod } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isWindows = process.platform === 'win32';

async function makeExecutable() {
  if (isWindows) {
    console.log('Windows detected - skipping chmod (not needed)');
    return;
  }

  const cliPath = join(__dirname, '..', 'dist', 'cli.js');
  
  try {
    await chmod(cliPath, 0o755);
    console.log(`Made ${cliPath} executable`);
  } catch (error) {
    console.error(`Failed to make ${cliPath} executable:`, error.message);
    process.exit(1);
  }
}

makeExecutable();

