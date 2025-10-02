#!/usr/bin/env node

/**
 * Clean all generated files including node_modules
 * Cross-platform replacement for `rm -rf` commands
 */

import chalk from 'chalk';
import { rimraf } from 'rimraf';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = join(__dirname, '..');

// Directories and files to clean
const itemsToClean = [
  'node_modules',
  '.pnpm-store',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'dist',
  'coverage',
  '.vitest',
  '.turbo'
];

async function cleanAll() {
  console.log(chalk.cyan('\n🧹 Cleaning all generated files...\n'));

  let cleaned = 0;
  let skipped = 0;

  for (const item of itemsToClean) {
    const itemPath = join(rootDir, item);
    
    if (existsSync(itemPath)) {
      try {
        console.log(chalk.yellow(`  Removing ${item}...`));
        await rimraf(itemPath);
        cleaned++;
        console.log(chalk.green(`  ✓ Removed ${item}`));
      } catch (error) {
        console.error(chalk.red(`  ✗ Failed to remove ${item}:`), error.message);
      }
    } else {
      skipped++;
      console.log(chalk.gray(`  ○ Skipped ${item} (not found)`));
    }
  }

  console.log(chalk.cyan(`\n✨ Cleanup complete!`));
  console.log(chalk.gray(`   Removed: ${cleaned} items`));
  console.log(chalk.gray(`   Skipped: ${skipped} items (not found)\n`));

  if (cleaned > 0) {
    console.log(chalk.yellow('💡 Next steps:'));
    console.log(chalk.gray(`   Run ${chalk.cyan('npm install')} or ${chalk.cyan('pnpm install')} to reinstall dependencies\n`));
  }
}

cleanAll().catch(error => {
  console.error(chalk.red('\n❌ Error during cleanup:'), error);
  process.exit(1);
});

