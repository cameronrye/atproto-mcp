#!/usr/bin/env node

/**
 * Display help information about available npm scripts
 * Cross-platform replacement for the Makefile help target
 */

import chalk from 'chalk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json to get available scripts
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

console.log(chalk.cyan.bold('\n📦 AT Protocol MCP Server - Build System\n'));

console.log(chalk.yellow('Usage:'));
console.log(`  ${chalk.cyan('npm run <script>')} or ${chalk.cyan('pnpm <script>')}\n`);

// Group scripts by category
const scriptGroups = {
  'Development': ['dev', 'build', 'start', 'clean', 'clean:all'],
  'Testing & Quality': ['test', 'test:coverage', 'test:ui', 'lint', 'lint:fix', 'format', 'format:check', 'type-check', 'check'],
  'Documentation': ['docs:dev', 'docs:build', 'docs:preview'],
  'Utility': ['help', 'status', 'prepare', 'prepublishOnly'],
  'Dependencies': ['deps:update', 'deps:audit'],
  'CI/CD': ['ci']
};

const scriptDescriptions = {
  // Development
  'dev': 'Start development server with hot reload',
  'build': 'Build the project for production',
  'start': 'Start the production server',
  'clean': 'Clean build artifacts',
  'clean:all': 'Clean all generated files including node_modules',
  
  // Testing & Quality
  'test': 'Run all tests',
  'test:coverage': 'Run tests with coverage report',
  'test:ui': 'Run tests with UI interface',
  'lint': 'Run ESLint',
  'lint:fix': 'Run ESLint with auto-fix',
  'format': 'Format code with Prettier',
  'format:check': 'Check code formatting',
  'type-check': 'Run TypeScript type checking',
  'check': 'Run all quality checks (lint, format, type-check, test)',
  
  // Documentation
  'docs:dev': 'Start documentation development server',
  'docs:build': 'Build documentation for production',
  'docs:preview': 'Preview built documentation',
  
  // Utility
  'help': 'Display this help message',
  'status': 'Show project status and available tools',
  'prepare': 'Prepare development environment (install git hooks)',
  'prepublishOnly': 'Run before publishing to npm',
  
  // Dependencies
  'deps:update': 'Update all dependencies',
  'deps:audit': 'Audit dependencies for security issues',
  
  // CI/CD
  'ci': 'Run CI pipeline locally (install, check, build)'
};

// Display scripts by group
for (const [group, scripts] of Object.entries(scriptGroups)) {
  console.log(chalk.yellow(`\n${group}:`));
  
  for (const script of scripts) {
    if (packageJson.scripts[script]) {
      const description = scriptDescriptions[script] || 'No description';
      console.log(`  ${chalk.cyan(script.padEnd(20))} ${description}`);
    }
  }
}

console.log(chalk.yellow('\n\nExamples:'));
console.log(`  ${chalk.cyan('npm run dev')}          Start development server`);
console.log(`  ${chalk.cyan('npm run build')}        Build for production`);
console.log(`  ${chalk.cyan('npm test')}             Run tests`);
console.log(`  ${chalk.cyan('npm run check')}        Run all quality checks`);
console.log(`  ${chalk.cyan('npm run ci')}           Run full CI pipeline locally`);

console.log(chalk.yellow('\n\nPackage Manager:'));
console.log(`  This project uses ${chalk.cyan('pnpm')} by default, but ${chalk.cyan('npm')} and ${chalk.cyan('yarn')} also work.`);
console.log(`  To install pnpm: ${chalk.cyan('npm install -g pnpm')}\n`);

