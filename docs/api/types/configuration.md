# Configuration Types

Server and authentication configuration type definitions.

## MCP Server Configuration

### IMcpServerConfig

```typescript
interface IMcpServerConfig {
  port: number;
  host: string;
  name: string;
  version: string;
  description: string;
  atproto: IAtpConfig;
}
```

**Description:** Main server configuration.

**Fields:**
- `port` - Server port number (default: 3000)
- `host` - Server host (default: "localhost")
- `name` - Server name
- `version` - Server version
- `description` - Server description
- `atproto` - AT Protocol configuration

**Example:**
```typescript
const config: IMcpServerConfig = {
  port: 3000,
  host: "0.0.0.0",
  name: "AT Protocol MCP Server",
  version: "1.0.0",
  description: "MCP server for AT Protocol",
  atproto: {
    service: "https://bsky.social",
    authMethod: "app-password"
  }
};
```

## AT Protocol Configuration

### IAtpConfig

```typescript
interface IAtpConfig {
  service: string;
  identifier?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  authMethod?: 'app-password' | 'oauth';
}
```

**Description:** AT Protocol connection and authentication configuration.

**Fields:**
- `service` - AT Protocol service URL (required)
- `identifier` - User handle or DID (for app password)
- `password` - App password (for app password auth)
- `clientId` - OAuth client ID (for OAuth)
- `clientSecret` - OAuth client secret (for OAuth)
- `redirectUri` - OAuth redirect URI (for OAuth)
- `authMethod` - Authentication method (optional for unauthenticated mode)

**Authentication Methods:**

#### App Password
```typescript
const config: IAtpConfig = {
  service: "https://bsky.social",
  identifier: "user.bsky.social",
  password: "app-password-here",
  authMethod: "app-password"
};
```

#### OAuth
```typescript
const config: IAtpConfig = {
  service: "https://bsky.social",
  clientId: "your-client-id",
  clientSecret: "your-client-secret",
  redirectUri: "https://your-app.com/callback",
  authMethod: "oauth"
};
```

#### Unauthenticated
```typescript
const config: IAtpConfig = {
  service: "https://bsky.social"
  // No authMethod - works for public data only
};
```

## Authentication Configuration

### IOAuthConfig

```typescript
interface IOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}
```

**Description:** OAuth-specific configuration.

**Fields:**
- `clientId` - OAuth client identifier
- `clientSecret` - OAuth client secret
- `redirectUri` - Callback URL after authorization
- `scope` - Requested OAuth scopes

**Example:**
```typescript
const oauthConfig: IOAuthConfig = {
  clientId: "your-client-id",
  clientSecret: "your-client-secret",
  redirectUri: "https://your-app.com/oauth/callback",
  scope: ["atproto", "transition:generic"]
};
```

### IAppPasswordConfig

```typescript
interface IAppPasswordConfig {
  identifier: string;
  password: string;
}
```

**Description:** App password authentication configuration.

**Fields:**
- `identifier` - User handle or DID
- `password` - App password (not main account password)

**Example:**
```typescript
const appPasswordConfig: IAppPasswordConfig = {
  identifier: "user.bsky.social",
  password: "xxxx-xxxx-xxxx-xxxx"
};
```

## Environment Variables

### Required for App Password

```bash
ATPROTO_SERVICE=https://bsky.social
ATPROTO_IDENTIFIER=your-handle.bsky.social
ATPROTO_PASSWORD=your-app-password
```

### Required for OAuth

```bash
ATPROTO_SERVICE=https://bsky.social
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_REDIRECT_URI=https://your-app.com/callback
```

### Optional

```bash
PORT=3000
HOST=localhost
LOG_LEVEL=info
NODE_ENV=production
```

## Configuration Loading

### From Environment

```typescript
import { loadConfig } from './config';

const config = loadConfig();
// Loads from environment variables
```

### From File

```typescript
import { readFileSync } from 'fs';

const configFile = readFileSync('config.json', 'utf-8');
const config: IMcpServerConfig = JSON.parse(configFile);
```

### Programmatic

```typescript
const config: IMcpServerConfig = {
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || 'localhost',
  name: 'My MCP Server',
  version: '1.0.0',
  description: 'Custom MCP server',
  atproto: {
    service: process.env.ATPROTO_SERVICE || 'https://bsky.social',
    identifier: process.env.ATPROTO_IDENTIFIER,
    password: process.env.ATPROTO_PASSWORD,
    authMethod: 'app-password'
  }
};
```

## Validation

### Configuration Validation

```typescript
function validateConfig(config: IMcpServerConfig): void {
  if (!config.atproto.service) {
    throw new Error('AT Protocol service URL is required');
  }

  if (config.atproto.authMethod === 'app-password') {
    if (!config.atproto.identifier || !config.atproto.password) {
      throw new Error('Identifier and password required for app password auth');
    }
  }

  if (config.atproto.authMethod === 'oauth') {
    if (!config.atproto.clientId || !config.atproto.clientSecret) {
      throw new Error('Client ID and secret required for OAuth');
    }
  }
}
```

## Best Practices

### Security
- Never commit credentials to version control
- Use environment variables for sensitive data
- Rotate app passwords regularly
- Use OAuth for production applications

### Configuration Management
- Validate configuration on startup
- Provide sensible defaults
- Document all configuration options
- Support multiple configuration sources

### Environment-Specific
- Use different configs for dev/staging/prod
- Override defaults with environment variables
- Validate required fields
- Log configuration (redact secrets)

## See Also

- [Core Types](./core.md)
- [Error Types](./errors.md)
- [Configuration Guide](../../guide/configuration.md)
- [Authentication Guide](../../guide/authentication.md)

