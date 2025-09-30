# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of AT Protocol MCP Server seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please Do Not

- **Do not** open a public GitHub issue for security vulnerabilities
- **Do not** disclose the vulnerability publicly until we've had a chance to address it

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

- **Acknowledgment:** We will acknowledge receipt of your vulnerability report within 48 hours
- **Updates:** We will send you regular updates about our progress (at least every 5 business days)
- **Verification:** We will work with you to understand and verify the vulnerability
- **Fix Timeline:** We aim to release a fix within 90 days of the initial report
- **Credit:** We will credit you in the security advisory (unless you prefer to remain anonymous)

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

- **Change default passwords** in docker-compose.yml (especially Grafana)
- Configure **specific CORS origins** instead of using wildcards (`*`)
- Use **HTTPS** in production environments
- Keep dependencies up to date with `pnpm audit` and `pnpm update`
- Run the application as a **non-root user** (Dockerfile already does this)

### Environment Variables

- Store sensitive configuration in environment variables, not in code
- Use `.env` files for local development (never commit these)
- Use secure secret management in production (e.g., AWS Secrets Manager, HashiCorp Vault)

### Network Security

- Configure `TRUSTED_PROXIES` if running behind a reverse proxy
- Set appropriate `allowedOrigins` in security configuration
- Enable rate limiting in production
- Use a firewall to restrict access to internal services (Redis, Prometheus, etc.)

### Monitoring

- Enable health checks and monitoring
- Review logs regularly for suspicious activity
- Set up alerts for unusual patterns
- Monitor rate limit violations

## Known Security Considerations

### OAuth Mock Mode

The OAuth implementation includes a mock mode for development. **Ensure `OAUTH_MOCK_MODE=false` in production** or use app passwords instead.

### Credential Storage

Credentials are stored in memory with basic obfuscation. For production deployments requiring persistent credential storage, consider integrating with a proper secret management system.

### CORS Configuration

The default configuration allows all origins (`*`). **Configure specific origins for production** by setting appropriate values in your configuration.

## Security Features

- ✅ Input validation using Zod schemas
- ✅ Rate limiting to prevent abuse
- ✅ Input sanitization to prevent injection attacks
- ✅ Error sanitization to prevent information leakage
- ✅ Non-root Docker container
- ✅ Credential redaction in logs
- ✅ HTTPS support for AT Protocol connections

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the problem and determine affected versions
2. Audit code to find any similar problems
3. Prepare fixes for all supported versions
4. Release new versions as soon as possible
5. Publish a security advisory on GitHub

## Comments on This Policy

If you have suggestions on how this process could be improved, please submit a pull request or open an issue to discuss.

## Attribution

This security policy is adapted from the [Electron Security Policy](https://github.com/electron/electron/blob/main/SECURITY.md).

