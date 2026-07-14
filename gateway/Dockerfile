# Build stage
FROM node:24.18.0-trixie AS build

WORKDIR /app

# Copy package.json to install dependencies
COPY package.json ./

# Install dependencies (no native modules required after switching to node:sqlite)
RUN npm install

# Copy local source code and configurations
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript to JavaScript
RUN npm run build

# Clean dev dependencies for production image footprint
RUN rm -rf node_modules && npm prune --production

# Production stage
FROM node:24.18.0-trixie

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

# node:sqlite is still experimental on Node 24
CMD ["node", "--experimental-sqlite", "dist/index.js"]
