# Contributing to AT Protocol MCP Server

Thank you for your interest in contributing to the AT Protocol MCP Server! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ 
- pnpm (recommended) or npm
- Git
- Basic knowledge of TypeScript, AT Protocol, and MCP

### Development Setup
1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/atproto-mcp.git
   cd atproto-mcp
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Start the development server:
   ```bash
   pnpm run dev
   ```

## 📋 Development Workflow

### Branch Strategy
- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/feature-name` - Individual features
- `fix/bug-description` - Bug fixes
- `docs/documentation-update` - Documentation changes

### Making Changes
1. Create a new branch from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following our coding standards

3. Write or update tests for your changes

4. Run the test suite:
   ```bash
   pnpm test
   pnpm run lint
   pnpm run type-check
   ```

5. Commit your changes using conventional commits:
   ```bash
   git commit -m "feat: add new AT Protocol tool for user search"
   ```

6. Push to your fork and create a pull request

### Commit Message Format
We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## 🧪 Testing

### Running Tests
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run tests with coverage
pnpm run test:coverage

# Run tests with UI
pnpm run test:ui
```

### Writing Tests
- Write unit tests for all new functions and classes
- Write integration tests for MCP tools and AT Protocol operations
- Mock external dependencies (AT Protocol API calls)
- Use descriptive test names that explain the scenario
- Follow the AAA pattern (Arrange, Act, Assert)

Example test structure:
```typescript
describe('createPost tool', () => {
  it('should create a post with text content successfully', async () => {
    // Arrange
    const mockAgent = createMockAtpAgent();
    const tool = new CreatePostTool(mockAgent);
    
    // Act
    const result = await tool.execute({ text: 'Hello world!' });
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.data.uri).toBeDefined();
  });
});
```

## 📝 Code Style

### TypeScript Guidelines
- Use strict TypeScript configuration
- Provide explicit return types for public functions
- Use branded types for domain-specific identifiers
- Prefer `const` assertions for immutable data
- Use proper error handling with custom error classes

### Code Organization
- Organize code by feature/domain
- Use barrel exports for clean module interfaces
- Keep functions pure and side-effect free where possible
- Implement proper separation of concerns

### Naming Conventions
- Use PascalCase for interfaces (prefixed with `I`)
- Use PascalCase for types and enums
- Use camelCase for variables and functions
- Use UPPER_CASE for enum members
- Use descriptive names that explain purpose

## 🔧 Adding New Features

### MCP Tools
When adding new MCP tools:

1. Create the tool in `src/tools/`
2. Implement proper Zod schema validation
3. Add comprehensive error handling
4. Write unit and integration tests
5. Update documentation
6. Add examples to the docs site

### AT Protocol Integration
When adding AT Protocol features:

1. Use the official `@atproto/api` package
2. Implement proper authentication handling
3. Respect rate limits and implement backoff
4. Handle AT Protocol errors gracefully
5. Validate responses against expected schemas

## 📚 Documentation

### Code Documentation
- Use JSDoc comments for all public APIs
- Include parameter descriptions and examples
- Document error conditions and return types
- Keep documentation up-to-date with code changes

### User Documentation
- Update README.md for new features
- Add examples to the docs site
- Update API reference documentation
- Include troubleshooting information

## 🐛 Bug Reports

When reporting bugs:
1. Use the bug report template
2. Provide clear reproduction steps
3. Include environment information
4. Add relevant logs (remove sensitive data)
5. Describe expected vs actual behavior

## 💡 Feature Requests

When requesting features:
1. Use the feature request template
2. Explain the use case and problem
3. Provide implementation ideas if possible
4. Consider AT Protocol compatibility
5. Indicate priority and impact

## 🔍 Code Review Process

### For Contributors
- Ensure all tests pass
- Follow the coding standards
- Write clear commit messages
- Respond to review feedback promptly
- Keep pull requests focused and small

### For Reviewers
- Review for correctness and style
- Test the changes locally
- Provide constructive feedback
- Approve when ready for merge

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

## 🤝 Community

- Be respectful and inclusive
- Help others learn and grow
- Share knowledge and best practices
- Follow our Code of Conduct

## 📞 Getting Help

- Check existing issues and discussions
- Ask questions in GitHub Discussions
- Review the documentation
- Reach out to maintainers if needed

Thank you for contributing to the AT Protocol MCP Server! 🎉
