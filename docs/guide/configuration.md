# Configuration

This guide covers all configuration options for the AT Protocol MCP Server.

## Configuration Methods

The server can be configured through:

1. **Environment Variables** - Recommended for production
2. **Command Line Arguments** - Quick overrides
3. **Configuration Files** - Advanced customization
4. **MCP Client Configuration** - Client-specific settings

## Environment Variables

### Authentication

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `ATPROTO_IDENTIFIER` | Your AT Protocol handle or DID | No* | - |
| `ATPROTO_PASSWORD` | App password for authentication | No* | - |
| `ATPROTO_CLIENT_ID` | OAuth client ID | No* | - |
| `ATPROTO_CLIENT_SECRET` | OAuth client secret | No* | - |
| `ATPROTO_SERVICE` | AT Protocol service URL | No | `https://bsky.social` |

*Required only for authenticated operations

### Server Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode (`development`, `production`, `test`) | `production` |
| `LOG_LEVEL` | Logging level (`debug`, `info`, `warn`, `error`) | `info` |
| `SERVER_PORT` | Server port number | `3000` |
| `SERVER_HOST` | Server host address | `localhost` |
| `MCP_SERVER_NAME` | Server name for MCP protocol | `atproto-mcp` |

### Performance & Caching

| Variable | Description | Default |
|----------|-------------|---------|
| `CACHE_ENABLED` | Enable response caching | `true` |
| `CACHE_TTL` | Cache time-to-live in seconds | `300` |
| `CACHE_MAX_SIZE` | Maximum cache size in MB | `100` |
| `CONNECTION_POOL_SIZE` | HTTP connection pool size | `10` |
| `REQUEST_TIMEOUT` | Request timeout in milliseconds | `30000` |

### Rate Limiting

| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT_ENABLED` | Enable rate limiting | `true` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | `60000` |

### Security

| Variable | Description | Default |
|----------|-------------|---------|
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `*` |
| `TRUSTED_PROXIES` | Trusted proxy IPs (comma-separated) | - |
| `SECURITY_SECRET_KEY` | Secret key for encryption | Auto-generated |
| `OAUTH_MOCK_MODE` | Enable OAuth mock mode (dev only) | `false` |

### Monitoring & Observability

| Variable | Description | Default |
|----------|-------------|---------|
| `METRICS_ENABLED` | Enable Prometheus metrics | `true` |
| `METRICS_PORT` | Metrics endpoint port | `9090` |
| `HEALTH_CHECK_ENABLED` | Enable health check endpoint | `true` |
| `HEALTH_CHECK_PATH` | Health check endpoint path | `/health` |

## Command Line Arguments

Override environment variables with command line flags:

```bash
atproto-mcp [options]
```

### Available Options

```bash
--port <number>           Server port (default: 3000)
--host <string>           Server host (default: localhost)
--service <url>           AT Protocol service URL
--auth <method>           Authentication method: app-password|oauth
--log-level <level>       Log level: debug|info|warn|error
--no-cache                Disable caching
--no-rate-limit           Disable rate limiting
--no-metrics              Disable metrics collection
--help                    Show help message
--version                 Show version number
```

### Examples

```bash
# Start with custom port and debug logging
atproto-mcp --port 8080 --log-level debug

# Disable caching and rate limiting
atproto-mcp --no-cache --no-rate-limit

# Use custom AT Protocol service
atproto-mcp --service https://custom-pds.example.com

# Enable OAuth authentication
atproto-mcp --auth oauth
```

## Configuration Files

### Production Configuration

The server uses `config/production.json` for production settings:

```json
{
  "server": {
    "name": "atproto-mcp",
    "version": "0.1.0",
    "environment": "production"
  },
  "performance": {
    "caching": {
      "enabled": true,
      "ttl": 300,
      "maxSize": 100
    },
    "connectionPool": {
      "maxConnections": 10,
      "timeout": 30000
    }
  },
  "security": {
    "cors": {
      "enabled": true,
      "origins": ["*"]
    },
    "rateLimit": {
      "enabled": true,
      "maxRequests": 100,
      "windowMs": 60000
    }
  },
  "monitoring": {
    "metrics": {
      "enabled": true,
      "port": 9090
    },
    "healthCheck": {
      "enabled": true,
      "path": "/health"
    }
  }
}
```

### Custom Configuration

Create a custom configuration file:

```bash
# Create custom config
cp config/production.json config/custom.json

# Edit configuration
nano config/custom.json

# Use custom config
NODE_CONFIG=custom atproto-mcp
```

## MCP Client Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "atproto": {
      "command": "atproto-mcp",
      "args": ["--log-level", "info"],
      "env": {
        "ATPROTO_IDENTIFIER": "your-handle.bsky.social",
        "ATPROTO_PASSWORD": "your-app-password",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Other MCP Clients

Generic MCP client configuration:

```json
{
  "servers": [
    {
      "name": "atproto",
      "command": "atproto-mcp",
      "transport": "stdio",
      "environment": {
        "ATPROTO_IDENTIFIER": "your-handle.bsky.social",
        "ATPROTO_PASSWORD": "your-app-password"
      }
    }
  ]
}
```

## Environment File (.env)

For local development, create a `.env` file:

```bash
# Copy example file
cp .env.example .env
```

Example `.env` file:

```bash
# Authentication (optional)
ATPROTO_IDENTIFIER=your-handle.bsky.social
ATPROTO_PASSWORD=your-app-password
ATPROTO_SERVICE=https://bsky.social

# Server Configuration
NODE_ENV=development
LOG_LEVEL=debug
SERVER_PORT=3000

# Performance
CACHE_ENABLED=true
CACHE_TTL=300

# Security
CORS_ORIGINS=http://localhost:3000,http://localhost:8080

# Monitoring
METRICS_ENABLED=true
HEALTH_CHECK_ENABLED=true
```

## Docker Configuration

### Docker Compose

Configure via `docker-compose.yml`:

```yaml
version: '3.8'

services:
  atproto-mcp:
    image: atproto-mcp:latest
    ports:
      - "3000:3000"
    environment:
      - ATPROTO_IDENTIFIER=${ATPROTO_IDENTIFIER}
      - ATPROTO_PASSWORD=${ATPROTO_PASSWORD}
      - NODE_ENV=production
      - LOG_LEVEL=info
      - CACHE_ENABLED=true
      - METRICS_ENABLED=true
    volumes:
      - ./config:/app/config:ro
    restart: unless-stopped
```

### Docker Environment File

Create `.env` for Docker Compose:

```bash
ATPROTO_IDENTIFIER=your-handle.bsky.social
ATPROTO_PASSWORD=your-app-password
NODE_ENV=production
LOG_LEVEL=info
```

## Configuration Best Practices

### Development

```bash
# Enable debug logging
LOG_LEVEL=debug

# Disable caching for testing
CACHE_ENABLED=false

# Use mock OAuth
OAUTH_MOCK_MODE=true
```

### Production

```bash
# Use info or warn level
LOG_LEVEL=info

# Enable all performance features
CACHE_ENABLED=true
CONNECTION_POOL_SIZE=20

# Secure CORS
CORS_ORIGINS=https://yourdomain.com

# Enable monitoring
METRICS_ENABLED=true
HEALTH_CHECK_ENABLED=true
```

### Security Hardening

```bash
# Change default passwords
GRAFANA_ADMIN_PASSWORD=strong-random-password

# Restrict CORS
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Set trusted proxies
TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12

# Use strong secret key
SECURITY_SECRET_KEY=$(openssl rand -hex 32)
```

## Validation

Validate your configuration:

```bash
# Check configuration
atproto-mcp --help

# Test with dry run
atproto-mcp --log-level debug

# Verify environment variables
env | grep ATPROTO
```

## Troubleshooting

### Configuration Not Loading

```bash
# Check environment variables
echo $ATPROTO_IDENTIFIER

# Verify .env file
cat .env

# Check file permissions
ls -la .env
```

### Invalid Configuration

```bash
# Validate JSON config
cat config/production.json | jq .

# Check for syntax errors
node -c config/production.json
```

## Next Steps

- **[Authentication](./authentication.md)** - Set up authentication
- **[Deployment](./deployment.md)** - Deploy to production
- **[Troubleshooting](./troubleshooting.md)** - Common issues

---

**Previous**: [Installation](./installation.md) ← | **Next**: [Authentication](./authentication.md) →

