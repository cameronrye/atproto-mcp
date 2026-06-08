# Multi-stage Docker build for AT Protocol MCP Server
#
# This project uses pnpm (see packageManager in package.json) and ships only a
# pnpm-lock.yaml — there is no package-lock.json, so `npm ci` cannot be used.
FROM node:20-alpine AS builder

WORKDIR /app

# Enable the pnpm version pinned by package.json's "packageManager" field.
RUN corepack enable

# Copy manifest + lockfile first for better layer caching.
COPY package.json pnpm-lock.yaml ./

# Install ALL dependencies (including devDeps) — the build needs tsc/tsx.
RUN pnpm install --frozen-lockfile

# Copy source and build.
COPY . .
RUN pnpm run build

# Production stage
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling.
RUN apk add --no-cache dumb-init

# Enable pnpm for the production install.
RUN corepack enable

# Create non-root user.
RUN addgroup -g 1001 -S nodejs && \
    adduser -S atproto -u 1001

WORKDIR /app

# Copy manifest + lockfile and install only production dependencies.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod && \
    pnpm store prune

# Copy built application from the builder stage.
COPY --from=builder /app/dist ./dist

# Create runtime directories and hand ownership to the non-root user.
RUN mkdir -p /app/logs /app/data && \
    chown -R atproto:nodejs /app

USER atproto

# Note: this server speaks MCP over stdio and binds no network port, so there is
# no EXPOSE. The health check is a process-local smoke check (see health-check.ts).
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node dist/health-check.js || exit 1

# Use dumb-init to handle signals (SIGTERM/SIGINT) properly.
ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/cli.js"]
