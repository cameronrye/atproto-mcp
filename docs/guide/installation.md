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

Because the server speaks MCP over **stdio**, the Docker image is normally
launched _interactively_ by your MCP client (which attaches to the container's
stdin/stdout), not run as a long-lived detached daemon.

### Building and Running the Image

```bash
# Clone and build the image
git clone https://github.com/cameronrye/atproto-mcp.git
cd atproto-mcp
docker build -t atproto-mcp .

# Run the container over stdio (-i keeps stdin open for the MCP client)
docker run -i --rm \
  -e ATPROTO_IDENTIFIER=your.handle \
  -e ATPROTO_PASSWORD=your-app-password \
  atproto-mcp
```

Point your MCP client at `docker run -i --rm ... atproto-mcp` as the server
command. See [Deployment](./deployment.md) for a complete client-configuration
example.

::: tip stdio transport

The server communicates over the stdio transport and does not bind a network
port, so no `-p`/port publishing is required. The `Dockerfile` includes an
`EXPOSE 3000` line, but it is vestigial — nothing listens on that port.

:::

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
[INFO] Registered 60 tools, 4 resources, 2 prompts
[INFO] Server ready on stdio transport
```

### Health Check

The server uses the **stdio transport** and does not expose an HTTP endpoint.
The bundled health check is a process-local smoke check that loads the package,
builds and validates the configuration, and checks this process's heap — it does
not bind a port or probe a running server:

```bash
node dist/health-check.js
```

A successful run exits with status `0`.

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

# Rebuild the image after pulling changes
docker build -t atproto-mcp .
```

### Ports

The server uses the stdio transport and does **not** bind a network port, so
"port already in use" errors do not apply to the server process itself. The
`--port`/`--host` flags are accepted for compatibility but are ignored.

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
# Pull the latest source and rebuild the image
git pull origin main
docker build -t atproto-mcp .
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
# Stop and remove the container (if one is running)
docker rm -f atproto-mcp

# Remove the image
docker rmi atproto-mcp
```

## Next Steps

Now that you have the server installed:

1. **[Quick Start](./getting-started.md)** - Get up and running
2. **[Configuration](./configuration.md)** - Configure the server
3. **[Authentication](./authentication.md)** - Set up authentication (optional)

---

**Previous**: [Introduction](./introduction.md) ← | **Next**:
[Quick Start](./getting-started.md) →
