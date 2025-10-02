#!/usr/bin/env node

/**
 * Display project status and environment information
 * Cross-platform replacement for the Makefile status target
 */

import chalk from 'chalk';
import { execSync } from 'child_process';
import commandExists from 'command-exists';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper to safely execute commands
function getVersion(command) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return chalk.red('Not installed');
  }
}

// Helper to check if a command exists
async function checkCommand(command) {
  try {
    await commandExists(command);
    return true;
  } catch {
    return false;
  }
}

async function showStatus() {
  // Read package.json
  const packageJsonPath = join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

  console.log(chalk.cyan.bold('\n📊 Project Status\n'));

  // Project Information
  console.log(chalk.yellow('Project:'));
  console.log(`  Name:        ${chalk.cyan(packageJson.name)}`);
  console.log(`  Version:     ${chalk.cyan(packageJson.version)}`);
  console.log(`  Description: ${packageJson.description}`);

  // Environment Information
  console.log(chalk.yellow('\nEnvironment:'));
  console.log(`  Platform:    ${chalk.cyan(process.platform)}`);
  console.log(`  Architecture: ${chalk.cyan(process.arch)}`);
  console.log(`  Node.js:     ${chalk.cyan(process.version)}`);

  // Package Managers
  console.log(chalk.yellow('\nPackage Managers:'));
  const pnpmInstalled = await checkCommand('pnpm');
  const npmInstalled = await checkCommand('npm');
  const yarnInstalled = await checkCommand('yarn');

  if (pnpmInstalled) {
    console.log(`  pnpm:        ${chalk.green(getVersion('pnpm --version'))} ${chalk.green('✓')}`);
  } else {
    console.log(`  pnpm:        ${chalk.red('Not installed')}`);
  }

  if (npmInstalled) {
    console.log(`  npm:         ${chalk.green(getVersion('npm --version'))} ${chalk.green('✓')}`);
  } else {
    console.log(`  npm:         ${chalk.red('Not installed')}`);
  }

  if (yarnInstalled) {
    console.log(`  yarn:        ${chalk.green(getVersion('yarn --version'))} ${chalk.green('✓')}`);
  } else {
    console.log(`  yarn:        ${chalk.gray('Not installed')}`);
  }

  // Development Tools
  console.log(chalk.yellow('\nDevelopment Tools:'));
  
  const gitInstalled = await checkCommand('git');
  if (gitInstalled) {
    console.log(`  Git:         ${chalk.green(getVersion('git --version'))} ${chalk.green('✓')}`);
  } else {
    console.log(`  Git:         ${chalk.red('Not installed')}`);
  }

  const dockerInstalled = await checkCommand('docker');
  if (dockerInstalled) {
    console.log(`  Docker:      ${chalk.green(getVersion('docker --version'))} ${chalk.green('✓')}`);
  } else {
    console.log(`  Docker:      ${chalk.gray('Not installed (optional)')}`);
  }

  // Available Scripts
  console.log(chalk.yellow('\nAvailable Scripts:'));
  const mainScripts = ['dev', 'build', 'test', 'lint', 'format', 'check', 'clean'];
  
  for (const script of mainScripts) {
    if (packageJson.scripts[script]) {
      console.log(`  ${chalk.cyan(script.padEnd(12))} ${chalk.gray(packageJson.scripts[script])}`);
    }
  }

  console.log(chalk.gray(`\n  ... and ${Object.keys(packageJson.scripts).length - mainScripts.length} more`));
  console.log(chalk.gray(`  Run ${chalk.cyan('npm run help')} to see all available scripts\n`));

  // Recommendations
  if (!pnpmInstalled && !npmInstalled) {
    console.log(chalk.yellow('⚠️  Recommendations:'));
    console.log(chalk.red('  • Install a package manager (npm or pnpm)'));
  } else if (!pnpmInstalled) {
    console.log(chalk.yellow('💡 Tip:'));
    console.log(`  • This project uses pnpm. Install it with: ${chalk.cyan('npm install -g pnpm')}`);
  }

  if (!gitInstalled) {
    console.log(chalk.yellow('⚠️  Warning:'));
    console.log(chalk.red('  • Git is not installed. Version control features will not work.'));
  }

  console.log();
}

showStatus();

