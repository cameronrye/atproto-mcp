# Troubleshooting

Common issues and solutions for the AT Protocol MCP Server.

## Installation Issues

### Node.js Version Error

**Problem**: Error about Node.js version being too old

```
Error: The engine "node" is incompatible with this module
```

**Solution**:
```bash
# Check current version
node --version

# Install Node.js 20+ using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Verify installation
node --version  # Should show v20.x.x
```

### Permission Denied (Global Install)

**Problem**: Permission errors when installing globally

```
EACCES: permission denied
```

**Solution**:
```bash
# Option 1: Use sudo (not recommended)
sudo npm install -g atproto-mcp

# Option 2: Configure npm to install globally without sudo (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g atproto-mcp
```

### Build Errors

**Problem**: Errors during build from source

```
Error: Cannot find module 'typescript'
```

**Solution**:
```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear npm cache
npm cache clean --force

# Try with different package manager
pnpm install
```

## Authentication Issues

### Authentication Failed

**Problem**: "Authentication failed" error when starting server

**Checklist**:
```bash
# 1. Verify credentials are set
echo $ATPROTO_IDENTIFIER
echo $ATPROTO_PASSWORD

# 2. Check for typos or extra spaces
# Remove quotes if present
export ATPROTO_IDENTIFIER=your-handle.bsky.social
export ATPROTO_PASSWORD=your-app-password

# 3. Verify service URL
echo $ATPROTO_SERVICE  # Should be https://bsky.social

# 4. Test with debug logging
atproto-mcp --log-level debug
```

### Invalid App Password

**Problem**: "Invalid password" error

**Solutions**:
1. **Verify you're using an app password**, not your main account password
2. **Generate a new app password**:
   - Go to Bluesky Settings → App Passwords
   - Create new password
   - Copy and use immediately
3. **Check for revoked passwords** in Bluesky settings
4. **Ensure no extra characters** (spaces, quotes, newlines)

### Session Expired

**Problem**: "Session expired" error during operation

**Solution**:
```bash
# Restart the server to create a new session
# The server will automatically re-authenticate
atproto-mcp
```

## Connection Issues

### Port Already in Use

**Problem**: "Port 3000 is already in use"

**Solution**:
```bash
# Option 1: Use a different port
atproto-mcp --port 8080

# Option 2: Find and kill the process using port 3000
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Cannot Connect to AT Protocol Service

**Problem**: Network errors or timeouts

**Checklist**:
```bash
# 1. Check internet connectivity
ping bsky.social

# 2. Verify service URL
curl https://bsky.social/xrpc/_health

# 3. Check for proxy settings
echo $HTTP_PROXY
echo $HTTPS_PROXY

# 4. Test with custom service URL
atproto-mcp --service https://bsky.social

# 5. Check firewall settings
# Ensure outbound HTTPS (443) is allowed
```

### MCP Client Can't Connect

**Problem**: LLM client can't connect to MCP server

**Solutions**:
```bash
# 1. Verify server is running
ps aux | grep atproto-mcp

# 2. Check server logs
atproto-mcp --log-level debug

# 3. Verify client configuration
# For Claude Desktop:
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json

# 4. Test server manually
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | atproto-mcp
```

## Rate Limiting Issues

### Rate Limit Exceeded

**Problem**: "Rate limit exceeded" errors

**Solutions**:
```bash
# 1. Wait for rate limit window to reset (5 minutes)

# 2. Reduce request frequency
# Implement delays between requests

# 3. Enable caching
export CACHE_ENABLED=true
export CACHE_TTL=300

# 4. Check rate limit headers in logs
atproto-mcp --log-level debug
```

### Too Many Requests

**Problem**: Hitting rate limits frequently

**Solutions**:
1. **Implement exponential backoff** in your application
2. **Cache responses** when possible
3. **Batch operations** instead of individual requests
4. **Monitor rate limit headers** and adjust accordingly

## Docker Issues

### Container Won't Start

**Problem**: Docker container exits immediately

**Solution**:
```bash
# Check container logs
docker logs atproto-mcp

# Common issues:
# 1. Missing environment variables
docker run -e ATPROTO_IDENTIFIER=... -e ATPROTO_PASSWORD=... atproto-mcp

# 2. Port conflict
docker run -p 8080:3000 atproto-mcp

# 3. Volume permission issues
docker run -v $(pwd)/config:/app/config:ro atproto-mcp
```

### Docker Compose Fails

**Problem**: docker-compose up fails

**Solution**:
```bash
# 1. Check .env file exists
ls -la .env

# 2. Validate docker-compose.yml
docker-compose config

# 3. Rebuild containers
docker-compose down
docker-compose up -d --build

# 4. Check logs
docker-compose logs -f atproto-mcp
```

### Cannot Access Container

**Problem**: Can't access services in Docker container

**Solution**:
```bash
# 1. Check container is running
docker ps

# 2. Verify port mapping
docker port atproto-mcp

# 3. Test from inside container
docker exec -it atproto-mcp sh
curl http://localhost:3000/health

# 4. Check network settings
docker network inspect bridge
```

## Tool Execution Issues

### Tool Not Found

**Problem**: "Method not found" error when calling tool

**Solution**:
```bash
# 1. List available tools
# Through LLM client: "What tools are available?"

# 2. Check tool name spelling
# Tool names use snake_case: create_post, not createPost

# 3. Verify authentication for private tools
# Some tools require authentication

# 4. Check server logs
atproto-mcp --log-level debug
```

### Invalid Parameters

**Problem**: "Invalid params" error

**Solution**:
```bash
# 1. Check parameter requirements
# Through LLM client: "What parameters does create_post need?"

# 2. Validate parameter types
# text: string, limit: number, etc.

# 3. Check parameter constraints
# Post text: max 300 characters
# Limit: 1-100

# 4. Review error message for details
# Error message includes field name and constraint
```

### Tool Execution Timeout

**Problem**: Tool execution times out

**Solution**:
```bash
# 1. Increase timeout
export REQUEST_TIMEOUT=60000  # 60 seconds

# 2. Check network connectivity
ping bsky.social

# 3. Verify AT Protocol service status
curl https://bsky.social/xrpc/_health

# 4. Try again later
# Service might be experiencing issues
```

## Resource Issues

### Resource Not Available

**Problem**: "Resource not available" error

**Solution**:
```bash
# 1. Verify authentication
# Resources require authentication
export ATPROTO_IDENTIFIER=...
export ATPROTO_PASSWORD=...

# 2. Check resource URI
# Correct format: atproto://timeline

# 3. List available resources
# Through LLM client: "What resources are available?"
```

### Resource Read Failed

**Problem**: Error reading resource content

**Solution**:
```bash
# 1. Check authentication status
atproto-mcp --log-level debug

# 2. Verify session is active
# Restart server if session expired

# 3. Check AT Protocol service status
curl https://bsky.social/xrpc/_health
```

## Performance Issues

### Slow Response Times

**Problem**: Server responds slowly

**Solutions**:
```bash
# 1. Enable caching
export CACHE_ENABLED=true
export CACHE_TTL=300

# 2. Increase connection pool
export CONNECTION_POOL_SIZE=20

# 3. Check system resources
top  # Check CPU and memory usage

# 4. Monitor network latency
ping bsky.social
```

### High Memory Usage

**Problem**: Server using too much memory

**Solutions**:
```bash
# 1. Reduce cache size
export CACHE_MAX_SIZE=50  # MB

# 2. Limit connection pool
export CONNECTION_POOL_SIZE=5

# 3. Restart server periodically
# Implement health checks and auto-restart

# 4. Check for memory leaks
# Monitor memory usage over time
```

## Configuration Issues

### Environment Variables Not Loading

**Problem**: Environment variables not being read

**Solution**:
```bash
# 1. Verify .env file location
ls -la .env

# 2. Check file permissions
chmod 600 .env

# 3. Verify variable names
# Use ATPROTO_IDENTIFIER, not ATPROTO_USERNAME

# 4. Restart server after changes
atproto-mcp
```

### Configuration File Not Found

**Problem**: "Configuration file not found" error

**Solution**:
```bash
# 1. Check config directory
ls -la config/

# 2. Copy example config
cp config/production.json.example config/production.json

# 3. Verify NODE_ENV
echo $NODE_ENV

# 4. Use default configuration
# Server works without custom config
```

## Debugging Tips

### Enable Debug Logging

```bash
# Maximum verbosity
LOG_LEVEL=debug atproto-mcp

# Or via environment variable
export LOG_LEVEL=debug
atproto-mcp
```

### Check Server Health

```bash
# For Docker deployments
curl http://localhost:3000/health

# Expected response:
# {"status":"healthy","timestamp":"...","version":"0.1.0"}
```

### Validate Configuration

```bash
# Check all environment variables
env | grep ATPROTO

# Test configuration
atproto-mcp --help
```

### Test Individual Components

```bash
# Test authentication
atproto-mcp --log-level debug

# Test specific tool
echo '{"method":"tools/call","params":{"name":"search_posts","arguments":{"q":"test"}}}' | atproto-mcp
```

## Getting Help

If you're still experiencing issues:

1. **Search existing issues**: [GitHub Issues](https://github.com/cameronrye/atproto-mcp/issues)
2. **Check discussions**: [GitHub Discussions](https://github.com/cameronrye/atproto-mcp/discussions)
3. **Review documentation**: [Full Documentation](https://cameronrye.github.io/atproto-mcp)
4. **Create an issue**: Include:
   - Server version (`atproto-mcp --version`)
   - Node.js version (`node --version`)
   - Operating system
   - Error messages (sanitize credentials!)
   - Steps to reproduce
   - Relevant logs

## Next Steps

- **[Error Handling](./error-handling.md)** - Handle errors properly
- **[Deployment](./deployment.md)** - Deploy to production
- **[Contributing](../contributing.md)** - Report bugs or contribute fixes

---

**Previous**: [Error Handling](./error-handling.md) ← | **Next**: [Deployment](./deployment.md) →

