# Contributing

Thank you for your interest in contributing to the AT Protocol MCP Server!

This document provides guidelines and information for contributors. For detailed contribution guidelines, see [CONTRIBUTING.md](../CONTRIBUTING.md) in the repository root.

## Quick Start

### 1. Fork and Clone

```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/atproto-mcp.git
cd atproto-mcp
```

### 2. Install Dependencies

```bash
# Using pnpm (recommended)
pnpm install

# Or using npm
npm install
```

### 3. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

### 4. Make Changes

- Follow the coding standards
- Write tests for new features
- Update documentation

### 5. Test Your Changes

```bash
# Run tests
pnpm test

# Run linter
pnpm run lint

# Check types
pnpm run type-check

# Format code
pnpm run format
```

### 6. Commit and Push

```bash
# Commit with conventional commit message
git commit -m "feat: add new feature"

# Push to your fork
git push origin feature/your-feature-name
```

### 7. Create Pull Request

- Go to GitHub and create a pull request
- Fill out the pull request template
- Wait for review and address feedback

## Development Workflow

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new AT Protocol tool
fix: resolve authentication issue
docs: update API documentation
style: format code with prettier
refactor: simplify error handling
test: add tests for search tool
chore: update dependencies
```

## What to Contribute

### Good First Issues

Look for issues labeled `good first issue`:
- Documentation improvements
- Test coverage
- Bug fixes
- Code examples

### Feature Requests

Before implementing a new feature:
1. Check existing issues and discussions
2. Create a feature request issue
3. Discuss the approach
4. Get approval from maintainers
5. Implement and submit PR

### Bug Reports

When reporting bugs:
1. Use the bug report template
2. Provide clear reproduction steps
3. Include environment information
4. Add relevant logs (sanitize credentials!)
5. Describe expected vs actual behavior

## Code Standards

### TypeScript

- Use strict TypeScript configuration
- Provide explicit return types
- Use proper error handling
- Follow existing patterns

### Testing

- Write unit tests for all new functions
- Write integration tests for tools
- Aim for >80% code coverage
- Use descriptive test names

### Documentation

- Update README for new features
- Add JSDoc comments for public APIs
- Include code examples
- Update API reference

## Testing

### Running Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test --watch

# Coverage
pnpm run test:coverage

# UI mode
pnpm run test:ui
```

### Writing Tests

```typescript
describe('createPost tool', () => {
  it('should create a post successfully', async () => {
    // Arrange
    const mockAgent = createMockAtpAgent();
    const tool = new CreatePostTool(mockAgent);
    
    // Act
    const result = await tool.execute({ text: 'Hello!' });
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.data.uri).toBeDefined();
  });
});
```

## Documentation

### Types of Documentation

1. **Code Documentation** - JSDoc comments
2. **User Documentation** - Guides and tutorials
3. **API Documentation** - Tool and resource reference
4. **Examples** - Working code examples

### Documentation Site

The documentation site uses VitePress:

```bash
# Start dev server
pnpm run docs:dev

# Build documentation
pnpm run docs:build

# Preview build
pnpm run docs:preview
```

## Code Review

### For Contributors

- Ensure all tests pass
- Follow coding standards
- Write clear commit messages
- Respond to feedback promptly
- Keep PRs focused and small

### For Reviewers

- Review for correctness and style
- Test changes locally
- Provide constructive feedback
- Approve when ready

## Community

### Code of Conduct

- Be respectful and inclusive
- Help others learn and grow
- Share knowledge and best practices
- Follow our Code of Conduct

### Communication

- **Issues**: Bug reports and feature requests
- **Discussions**: Questions and ideas
- **Pull Requests**: Code contributions
- **Email**: Security issues only

## Resources

- [Full Contributing Guide](../CONTRIBUTING.md)
- [Code of Conduct](../CODE_OF_CONDUCT.md)
- [Security Policy](../SECURITY.md)
- [Development Setup](../README.md#development)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to the AT Protocol MCP Server! 🎉

