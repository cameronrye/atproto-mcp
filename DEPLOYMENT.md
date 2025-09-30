# AT Protocol MCP Server - Production Deployment Guide

This guide covers deploying the AT Protocol MCP Server in production environments.

## Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)
- AT Protocol account with app password
- (Optional) OAuth client credentials when available

## Quick Start

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd atproto-mcp
   cp .env.example .env
   ```

2. **Configure Environment**
   Edit `.env` file with your credentials:
   ```bash
   ATPROTO_IDENTIFIER=your.handle.bsky.social
   ATPROTO_PASSWORD=your-app-password
   ```

3. **Deploy with Docker Compose**
   ```bash
   docker-compose up -d
   ```

4. **Verify Deployment**
   ```bash
   curl http://localhost:3000/health
   ```

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `ATPROTO_IDENTIFIER` | Your AT Protocol handle | Yes | - |
| `ATPROTO_PASSWORD` | Your app password | Yes | - |
| `ATPROTO_SERVICE` | AT Protocol service URL | No | `https://bsky.social` |
| `NODE_ENV` | Environment mode | No | `production` |
| `LOG_LEVEL` | Logging level | No | `info` |
| `SERVER_PORT` | Server port | No | `3000` |

### Production Configuration

The server uses `config/production.json` for production settings. Key areas:

- **Performance**: Connection pooling, caching, WebSocket management
- **Security**: Input sanitization, rate limiting, error handling
- **Monitoring**: Health checks, metrics, logging
- **Features**: Streaming, OAuth, moderation, media uploads

## Docker Deployment

### Single Container
```bash
docker build -t atproto-mcp .
docker run -d \
  --name atproto-mcp \
  -p 3000:3000 \
  -e ATPROTO_IDENTIFIER=your.handle \
  -e ATPROTO_PASSWORD=your-password \
  atproto-mcp
```

### Docker Compose (Recommended)
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f atproto-mcp

# Stop services
docker-compose down
```

### Services Included

- **atproto-mcp**: Main MCP server
- **redis**: Session storage and caching (optional)
- **prometheus**: Metrics collection (optional)
- **grafana**: Monitoring dashboard (optional)

## Kubernetes Deployment

### Basic Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: atproto-mcp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: atproto-mcp
  template:
    metadata:
      labels:
        app: atproto-mcp
    spec:
      containers:
      - name: atproto-mcp
        image: atproto-mcp:latest
        ports:
        - containerPort: 3000
        env:
        - name: ATPROTO_IDENTIFIER
          valueFrom:
            secretKeyRef:
              name: atproto-secrets
              key: identifier
        - name: ATPROTO_PASSWORD
          valueFrom:
            secretKeyRef:
              name: atproto-secrets
              key: password
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Service and Ingress
```yaml
apiVersion: v1
kind: Service
metadata:
  name: atproto-mcp-service
spec:
  selector:
    app: atproto-mcp
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: atproto-mcp-ingress
spec:
  rules:
  - host: atproto-mcp.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: atproto-mcp-service
            port:
              number: 80
```

## Monitoring and Observability

### Health Checks
- **Endpoint**: `GET /health`
- **Docker**: Built-in health check
- **Kubernetes**: Liveness and readiness probes

### Metrics
- **Prometheus**: Metrics exposed on `/metrics`
- **Grafana**: Pre-configured dashboards
- **Custom Metrics**: Performance, security, business metrics

### Logging
- **Format**: JSON in production
- **Levels**: error, warn, info, debug
- **Rotation**: Automatic log rotation
- **Aggregation**: Compatible with ELK, Fluentd, etc.

## Security Considerations

### Network Security
- Use HTTPS in production
- Configure proper CORS origins
- Set up firewall rules
- Use reverse proxy (nginx, Traefik)

### Secrets Management
- Use environment variables for secrets
- Consider HashiCorp Vault or similar
- Rotate credentials regularly
- Never commit secrets to version control

### Container Security
- Run as non-root user
- Use minimal base images
- Scan for vulnerabilities
- Keep dependencies updated

## Performance Tuning

### Resource Allocation
- **Memory**: 256MB minimum, 512MB recommended
- **CPU**: 0.25 cores minimum, 0.5 cores recommended
- **Storage**: 1GB for logs and cache

### Scaling
- **Horizontal**: Multiple container instances
- **Vertical**: Increase container resources
- **Load Balancing**: Use nginx or cloud load balancer

### Optimization
- Enable connection pooling
- Configure appropriate cache sizes
- Tune rate limits based on usage
- Monitor and adjust based on metrics

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify AT Protocol credentials
   - Check app password validity
   - Ensure service URL is correct

2. **High Memory Usage**
   - Check cache configuration
   - Monitor connection pool size
   - Review log retention settings

3. **Connection Issues**
   - Verify network connectivity
   - Check firewall rules
   - Review proxy configuration

### Debug Mode
```bash
# Enable debug logging
docker-compose exec atproto-mcp \
  env LOG_LEVEL=debug node dist/cli.js
```

### Log Analysis
```bash
# View recent logs
docker-compose logs --tail=100 atproto-mcp

# Follow logs in real-time
docker-compose logs -f atproto-mcp

# Search logs
docker-compose logs atproto-mcp | grep ERROR
```

## Backup and Recovery

### Data Backup
- Configuration files
- Log files (if needed)
- Cache data (optional)
- Credentials and secrets

### Recovery Procedures
1. Restore configuration files
2. Recreate secrets/environment variables
3. Deploy containers
4. Verify functionality

## Maintenance

### Updates
1. Pull latest image
2. Update configuration if needed
3. Rolling deployment
4. Verify functionality

### Monitoring
- Set up alerts for critical metrics
- Regular health check monitoring
- Performance trend analysis
- Security audit logs

## Support

For issues and questions:
- Check logs for error messages
- Review configuration settings
- Consult AT Protocol documentation
- Open GitHub issues for bugs

## License

This deployment guide is part of the AT Protocol MCP Server project.
