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

- `port` - Reserved. The server uses the stdio transport and binds no port; this
  value is accepted but ignored.
- `host` - Reserved. Accepted but ignored under the stdio transport.
- `name` - Server name
- `version` - Server version
- `description` - Server description
- `atproto` - AT Protocol configuration

::: tip stdio transport

This server communicates over stdio (`StdioServerTransport`). `port` and `host`
are kept on the config for forward compatibility but are not used — there is no
HTTP listener.

:::

**Example:**

```typescript
const config: IMcpServerConfig = {
  port: 3000, // reserved/ignored under stdio
  host: 'localhost', // reserved/ignored under stdio
  name: 'AT Protocol MCP Server',
  version: '0.2.1',
  description: 'MCP server for AT Protocol',
  atproto: {
    service: 'https://bsky.social',
    authMethod: 'app-password',
  },
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
  service: 'https://bsky.social',
  identifier: 'user.bsky.social',
  password: 'app-password-here',
  authMethod: 'app-password',
};
```

#### OAuth (experimental)

```typescript
const config: IAtpConfig = {
  service: 'https://bsky.social',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'https://your-app.com/callback',
  authMethod: 'oauth',
};
```

::: warning Experimental

OAuth is experimental. `start_oauth_flow` only builds a heuristic PKCE URL, and
the callback-exchange tools are not implemented, so the OAuth path is currently
a dead end. Use app passwords for working authentication. See
[Experimental & Roadmap](../../guide/experimental.md).

:::

#### Unauthenticated

```typescript
const config: IAtpConfig = {
  service: 'https://bsky.social',
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
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'https://your-app.com/oauth/callback',
  scope: ['atproto', 'transition:generic'],
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
  identifier: 'user.bsky.social',
  password: 'xxxx-xxxx-xxxx-xxxx',
};
```

## Environment Variables

### Required for App Password

```bash
ATPROTO_SERVICE=https://bsky.social
ATPROTO_IDENTIFIER=your-handle.bsky.social
ATPROTO_PASSWORD=your-app-password
```

### Required for OAuth (experimental)

```bash
ATPROTO_SERVICE=https://bsky.social
ATPROTO_CLIENT_ID=your-client-id
ATPROTO_CLIENT_SECRET=your-client-secret
ATPROTO_AUTH_METHOD=oauth
```

### Optional

```bash
MCP_SERVER_NAME=AT Protocol MCP Server
LOG_LEVEL=info
```

::: tip Recognized variables

The server reads only the `MCP_SERVER_*` and `ATPROTO_*` variables documented in
the [Configuration Guide](../../guide/configuration.md), plus `LOG_LEVEL`.
`MCP_SERVER_PORT`/`MCP_SERVER_HOST` are accepted but ignored under the stdio
transport.

:::

## Configuration Loading

Configuration is built and validated by the `ConfigManager` class (the only
configuration export besides the `createConfig` factory). There are no
standalone `loadConfig()`/`validateConfig()` functions; the snippets below are
illustrative of `ConfigManager`'s behavior.

### From Environment

```typescript
import { ConfigManager } from './utils/config';

// Reads recognized environment variables and validates on construction
const manager = new ConfigManager();
const config = manager.getConfig();
```

### Programmatic Overrides

```typescript
import { createConfig } from './utils/config';

// Apply partial overrides on top of environment/defaults
const manager = createConfig({
  name: 'My MCP Server',
  atproto: {
    service: 'https://bsky.social',
    authMethod: 'app-password',
  },
});
```

## Validation

`ConfigManager` validates configuration when it is constructed and throws a
[`ConfigurationError`](./errors.md#configurationerror) on invalid input — for
example a missing `service` URL, or missing credentials for the selected
`authMethod`. The illustrative logic is roughly:

```typescript
// Illustrative — actual validation lives inside ConfigManager
if (!config.atproto.service) {
  throw new ConfigurationError('AT Protocol service URL is required');
}

if (config.atproto.authMethod === 'app-password') {
  if (!config.atproto.identifier || !config.atproto.password) {
    throw new ConfigurationError(
      'Identifier and password required for app password auth'
    );
  }
}
```

## Best Practices

### Security

- Never commit credentials to version control
- Use environment variables for sensitive data
- Rotate app passwords regularly

### Configuration Management

- Validate configuration on startup
- Provide sensible defaults
- Document all configuration options

## See Also

- [Core Types](./core.md)
- [Error Types](./errors.md)
- [Configuration Guide](../../guide/configuration.md)
- [Authentication Guide](../../guide/authentication.md)
