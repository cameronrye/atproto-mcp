# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported |
| ------- | --------- |
| 0.2.x   | Yes       |

## Reporting a Vulnerability

We take the security of AT Protocol MCP Server seriously. If you believe you
have found a security vulnerability, please report it to us as described below.

### Please Do Not

- **Do not** open a public GitHub issue for security vulnerabilities
- **Do not** disclose the vulnerability publicly until we've had a chance to
  address it

### Please Do

**Report security vulnerabilities by emailing:** c@meron.io

Please include the following information in your report:

- Type of vulnerability (e.g., authentication bypass, injection, etc.)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability, including how an attacker might exploit it

### What to Expect

- **Acknowledgment:** We will acknowledge receipt of your vulnerability report
  within 48 hours
- **Updates:** We will send you regular updates about our progress (at least
  every 5 business days)
- **Verification:** We will work with you to understand and verify the
  vulnerability
- **Fix Timeline:** We aim to release a fix within 90 days of the initial report
- **Credit:** We will credit you in the security advisory (unless you prefer to
  remain anonymous)

### Security Update Process

1. The security report is received and assigned to a primary handler
2. The problem is confirmed and a list of affected versions is determined
3. Code is audited to find any similar problems
4. Fixes are prepared for all supported versions
5. New versions are released and announcements are made

## Security Best Practices for Users

### Authentication

- **Never commit credentials** to version control
- Use **app passwords** instead of your main account password
- Rotate credentials regularly
- Use different credentials for development and production

### Deployment

- Run the server with an **app password**, never your main account password
- Keep dependencies up to date with `pnpm audit` and `pnpm update`
- Run the application as a **non-root user** (the Dockerfile already does this)
- Prefer `NODE_ENV=production`, which sanitizes error messages returned to
  clients

The server speaks MCP over **stdio** and binds no network port, so it is not
directly reachable over the network. There is no HTTP server, CORS layer, or
reverse-proxy surface to harden for this process. Network exposure (if any) is a
property of how the MCP client itself is deployed, not of this server.

### Environment Variables

- Store sensitive configuration in environment variables, not in code
- Use `.env` files for local development (never commit these)
- Use secure secret management in production (e.g., AWS Secrets Manager,
  HashiCorp Vault)
- The credential variables read by the server are `ATPROTO_IDENTIFIER` and
  `ATPROTO_PASSWORD` (app-password auth). Treat them as secrets.

### Operational Hygiene

- Review logs regularly for suspicious activity (logs are written to stderr)
- Rotate app passwords periodically and revoke any that are no longer needed
- Watch for rate-limit rejections, which can indicate runaway clients or abuse

## Known Security Considerations

### OAuth Is Incomplete

App passwords are the supported authentication method. OAuth is **experimental
and incomplete** — the token-exchange step is not implemented, so an OAuth login
cannot complete. Use app passwords and store them as secrets.

### CORS / Network Exposure

This server does not run an HTTP listener, so there is no CORS configuration to
set. The internal `allowedOrigins` value is hardcoded to `['*']` but is inert
because no HTTP transport consumes it. Do not rely on it as a security control.

## Security Features

- Input validation using **Zod schemas** on every tool's parameters
- **Per-tool rate limiting** (100 requests per minute per tool) to prevent abuse
- **Error sanitization** to prevent information leakage (active when
  `NODE_ENV=production`)
- Credentials (password and client secret) are redacted as `[REDACTED]` when the
  loaded configuration is logged; log fields are also sanitized to prevent log
  injection
- Non-root Docker container
- HTTPS used for AT Protocol service connections

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the problem and determine affected versions
2. Audit code to find any similar problems
3. Prepare fixes for all supported versions
4. Release new versions as soon as possible
5. Publish a security advisory on GitHub

## Comments on This Policy

If you have suggestions on how this process could be improved, please submit a
pull request or open an issue to discuss.

## Attribution

This security policy is adapted from the
[Electron Security Policy](https://github.com/electron/electron/blob/main/SECURITY.md).
