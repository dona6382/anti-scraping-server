# 🛡️ NestJS Anti-Scraping Server

Production-ready anti-scraping solution with multiple protection layers.

## 🚀 Quick Start

### Using Script (Recommended)
```bash
# Make scripts executable
chmod +x make-executable.sh
./make-executable.sh

# Check code
./check-code.sh

# Start server
./start.sh
```

### Manual Setup
```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run start:dev

# Production build
npm run build
npm run start:prod
```

### Using Docker
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

## 🛡️ Protection Features

### 1. **IP Blacklisting**
- Dynamic IP blocking
- Redis-backed persistence
- TTL support
- Manual block/unblock API

### 2. **User-Agent Filtering**
- Blocks known bots and scrapers
- Customizable block list
- Pattern matching
- Strict mode option

### 3. **Rate Limiting**
- Request throttling per IP
- Configurable limits
- Redis storage support
- Bypass for admin endpoints

### 4. **Headless Browser Detection**
- Detects Puppeteer, Playwright, Selenium
- Chrome DevTools Protocol detection
- Missing header analysis
- Browser fingerprinting

### 5. **Honeypot Fields**
- Hidden form fields
- Timing analysis
- Bot trap endpoints
- Automatic blocking

### 6. **reCAPTCHA v3**
- Google reCAPTCHA integration
- Score-based validation
- Configurable thresholds
- Fail-open support

## 📁 Project Structure

```
src/
├── api/                    # Business logic endpoints
├── common/                 # Shared modules
│   ├── guards/            # Security guards
│   ├── middleware/        # Express middleware
│   ├── services/          # Core services
│   ├── strategies/        # Security strategies
│   ├── types/            # TypeScript types
│   └── utils/            # Utility functions
├── app.module.ts          # Root module
└── main.ts               # Application entry
```

## 🔧 Configuration

### Environment Variables
```env
# Server
PORT=3000
NODE_ENV=development

# Security
SECURITY_STRICT_MODE=false

# Rate Limiting
THROTTLE_TTL=10
THROTTLE_LIMIT=20

# Redis (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# IP Blacklist
IP_BLACKLIST_TTL=86400

# User Agent Blocking
BLOCKED_USER_AGENTS=scrapy,python-requests,curl

# Honeypot
HONEYPOT_FIELD_NAME=email_confirm

# reCAPTCHA (Optional)
RECAPTCHA_SECRET_KEY=your_key_here
RECAPTCHA_SCORE_THRESHOLD=0.5
```

## 📊 API Endpoints

### Health Check
```bash
GET /health
GET /health/redis
```

### IP Blacklist Management
```bash
POST   /admin/blacklist/ip        # Add IP to blacklist
DELETE /admin/blacklist/ip/:ip    # Remove IP
GET    /admin/blacklist           # List all blocked IPs
GET    /admin/blacklist/ip/:ip    # Get IP info
```

### Test Endpoints
```bash
GET  /test/protected    # Test all guards
POST /test/honeypot     # Test honeypot
POST /test/user-agent   # Test user-agent blocking
```

### Business API
```bash
GET  /api/data          # Protected data endpoint
POST /api/contact       # Contact form with protections
GET  /api/search        # Search with rate limiting
```

## 🧪 Testing

### Run Tests
```bash
# Unit tests
npm test

# Test coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

### Test Interface
Open browser to: `http://localhost:3000/public/index.html`

## 🐳 Docker Deployment

### Build Image
```bash
docker build -t anti-scraping-server .
```

### Run Container
```bash
docker run -d \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e REDIS_HOST=redis \
  --name anti-scraping-server \
  anti-scraping-server
```

### Docker Compose
```bash
# Start all services
docker-compose up -d

# Scale application
docker-compose up -d --scale app=3

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📈 Monitoring

### Metrics Available
- Request rate per IP
- Blocked requests count
- Guard trigger statistics
- Redis connection status
- Memory usage
- Response times

### Health Endpoints
```json
GET /health

{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "services": {
    "database": { "status": "healthy" },
    "redis": { "status": "healthy", "connected": true },
    "memory": { "status": "healthy", "percentage": "45%" }
  }
}
```

## 🔒 Security Best Practices

1. **Environment Variables**
   - Never commit `.env` files
   - Use secrets management in production
   - Rotate keys regularly

2. **Rate Limiting**
   - Adjust limits based on traffic
   - Monitor for false positives
   - Implement gradual blocking

3. **IP Blocking**
   - Review blocked IPs regularly
   - Implement appeals process
   - Consider geographic restrictions

4. **Monitoring**
   - Set up alerts for high block rates
   - Monitor performance impact
   - Track false positive rates

## 📝 Development

### Code Style
```bash
# Lint code
npm run lint

# Fix lint issues
npm run lint:fix

# Format code
npm run format
```

### Git Hooks
Pre-commit hooks automatically:
- Run ESLint
- Format with Prettier
- Check TypeScript types

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- GitHub Issues: [Report bugs](https://github.com/your-repo/issues)
- Documentation: [Wiki](https://github.com/your-repo/wiki)
- Email: support@example.com

## 🏆 Credits

Built with:
- [NestJS](https://nestjs.com/) - Node.js framework
- [Redis](https://redis.io/) - In-memory data store
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Docker](https://www.docker.com/) - Containerization

---

Made with ❤️ by Your Team
