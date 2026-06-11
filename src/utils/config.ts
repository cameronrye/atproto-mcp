/**
 * Configuration management system for the AT Protocol MCP Server
 * Handles environment variables, command-line arguments, and default settings
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ConfigurationError, type IAtpConfig, type IMcpServerConfig } from '../types/index.js';
import { Logger } from './logger.js';

const logger = new Logger('Config');

/**
 * Resolve the package version from package.json so the server never advertises a
 * stale hardcoded version. Memoized; falls back to '0.0.0' if unreadable.
 */
let cachedVersion: string | undefined;
function getPackageVersion(): string {
  if (cachedVersion !== undefined) {
    return cachedVersion;
  }
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // src/utils/config.ts -> ../../package.json ; dist/utils/config.js -> ../../package.json
    const pkg = JSON.parse(readFileSync(join(here, '..', '..', 'package.json'), 'utf8')) as {
      version?: string;
    };
    cachedVersion = pkg.version ?? '0.0.0';
  } catch {
    cachedVersion = '0.0.0';
  }
  return cachedVersion;
}

/**
 * Zod schema for AT Protocol configuration validation
 * Authentication credentials are now optional to support unauthenticated mode
 */
const AtpConfigSchema = z.object({
  service: z.string().url('AT Protocol service must be a valid URL'),
  identifier: z.string().optional(),
  password: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  authMethod: z.enum(['app-password', 'oauth']).optional(),
});

/**
 * Zod schema for MCP server configuration validation
 */
const McpServerConfigSchema = z.object({
  port: z.number().int().min(1).max(65535),
  host: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().min(1),
  atproto: AtpConfigSchema,
});

/**
 * Default configuration values
 * Authentication is now optional - server works in unauthenticated mode by default
 */
function createDefaultConfig(): IMcpServerConfig {
  // Determine if we have authentication credentials
  const hasAppPasswordCreds = !!(
    process.env['ATPROTO_IDENTIFIER'] != null &&
    process.env['ATPROTO_IDENTIFIER'] !== '' &&
    process.env['ATPROTO_PASSWORD'] != null &&
    process.env['ATPROTO_PASSWORD'] !== ''
  );
  const hasOAuthCreds = !!(
    process.env['ATPROTO_CLIENT_ID'] != null &&
    process.env['ATPROTO_CLIENT_ID'] !== '' &&
    process.env['ATPROTO_CLIENT_SECRET'] != null &&
    process.env['ATPROTO_CLIENT_SECRET'] !== ''
  );

  // Default to app-password if we have those credentials, otherwise no auth method
  let defaultAuthMethod: 'app-password' | 'oauth' | undefined;
  if (hasAppPasswordCreds) {
    defaultAuthMethod = 'app-password';
  } else if (hasOAuthCreds) {
    defaultAuthMethod = 'oauth';
  }

  return {
    port: 3000,
    host: 'localhost',
    name: 'atproto-mcp',
    version: getPackageVersion(),
    description:
      'AT Protocol MCP Server - Comprehensive interface for LLMs to interact with AT Protocol (supports both authenticated and unauthenticated modes)',
    atproto: {
      service: 'https://bsky.social',
      // Only set auth method if we have credentials
      ...(defaultAuthMethod != null && { authMethod: defaultAuthMethod }),
      // Include credentials if available
      ...(process.env['ATPROTO_IDENTIFIER'] != null &&
        process.env['ATPROTO_IDENTIFIER'] !== '' && {
          identifier: process.env['ATPROTO_IDENTIFIER'],
        }),
      ...(process.env['ATPROTO_PASSWORD'] != null &&
        process.env['ATPROTO_PASSWORD'] !== '' && { password: process.env['ATPROTO_PASSWORD'] }),
      ...(process.env['ATPROTO_CLIENT_ID'] != null &&
        process.env['ATPROTO_CLIENT_ID'] !== '' && { clientId: process.env['ATPROTO_CLIENT_ID'] }),
      ...(process.env['ATPROTO_CLIENT_SECRET'] != null &&
        process.env['ATPROTO_CLIENT_SECRET'] !== '' && {
          clientSecret: process.env['ATPROTO_CLIENT_SECRET'],
        }),
    },
  };
}

/**
 * Environment variable mappings
 */
const ENV_MAPPINGS = {
  MCP_SERVER_PORT: 'port',
  MCP_SERVER_HOST: 'host',
  MCP_SERVER_NAME: 'name',
  ATPROTO_SERVICE: 'atproto.service',
  ATPROTO_IDENTIFIER: 'atproto.identifier',
  ATPROTO_PASSWORD: 'atproto.password',
  ATPROTO_CLIENT_ID: 'atproto.clientId',
  ATPROTO_CLIENT_SECRET: 'atproto.clientSecret',
  ATPROTO_AUTH_METHOD: 'atproto.authMethod',
} as const;

/** Config paths whose env values should be coerced to a number (all others stay strings). */
const NUMERIC_CONFIG_PATHS = new Set<string>(['port']);

/** Mask a sensitive string for logging, keeping just enough to disambiguate. */
function maskSensitive(value: string): string {
  return value.length <= 4 ? '***' : `${value.slice(0, 2)}***`;
}

/**
 * Produce a log-safe copy of the configuration: passwords/secrets are fully
 * redacted, and the identifier/clientId are masked (they are sensitive enough not
 * to appear in logs verbatim).
 */
export function redactConfigForLog(config: IMcpServerConfig): IMcpServerConfig {
  return {
    ...config,
    atproto: {
      ...config.atproto,
      ...(config.atproto.identifier && { identifier: maskSensitive(config.atproto.identifier) }),
      ...(config.atproto.password && { password: '[REDACTED]' }),
      ...(config.atproto.clientId && { clientId: maskSensitive(config.atproto.clientId) }),
      ...(config.atproto.clientSecret && { clientSecret: '[REDACTED]' }),
    },
  };
}

/**
 * Configuration manager class
 */
export class ConfigManager {
  private config: IMcpServerConfig;

  constructor(overrides: Partial<IMcpServerConfig> = {}) {
    this.config = this.buildConfig(overrides);
    this.validateConfig();
    this.logConfiguration();
  }

  /**
   * Build configuration from defaults, environment variables, and overrides
   */
  private buildConfig(overrides: Partial<IMcpServerConfig>): IMcpServerConfig {
    // Start with defaults
    let config = createDefaultConfig();

    // Apply environment variables
    config = this.applyEnvironmentVariables(config);

    // Apply overrides (highest priority)
    config = this.mergeConfig(config, overrides);

    return config;
  }

  /**
   * Apply environment variables to configuration
   */
  private applyEnvironmentVariables(config: IMcpServerConfig): IMcpServerConfig {
    const envConfig: Partial<IMcpServerConfig> = {};

    for (const [envVar, configPath] of Object.entries(ENV_MAPPINGS)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        this.setNestedProperty(envConfig, configPath, this.parseEnvValue(value, configPath));
      }
    }

    return this.mergeConfig(config, envConfig);
  }

  /**
   * Parse an environment variable value to the appropriate type.
   *
   * Only fields that are genuinely numeric (the port) are coerced to a number.
   * Everything else stays a string so that numeric-looking identifiers,
   * passwords, and secrets (e.g. an all-digit app password) are preserved exactly
   * and pass string validation.
   */
  private parseEnvValue(value: string, configPath: string): string | number {
    if (NUMERIC_CONFIG_PATHS.has(configPath)) {
      const numValue = Number(value);
      if (!isNaN(numValue) && isFinite(numValue)) {
        return numValue;
      }
    }
    return value;
  }

  /**
   * Set nested property using dot notation
   */
  private setNestedProperty(obj: any, path: string, value: unknown): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]!;
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    const finalKey = keys[keys.length - 1]!;
    current[finalKey] = value;
  }

  /**
   * Deep merge configuration objects
   */
  private mergeConfig(
    base: IMcpServerConfig,
    override: Partial<IMcpServerConfig>
  ): IMcpServerConfig {
    const result = { ...base };

    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined) {
        if (key === 'atproto' && typeof value === 'object' && value !== null) {
          result.atproto = { ...result.atproto, ...value };
        } else {
          (result as any)[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Validate configuration using Zod schema
   */
  private validateConfig(): void {
    try {
      McpServerConfigSchema.parse(this.config);
      this.validateAuthConfiguration(this.config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
        throw new ConfigurationError(`Configuration validation failed: ${issues.join(', ')}`, {
          issues,
        });
      }
      throw error;
    }
  }

  /**
   * Whether the given AT Protocol config carries the credentials required for the
   * specified auth method. Single source of truth for the credential-presence
   * check shared by validation, hasAuthentication, and isValidForAuth.
   */
  private hasCredentialsFor(authMethod: 'app-password' | 'oauth', atproto: IAtpConfig): boolean {
    if (authMethod === 'app-password') {
      return !!(atproto.identifier && atproto.password);
    }
    if (authMethod === 'oauth') {
      return !!(atproto.clientId && atproto.clientSecret);
    }
    return false;
  }

  /**
   * Validate authentication configuration
   * Authentication is now optional - only validate if auth method is specified
   */
  private validateAuthConfiguration(config: IMcpServerConfig): void {
    const { atproto } = config;

    // If no auth method is specified, we're in unauthenticated mode - no validation needed
    if (!atproto.authMethod) {
      return;
    }

    // Skip the credential requirement in the test environment (tests construct
    // configs without real credentials).
    const isTestEnv = process.env['NODE_ENV'] === 'test';
    if (!isTestEnv && !this.hasCredentialsFor(atproto.authMethod, atproto)) {
      throw new ConfigurationError(
        atproto.authMethod === 'app-password'
          ? 'App password authentication requires both identifier and password'
          : 'OAuth authentication requires both clientId and clientSecret',
        { authMethod: atproto.authMethod }
      );
    }
  }

  /**
   * Log configuration (excluding sensitive data)
   */
  private logConfiguration(): void {
    logger.info('Configuration loaded', redactConfigForLog(this.config));
  }

  /**
   * Get the current configuration.
   * Returns a copy that also clones the nested atproto credentials object, so
   * callers cannot mutate the live configuration through the snapshot.
   */
  public getConfig(): IMcpServerConfig {
    return { ...this.config, atproto: { ...this.config.atproto } };
  }

  /**
   * Get AT Protocol configuration
   */
  public getAtpConfig(): IAtpConfig {
    return { ...this.config.atproto };
  }

  /**
   * Update configuration at runtime
   */
  public updateConfig(updates: Partial<IMcpServerConfig>): void {
    const newConfig = this.mergeConfig(this.config, updates);

    // Validate the new configuration with the same checks the constructor
    // enforces: schema shape AND auth-credential requirements.
    try {
      McpServerConfigSchema.parse(newConfig);
      this.validateAuthConfiguration(newConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
        throw new ConfigurationError(
          `Configuration update validation failed: ${issues.join(', ')}`,
          { issues }
        );
      }
      throw error;
    }

    this.config = newConfig;
    logger.info('Configuration updated');
  }

  /**
   * Check if configuration is valid for the specified auth method
   */
  public isValidForAuth(authMethod: 'app-password' | 'oauth'): boolean {
    try {
      const testConfig = { ...this.config, atproto: { ...this.config.atproto, authMethod } };
      McpServerConfigSchema.parse(testConfig);

      // Additional validation for auth method requirements
      return this.hasCredentialsFor(authMethod, testConfig.atproto);
    } catch {
      return false;
    }
  }

  /**
   * Check if authentication is configured
   */
  public hasAuthentication(): boolean {
    const { atproto } = this.config;
    return atproto.authMethod ? this.hasCredentialsFor(atproto.authMethod, atproto) : false;
  }

  /**
   * Get authentication mode description
   */
  public getAuthMode(): 'unauthenticated' | 'app-password' | 'oauth' {
    if (!this.hasAuthentication()) {
      return 'unauthenticated';
    }
    return this.config.atproto.authMethod!;
  }
}

/**
 * Create a configuration manager instance
 */
export function createConfig(overrides: Partial<IMcpServerConfig> = {}): ConfigManager {
  return new ConfigManager(overrides);
}
