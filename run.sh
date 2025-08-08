#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

clear

echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        🚀 Anti-Scraping Server - Ready to Launch!         ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Install class-validator and class-transformer if missing
echo -e "${YELLOW}📦 Ensuring required packages...${NC}"
npm install class-validator class-transformer --save

# TypeScript check
echo -e "${YELLOW}🔧 Checking TypeScript...${NC}"
npx tsc --noEmit --skipLibCheck

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ TypeScript: OK${NC}"
else
    echo -e "${RED}❌ TypeScript: Failed${NC}"
    echo "Please fix the errors above"
    exit 1
fi

# Build
echo -e "${YELLOW}🔨 Building...${NC}"
npm run build > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build: OK${NC}"
else
    echo -e "${RED}❌ Build: Failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✨ Everything is ready! Server can start now! ✨${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Starting development server...${NC}"
echo ""
echo -e "${YELLOW}URLs:${NC}"
echo -e "  • Health: ${CYAN}http://localhost:3000/health${NC}"
echo -e "  • Test UI: ${CYAN}http://localhost:3000/public/index.html${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Start the server
npm run start:dev
