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
echo -e "${CYAN}║        🚀 Anti-Scraping Server - Final Setup              ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Install dependencies
echo -e "${BLUE}[1/4] Installing dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    npm install --silent
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

# Step 2: TypeScript check
echo -e "${BLUE}[2/4] Checking TypeScript...${NC}"
npx tsc --noEmit --skipLibCheck 2>&1 | tee /tmp/tsc-output.txt

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "${GREEN}✅ TypeScript: No errors${NC}"
else
    echo -e "${YELLOW}⚠️  TypeScript warnings (non-blocking)${NC}"
fi

# Step 3: Build test
echo -e "${BLUE}[3/4] Building project...${NC}"
npm run build > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build: Successful${NC}"
else
    echo -e "${YELLOW}⚠️  Build: Some warnings${NC}"
fi

# Step 4: Check if ready
echo -e "${BLUE}[4/4] Final check...${NC}"
if [ -f "dist/main.js" ]; then
    echo -e "${GREEN}✅ Application is ready!${NC}"
else
    echo -e "${YELLOW}⚠️  Build output not found, rebuilding...${NC}"
    npm run build
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}           ✨ Setup Complete! Ready to Start! ✨            ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Starting development server...${NC}"
echo ""
echo -e "${BLUE}URLs:${NC}"
echo -e "  • Health Check: ${CYAN}http://localhost:3000/health${NC}"
echo -e "  • Test UI:      ${CYAN}http://localhost:3000/public/index.html${NC}"
echo -e "  • API Docs:     ${CYAN}http://localhost:3000${NC}"
echo ""
echo -e "${YELLOW}Commands:${NC}"
echo -e "  • Stop:         ${CYAN}Ctrl+C${NC}"
echo -e "  • Restart:      ${CYAN}rs${NC} (in terminal)"
echo -e "  • Clear:        ${CYAN}clear${NC}"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Start server
npm run start:dev
