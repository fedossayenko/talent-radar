# Multi-stage build for production optimization
FROM node:22-alpine AS builder

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

# Install all dependencies (including dev dependencies for building)
RUN npm ci && npm cache clean --force

# Copy source code
COPY apps/api ./apps/api

# Generate Prisma client
WORKDIR /app/apps/api
RUN npx prisma generate

# Build the application
RUN npm run build

# Install only production dependencies for final image
RUN npm ci --omit=dev && npm cache clean --force

# Production stage
FROM node:22-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package*.json ./

# Copy Prisma schema and generated client
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./prisma

# Create simple healthcheck script
RUN echo 'const http = require("http"); \
const options = { host: "localhost", port: 3000, path: "/api/v1/health", timeout: 2000 }; \
const req = http.request(options, (res) => { \
  if (res.statusCode == 200) { process.exit(0); } else { process.exit(1); } \
}); \
req.on("error", () => { process.exit(1); }); \
req.end();' > healthcheck.js

# Set ownership and permissions
RUN chown nestjs:nodejs healthcheck.js

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Switch to non-root user
USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start the application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]