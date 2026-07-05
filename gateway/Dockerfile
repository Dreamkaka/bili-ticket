# Build stage
FROM node:22-bookworm AS build

WORKDIR /app

# Install build dependencies for better-sqlite3 (Debian has pre-built toolchains readily available)
RUN apt-get update && apt-get install -y python3 make g++ gcc libc6-dev && \
    npm install -g pnpm

# Copy package.json and pnpm-lock.yaml (if present) to install dependencies
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm config set only-built-dependencies-export-all true && pnpm install --frozen-lockfile

# Copy local source code and configurations
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript to JavaScript
RUN pnpm build

# Clean dev dependencies for production image footprint
RUN rm -rf node_modules && pnpm install --prod --frozen-lockfile

# Production stage
FROM node:22-bookworm-slim

WORKDIR /app

# Copy built code and dependencies from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./

# Define environment variables with defaults
ENV PORT=3000
ENV DATABASE_PATH=/data/gateway.db
ENV CONFIG_PATH=/config/config.json

# Create directories for data mount and configuration mount
RUN mkdir -p /data /config

EXPOSE 3000

CMD ["node", "dist/index.js"]
