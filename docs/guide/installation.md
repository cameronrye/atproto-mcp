# Installation

This guide covers all the ways to install and run the AT Protocol MCP Server.

## Prerequisites

Before installing, ensure you have:

- **Node.js 20 or higher** - [Download Node.js](https://nodejs.org/)
- **npm, pnpm, or yarn** - Package manager (npm comes with Node.js)
- **Git** (optional) - For cloning the repository
- **AT Protocol account** (optional) - Only needed for authenticated operations

### Verify Prerequisites

```bash
# Check Node.js version (should be 20+)
node --version

# Check npm version
npm --version
```

## Installation Methods

### Method 1: Global Installation (Recommended)

Install globally to use the server from anywhere:

```bash
npm install -g atproto-mcp
```

After installation, you can run the server with:

```bash
atproto-mcp
```

### Method 2: Using npx (No Installation)

Run directly without installing:

```bash
npx atproto-mcp
```

This is perfect for:
- Quick testing
- One-time usage
- CI/CD pipelines

### Method 3: Local Project Installation

Install as a dependency in your project:

```bash
# Using npm
npm install atproto-mcp

# Using pnpm
pnpm add atproto-mcp

# Using yarn
yarn add atproto-mcp
```

Then add to your `package.json` scripts:

```json
{
  "scripts": {
    "mcp": "atproto-mcp"
  }
}
```

Run with:

```bash
npm run mcp
```

### Method 4: From Source (Development)

Clone and build from source for development or customization:

```bash
# Clone the repository
git clone https://github.com/cameronrye/atproto-mcp.git
cd atproto-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Run the server
npm start

# Or run in development mode with hot reload
npm run dev
```

## Docker Installation

### Using Docker Compose (Recommended)

The easiest way to run with Docker:

```bash
# Clone the repository
git clone https://github.com/cameronrye/atproto-mcp.git
cd atproto-mcp

# Copy environment file
cp .env.example .env

# Edit .env with your credentials (optional)
nano .env

# Start all services
docker-compose up -d
```

This starts:
- AT Protocol MCP Server
- Redis (for caching)
- Prometheus (for metrics)
- Grafana (for monitoring)

### Using Docker Directly

Run a single container:

```bash
# Pull the image
docker pull ghcr.io/cameronrye/atproto-mcp:latest

# Run the container
docker run -d \
  --name atproto-mcp \
  -p 3000:3000 \
  -e ATPROTO_IDENTIFIER=your.handle \
  -e ATPROTO_PASSWORD=your-password \
  ghcr.io/cameronrye/atproto-mcp:latest
```

### Building Docker Image Locally

```bash
# Build the image
docker build -t atproto-mcp .

# Run the container
docker run -d \
  --name atproto-mcp \
  -p 3000:3000 \
  atproto-mcp
```

## Verification

After installation, verify the server is working:

### Check Version

```bash
atproto-mcp --version
```

### Check Help

```bash
atproto-mcp --help
```

### Test Basic Functionality

Start the server:

```bash
atproto-mcp
```

You should see output like:

```
[INFO] AT Protocol MCP Server starting...
[INFO] Server initialized successfully
[INFO] Registered 30 tools, 3 resources, 2 prompts
[INFO] Server ready on stdio transport
```

### Health Check (Docker)

If running with Docker:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "0.1.0"
}
```

## Troubleshooting Installation

### Node.js Version Issues

If you get errors about Node.js version:

```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node.js 20
nvm install 20
nvm use 20
```

### Permission Errors (Global Install)

On Linux/macOS, you might need sudo:

```bash
sudo npm install -g atproto-mcp
```

Or configure npm to install globally without sudo:

```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Build Errors (From Source)

If you encounter build errors:

```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear npm cache
npm cache clean --force

# Try with different package manager
pnpm install
```

### Docker Issues

If Docker containers won't start:

```bash
# Check Docker is running
docker ps

# View container logs
docker logs atproto-mcp

# Restart containers
docker-compose restart

# Rebuild containers
docker-compose up -d --build
```

### Port Already in Use

If port 3000 is already in use:

```bash
# Use a different port
atproto-mcp --port 8080

# Or find what's using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows
```

## Updating

### Global Installation

```bash
npm update -g atproto-mcp
```

### Local Installation

```bash
npm update atproto-mcp
```

### Docker

```bash
# Pull latest image
docker pull ghcr.io/cameronrye/atproto-mcp:latest

# Restart containers
docker-compose down
docker-compose up -d
```

### From Source

```bash
git pull origin main
npm install
npm run build
```

## Uninstallation

### Global Installation

```bash
npm uninstall -g atproto-mcp
```

### Local Installation

```bash
npm uninstall atproto-mcp
```

### Docker

```bash
# Stop and remove containers
docker-compose down

# Remove images
docker rmi atproto-mcp

# Remove volumes (optional, deletes data)
docker-compose down -v
```

## Next Steps

Now that you have the server installed:

1. **[Quick Start](./getting-started.md)** - Get up and running
2. **[Configuration](./configuration.md)** - Configure the server
3. **[Authentication](./authentication.md)** - Set up authentication (optional)

---

**Previous**: [Introduction](./introduction.md) ← | **Next**: [Quick Start](./getting-started.md) →

