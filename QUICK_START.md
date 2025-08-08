# 🚀 QUICK START GUIDE

## 1️⃣ First Time Setup (30 seconds)

```bash
# Clone or navigate to project
cd anti-scraping-server

# Make scripts executable
chmod +x final-check.sh

# Run final check (installs dependencies automatically)
./final-check.sh
```

## 2️⃣ Start the Server

```bash
# Development mode (with hot-reload)
npm run start:dev

# OR Production mode
npm run build
npm run start:prod
```

## 3️⃣ Test It!

Open your browser:
- Health Check: http://localhost:3000/health
- Test Interface: http://localhost:3000/public/index.html

## ✅ That's it! Your anti-scraping server is running!

---

## 🔍 Troubleshooting

### If `final-check.sh` shows errors:

**Missing .env file:**
```bash
cp .env.example .env
```

**Dependencies not installed:**
```bash
npm install
```

**TypeScript errors:**
```bash
# Check which files have errors
npx tsc --noEmit
```

**Port already in use:**
```bash
# Change port in .env file
PORT=3001
```

---

## 📊 What's Working?

✅ **IP Blacklisting** - Block IPs dynamically  
✅ **User-Agent Filtering** - Block bots and scrapers  
✅ **Rate Limiting** - Throttle requests per IP  
✅ **Honeypot Protection** - Detect and block bots  
✅ **Headless Browser Detection** - Block automation tools  
✅ **Health Monitoring** - Check system status  

---

## 🎯 Test the Protection

1. Open http://localhost:3000/public/index.html
2. Try different tests:
   - Send rapid requests (rate limiting)
   - Use curl/wget (user-agent blocking)
   - Fill honeypot fields (bot detection)

---

## 🐳 Using Docker?

```bash
# Build and run with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f app

# Stop
docker-compose down
```

---

## 📝 Need Help?

- Check full README.md for detailed documentation
- Review logs: `npm run start:dev` shows detailed logs
- Verify setup: `./final-check.sh`

---

**Made with ❤️ using NestJS**
