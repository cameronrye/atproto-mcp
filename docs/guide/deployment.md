# Deployment

Production deployment guide for the AT Protocol MCP Server.

## Overview

This guide covers deploying the AT Protocol MCP Server in production environments. For detailed deployment instructions, see [DEPLOYMENT.md](../../DEPLOYMENT.md) in the repository root.

## Quick Start

### Docker Compose (Recommended)

The fastest way to deploy:

```bash
# Clone repository
git clone https://github.com/cameronrye/atproto-mcp.git
cd atproto-mcp

# Configure environment
cp .env.example .env
nano .env  # Add your credentials

# Deploy
docker-compose up -d

# Verify
curl http://localhost:3000/health
```

## Deployment Options

### 1. Docker Compose

**Best for**: Small to medium deployments, development teams

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
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 2. Kubernetes

**Best for**: Large-scale deployments, enterprise

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: atproto-mcp
spec:
  replicas: 3
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

### 3. Cloud Platforms

#### AWS ECS

```bash
# Create task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
  --cluster atproto-cluster \
  --service-name atproto-mcp \
  --task-definition atproto-mcp:1 \
  --desired-count 2
```

#### Google Cloud Run

```bash
# Build and push image
gcloud builds submit --tag gcr.io/PROJECT_ID/atproto-mcp

# Deploy
gcloud run deploy atproto-mcp \
  --image gcr.io/PROJECT_ID/atproto-mcp \
  --platform managed \
  --region us-central1 \
  --set-env-vars ATPROTO_IDENTIFIER=...,ATPROTO_PASSWORD=...
```

#### Azure Container Instances

```bash
# Create container
az container create \
  --resource-group atproto-rg \
  --name atproto-mcp \
  --image atproto-mcp:latest \
  --dns-name-label atproto-mcp \
  --ports 3000 \
  --environment-variables \
    ATPROTO_IDENTIFIER=... \
    ATPROTO_PASSWORD=...
```

### 4. Traditional Server

**Best for**: Dedicated servers, VPS

```bash
# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Clone and setup
git clone https://github.com/cameronrye/atproto-mcp.git
cd atproto-mcp
npm install
npm run build

# Configure environment
cp .env.example .env
nano .env

# Start with PM2
pm2 start dist/index.js --name atproto-mcp
pm2 save
pm2 startup
```

## Configuration

### Environment Variables

**Required**:
```bash
ATPROTO_IDENTIFIER=your-handle.bsky.social
ATPROTO_PASSWORD=your-app-password
```

**Recommended**:
```bash
NODE_ENV=production
LOG_LEVEL=info
CACHE_ENABLED=true
METRICS_ENABLED=true
HEALTH_CHECK_ENABLED=true
```

**Security**:
```bash
CORS_ORIGINS=https://yourdomain.com
TRUSTED_PROXIES=10.0.0.0/8
SECURITY_SECRET_KEY=$(openssl rand -hex 32)
```

### Secrets Management

#### AWS Secrets Manager

```bash
# Store secrets
aws secretsmanager create-secret \
  --name atproto-mcp-credentials \
  --secret-string '{"identifier":"...","password":"..."}'

# Retrieve in application
aws secretsmanager get-secret-value \
  --secret-id atproto-mcp-credentials
```

#### HashiCorp Vault

```bash
# Store secrets
vault kv put secret/atproto-mcp \
  identifier="..." \
  password="..."

# Retrieve in application
vault kv get secret/atproto-mcp
```

#### Kubernetes Secrets

```bash
# Create secret
kubectl create secret generic atproto-secrets \
  --from-literal=identifier=... \
  --from-literal=password=...

# Use in deployment (see Kubernetes example above)
```

## Monitoring

### Health Checks

```bash
# HTTP health check
curl http://localhost:3000/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "0.1.0"
}
```

### Prometheus Metrics

```bash
# Metrics endpoint
curl http://localhost:9090/metrics

# Key metrics
# - atproto_requests_total
# - atproto_request_duration_seconds
# - atproto_errors_total
# - atproto_rate_limit_hits_total
```

### Grafana Dashboards

Access Grafana at `http://localhost:3001`:
- Default credentials: `admin/admin` (change immediately!)
- Pre-configured dashboards for:
  - Request rates and latency
  - Error rates
  - Authentication status
  - Resource usage

### Logging

```bash
# View logs (Docker)
docker logs -f atproto-mcp

# View logs (PM2)
pm2 logs atproto-mcp

# View logs (Kubernetes)
kubectl logs -f deployment/atproto-mcp
```

## Security

### Pre-Deployment Checklist

- [ ] Change default passwords (Grafana, Redis, etc.)
- [ ] Configure specific CORS origins (not `*`)
- [ ] Use app passwords, not main account passwords
- [ ] Set strong `SECURITY_SECRET_KEY`
- [ ] Enable HTTPS in production
- [ ] Configure `TRUSTED_PROXIES` if behind proxy
- [ ] Enable rate limiting
- [ ] Restrict access to internal services
- [ ] Set up firewall rules
- [ ] Enable audit logging

### HTTPS Configuration

#### Using nginx

```nginx
server {
    listen 443 ssl http2;
    server_name atproto-mcp.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Using Traefik

```yaml
http:
  routers:
    atproto-mcp:
      rule: "Host(`atproto-mcp.yourdomain.com`)"
      service: atproto-mcp
      tls:
        certResolver: letsencrypt
  services:
    atproto-mcp:
      loadBalancer:
        servers:
          - url: "http://localhost:3000"
```

## Scaling

### Horizontal Scaling

```bash
# Docker Compose
docker-compose up -d --scale atproto-mcp=3

# Kubernetes
kubectl scale deployment atproto-mcp --replicas=5

# PM2
pm2 scale atproto-mcp 4
```

### Load Balancing

#### nginx

```nginx
upstream atproto_backend {
    least_conn;
    server localhost:3000;
    server localhost:3001;
    server localhost:3002;
}

server {
    location / {
        proxy_pass http://atproto_backend;
    }
}
```

### Resource Allocation

**Minimum**:
- CPU: 0.25 cores
- Memory: 256 MB
- Storage: 1 GB

**Recommended**:
- CPU: 0.5 cores
- Memory: 512 MB
- Storage: 5 GB

**High Load**:
- CPU: 1-2 cores
- Memory: 1-2 GB
- Storage: 10 GB

## Backup & Recovery

### Data to Backup

- Configuration files (`.env`, `config/`)
- Logs (if needed for compliance)
- Credentials and secrets
- Custom configurations

### Backup Script

```bash
#!/bin/bash
BACKUP_DIR="/backups/atproto-mcp"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR/$DATE"

# Backup configuration
cp .env "$BACKUP_DIR/$DATE/"
cp -r config "$BACKUP_DIR/$DATE/"

# Backup logs (optional)
cp -r logs "$BACKUP_DIR/$DATE/"

# Create archive
tar -czf "$BACKUP_DIR/atproto-mcp-$DATE.tar.gz" "$BACKUP_DIR/$DATE"

# Clean up old backups (keep last 7 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
```

### Recovery Procedure

```bash
# 1. Extract backup
tar -xzf atproto-mcp-YYYYMMDD_HHMMSS.tar.gz

# 2. Restore configuration
cp backup/.env .
cp -r backup/config .

# 3. Restart service
docker-compose restart
# or
pm2 restart atproto-mcp
```

## Maintenance

### Updates

```bash
# Docker
docker pull atproto-mcp:latest
docker-compose up -d

# PM2
git pull origin main
npm install
npm run build
pm2 restart atproto-mcp

# Kubernetes
kubectl set image deployment/atproto-mcp \
  atproto-mcp=atproto-mcp:latest
```

### Health Monitoring

Set up automated health checks:

```bash
# Cron job for health check
*/5 * * * * curl -f http://localhost:3000/health || systemctl restart atproto-mcp
```

## Troubleshooting

See [Troubleshooting Guide](./troubleshooting.md) for common deployment issues.

## Next Steps

- **[Security](../../SECURITY.md)** - Security best practices
- **[Monitoring](./troubleshooting.md)** - Monitor your deployment
- **[Contributing](../contributing.md)** - Contribute improvements

---

**Previous**: [Troubleshooting](./troubleshooting.md) ← | **Next**: [API Reference](../api/tools.md) →

