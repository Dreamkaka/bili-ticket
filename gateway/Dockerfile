# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package.json and pnpm-lock.yaml (if present) to install dependencies
COPY package.json pnpm-lock.yaml* ./

# Install dependencies (only production if needed, or build everything)
RUN pnpm install --frozen-lockfile

# Copy local source code and configurations
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript to JavaScript
RUN pnpm build

# Clean dev dependencies for production image footprint
RUN rm -rf node_modules && pnpm install --prod --frozen-lockfile

# Production stage
FROM node:20-alpine

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
