# GitHub Workflows

This directory contains GitHub Actions workflows for the AT Protocol MCP Server
project.

## Workflows

### 🔄 CI (`ci.yml`)

**Trigger**: Push/PR to `main` or `develop` branches

**Purpose**: Continuous integration testing and validation

- Runs tests on Node.js 20, 21, 22
- Type checking with TypeScript
- Linting and formatting checks
- Code coverage reporting (uploaded to Codecov on Node.js 20)
- Dependency security audit (`pnpm audit --prod --audit-level=high`)
- Build verification (build job uploads the `dist/` artifact)

### 🌐 Integration Tests (`integration-tests.yml`)

**Trigger**:

- Push/PR to `main` or `develop` branches
- Scheduled daily at 2 AM UTC (`cron: '0 2 * * *'`)
- Manual trigger via `workflow_dispatch` (with a `test_mode` input:
  `unauthenticated`, `authenticated`, or `all`)

**Purpose**: Run the real AT Protocol integration tests against live
infrastructure

- **Unauthenticated job**: runs `pnpm run test:integration` with
  `RUN_INTEGRATION_TESTS=true`; exercises public endpoints only (effectively
  `get_user_profile`)
- **Authenticated job**: runs `pnpm run test:integration:auth` on a schedule or
  manual dispatch using `BSKY_TEST_HANDLE` / `BSKY_TEST_PASSWORD` secrets to
  populate `.env.test`
- Uploads test results as artifacts

See
[`src/__tests__/INTEGRATION_TESTS.md`](../../src/__tests__/INTEGRATION_TESTS.md)
for details.

### Release (`release.yml`)

**Trigger**: Push of version tags (e.g., `v0.2.1`)

**Purpose**: Automated release process

- Runs full test suite
- Builds the package
- Validates package contents
- Creates GitHub release with changelog
- Publishes to npm with provenance
- Deploys documentation to GitHub Pages

**Usage**:

```bash
# Create and push a version tag
git tag v0.2.1
git push origin v0.2.1
```

### Documentation (`docs.yml`)

**Trigger**:

- Push to `main` branch (when docs change)
- Manual trigger via workflow_dispatch

**Purpose**: Deploy documentation to GitHub Pages

- Builds VitePress documentation
- Deploys to GitHub Pages
- Updates automatically on documentation changes

### Manual Publish (`publish.yml`)

**Trigger**: Manual workflow dispatch

**Purpose**: Manual npm publishing for hotfixes or special releases

- Allows custom version and npm tag
- Supports dry-run mode
- Creates git tags for stable releases
- Includes all quality checks

**Usage**:

1. Go to Actions tab in GitHub
2. Select "Manual Publish" workflow
3. Click "Run workflow"
4. Fill in:
   - Version (e.g., `0.2.2`, `0.3.0-beta.1`)
   - npm tag (`latest`, `beta`, `alpha`, `next`)
   - Dry run option (recommended first)

## Required Secrets

Configure these secrets in your GitHub repository settings:

### `NPM_TOKEN`

- **Purpose**: Publish packages to npm
- **Type**: npm automation token
- **Setup**:
  1. Go to npmjs.com → Account → Access Tokens
  2. Create "Automation" token
  3. Add to GitHub Secrets

### `CODECOV_TOKEN` (Optional)

- **Purpose**: Upload code coverage reports
- **Setup**:
  1. Go to codecov.io
  2. Connect your repository
  3. Copy the token
  4. Add to GitHub Secrets

## GitHub Pages Setup

1. Go to repository Settings → Pages
2. Set Source to "GitHub Actions"
3. The documentation will be available at:
   `https://cameronrye.github.io/atproto-mcp/`

## Release Process

### Automated Release (Recommended)

1. Update version in `package.json`
2. Commit changes: `git commit -m "chore: bump version to 0.2.1"`
3. Create and push tag: `git tag v0.2.1 && git push origin v0.2.1`
4. GitHub Actions will handle the rest

### Manual Release (For hotfixes)

1. Use the "Manual Publish" workflow
2. Start with dry-run to verify
3. Run actual publish if dry-run succeeds

## Workflow Features

### Security

- npm provenance for package authenticity
- Dependency vulnerability audit via `pnpm audit` (production dependencies,
  `--audit-level=high`)
- Secure token handling

### Quality Assurance

- Multi-version Node.js testing
- TypeScript strict checking
- ESLint and Prettier validation
- Test coverage reporting
- Package content verification

### Automation

- Automatic changelog generation
- Version validation
- Documentation deployment
- Release artifact creation
- npm tag management

## Troubleshooting

### Failed npm publish

- Check if version already exists on npm
- Verify `NPM_TOKEN` secret is valid
- Ensure package.json version matches git tag

### Documentation build fails

- Check for broken links in markdown files
- Verify VitePress configuration
- Ensure all referenced files exist

### CI failures

- Check Node.js version compatibility
- Verify all tests pass locally
- Review linting and formatting issues
