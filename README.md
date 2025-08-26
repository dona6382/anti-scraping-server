# 🛡️ Anti-Scraping Server v2.0

Production-ready anti-scraping solution with modular architecture and comprehensive security features.

## 🚀 Quick Start

```bash
# Clone or navigate to project
cd anti-scraping-server

# Start the server (installs dependencies automatically)
chmod +x start.sh && ./start.sh

# Or manually
npm install
npm run start:dev
```

**Server will be available at:** http://localhost:3000

## 🛡️ Security Features

- **🔒 IP Blacklisting** - Dynamic IP blocking with Redis/Memory cache
- **🤖 Bot Detection** - User-Agent filtering and pattern matching
- **⚡ Rate Limiting** - Request throttling per IP address
- **🍯 Honeypot Protection** - Hidden fields to catch automated tools
- **👻 Headless Browser Detection** - Blocks Puppeteer, Selenium, etc.
- **🔍 Client Analysis** - Advanced fingerprinting and risk scoring

## 📊 API Endpoints

### Health & System
```bash
GET  /health              # Basic health check
GET  /health/detailed     # System metrics
```

### Public APIs
```bash
GET  /api/public/data     # Public data access
GET  /api/public/health   # Public health status
```

### Admin Panel
```bash
GET  /admin/system/info   # System information
GET  /admin/security/statistics  # Security metrics
POST /admin/security/blacklist/ip    # Block IP
DELETE /admin/security/blacklist/ip/:ip  # Unblock IP
```

### Testing
```bash
GET  /test                # Basic functionality test
GET  /test/security-full  # Comprehensive security test
```

## ⚙️ Configuration

Copy `.env.example` to `.env` and configure:

```env
# Server
PORT=3000
NODE_ENV=development

# Security
SECURITY_STRICT_MODE=false
BLOCKED_USER_AGENTS=scrapy,python-requests,curl,bot

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=20

# Redis (Optional - falls back to memory)
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 📁 Project Structure

```
src/
├── core/           # Core infrastructure (config, cache, types)
├── shared/         # Shared components (guards, utils, filters)
├── features/       # Business modules (security, health, admin)
├── api/           # API versioning (v1)
└── legacy/        # Legacy compatibility
```

## 🐳 Docker Support

```bash
# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop
docker-compose down
```

## 🧪 Testing

```bash
# Run tests
npm test

# Test coverage
npm run test:cov

# E2E tests
npm run test:e2e

# Test security features
curl http://localhost:3000/test/security-full
```

## 🔧 Development

```bash
# Lint code
npm run lint

# Format code
npm run format

# Build for production
npm run build
npm run start:prod
```

## 📈 Monitoring

The server includes built-in monitoring endpoints:

- System health and metrics
- Security event logging
- Real-time threat detection
- Performance statistics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Built with ❤️ using NestJS, TypeScript, and Redis**