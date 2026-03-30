FROM node:18-alpine AS builder

WORKDIR /app

# canvas 네이티브 빌드 의존성
RUN apk add --no-cache build-base g++ cairo-dev pango-dev libjpeg-turbo-dev giflib-dev librsvg-dev pixman-dev python3

# Copy package files
COPY package*.json ./

# Install ALL dependencies (devDeps needed for nest build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# canvas 런타임 의존성 + dumb-init
RUN apk add --no-cache dumb-init cairo pango libjpeg-turbo giflib librsvg pixman

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/public ./public

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# Start application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
