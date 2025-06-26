# Multi-stage Dockerfile for production deployment

# Stage 1: Build client
FROM node:18-alpine AS client-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./
RUN npm ci --only=production

# Copy client source and build
COPY client/ ./
RUN npm run build

# Stage 2: Build server dependencies
FROM node:18-alpine AS server-deps

WORKDIR /app

# Copy server package files
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 3: Production runtime
FROM node:18-alpine AS production

# Create app directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy server dependencies
COPY --from=server-deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy server source
COPY --chown=nodejs:nodejs package*.json ./
COPY --chown=nodejs:nodejs server.js ./
COPY --chown=nodejs:nodejs routes/ ./routes/
COPY --chown=nodejs:nodejs utils/ ./utils/

# Copy built client
COPY --from=client-builder --chown=nodejs:nodejs /app/client/build ./client/build

# Create logs directory
RUN mkdir -p logs && chown nodejs:nodejs logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["dumb-init", "node", "server.js"]
