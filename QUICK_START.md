# Quick Start Guide

## For Windows Users 🪟

All commands work natively on Windows - no WSL or additional tools required!

### First Time Setup

```bash
# Clone the repository
git clone https://github.com/cameronrye/atproto-mcp.git
cd atproto-mcp

# Install dependencies
npm install

# See all available commands
npm run help

# Check your environment
npm run status
```

### Common Commands

```bash
# Development
npm run dev              # Start development server with hot reload
npm run build            # Build for production
npm run start            # Start production server

# Testing
npm test                 # Run tests
npm run test:coverage    # Run tests with coverage
npm run test:ui          # Run tests with UI

# Code Quality
npm run lint             # Check for linting errors
npm run lint:fix         # Fix linting errors automatically
npm run format           # Format code with Prettier
npm run type-check       # Check TypeScript types
npm run check            # Run ALL quality checks (lint + format + type-check + test)

# Cleanup
npm run clean            # Clean build artifacts
npm run clean:all        # Clean everything (including node_modules)

# Utilities
npm run help             # Show all available commands
npm run status           # Show project status and environment info
npm run ci               # Run full CI pipeline locally

# Dependencies
npm run deps:update      # Update all dependencies
npm run deps:audit       # Check for security vulnerabilities
```

## For macOS/Linux Users 🍎🐧

Use npm scripts (same as Windows):

```bash
npm run dev              # Start development
npm run build            # Build for production
npm test                 # Run tests
```

All commands work the same way on every platform!

## Quick Development Workflow

### 1. Start a New Feature

```bash
# Make sure you're up to date
git pull origin main

# Create a new branch
git checkout -b feature/my-feature

# Install dependencies (if needed)
npm install

# Start development server
npm run dev
```

### 2. Make Changes

Edit your code, and the development server will automatically reload.

### 3. Test Your Changes

```bash
# Run tests
npm test

# Check code quality
npm run check
```

### 4. Build and Verify

```bash
# Build for production
npm run build

# Test the production build
npm run start
```

### 5. Commit and Push

```bash
# Format and lint your code
npm run format
npm run lint:fix

# Run all quality checks
npm run check

# Commit your changes
git add .
git commit -m "feat: add my feature"

# Push to your fork
git push origin feature/my-feature
```

## Troubleshooting

### "Command not found" errors

If you see errors like "pnpm is not recognized":

- **For pnpm**: This project prefers pnpm, but npm works fine. Just use `npm` instead of `pnpm`.

### Check Your Environment

```bash
npm run status
```

This will show:
- Your Node.js version
- Available package managers
- Installed development tools
- Available scripts

### Clean Everything and Start Fresh

```bash
# Clean all generated files
npm run clean:all

# Reinstall dependencies
npm install

# Rebuild
npm run build
```

## Getting Help

```bash
# Show all available commands
npm run help

# Show project status
npm run status

# Check the documentation
# - README.md - Project overview
# - CONTRIBUTING.md - Development guidelines
# - CROSS_PLATFORM_IMPROVEMENTS.md - Build system details
```

## Common Tasks

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm test -- --watch

# Run tests with coverage report
npm run test:coverage

# Run tests with UI (interactive)
npm run test:ui
```

### Code Quality Checks

```bash
# Check everything (recommended before committing)
npm run check

# Individual checks
npm run lint              # ESLint
npm run format:check      # Prettier (check only)
npm run type-check        # TypeScript

# Auto-fix issues
npm run lint:fix          # Fix ESLint issues
npm run format            # Format with Prettier
```

### Building Documentation

```bash
# Start documentation dev server
npm run docs:dev

# Build documentation
npm run docs:build

# Preview built documentation
npm run docs:preview
```

### Dependency Management

```bash
# Update all dependencies
npm run deps:update

# Check for security vulnerabilities
npm run deps:audit

# Fix vulnerabilities (if possible)
npm audit fix
```

## CI/CD

### Run CI Pipeline Locally

Before pushing, you can run the same checks that CI will run:

```bash
npm run ci
```

This will:
1. Install dependencies
2. Run linting
3. Check code formatting
4. Run type checking
5. Run all tests
6. Build for production

If this passes, your PR should pass CI checks.

## Platform-Specific Notes

### Windows
- ✅ All npm scripts work natively
- ✅ No need for WSL or Git Bash
- ✅ Works in cmd.exe, PowerShell, and Windows Terminal

### macOS
- ✅ All npm scripts work
- ✅ Same commands as Windows and Linux

### Linux
- ✅ All npm scripts work
- ✅ Same commands as Windows and macOS

## Next Steps

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development guidelines
2. Check [README.md](README.md) for project overview and features
3. Review [CROSS_PLATFORM_IMPROVEMENTS.md](CROSS_PLATFORM_IMPROVEMENTS.md) for build system details
4. Start coding! 🚀

