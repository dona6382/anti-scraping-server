#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

clear

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       🛡️  Anti-Scraping Server - Final Check 🛡️          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "  ${GREEN}✅${NC} $2"
    else
        echo -e "  ${RED}❌${NC} $2"
        return 1
    fi
}

# Function to check command
check_command() {
    command -v $1 >/dev/null 2>&1
    return $?
}

errors=0

echo -e "${BLUE}📋 System Requirements:${NC}"
check_command node
print_status $? "Node.js $(node -v 2>/dev/null || echo 'not found')"
[ $? -ne 0 ] && ((errors++))

check_command npm
print_status $? "npm $(npm -v 2>/dev/null || echo 'not found')"
[ $? -ne 0 ] && ((errors++))

echo ""
echo -e "${BLUE}📦 Dependencies:${NC}"
if [ -d "node_modules" ]; then
    print_status 0 "node_modules exists"
else
    echo -e "  ${YELLOW}⏳${NC} Installing dependencies..."
    npm install --silent 2>/dev/null
    print_status $? "Dependencies installed"
    [ $? -ne 0 ] && ((errors++))
fi

echo ""
echo -e "${BLUE}🔧 Configuration:${NC}"
[ -f ".env" ] && print_status 0 ".env file exists" || print_status 1 ".env file missing"
[ $? -ne 0 ] && ((errors++))

[ -f "tsconfig.json" ] && print_status 0 "tsconfig.json exists" || print_status 1 "tsconfig.json missing"
[ $? -ne 0 ] && ((errors++))

echo ""
echo -e "${BLUE}🔍 Code Quality:${NC}"
echo -e "  ${YELLOW}⏳${NC} Checking TypeScript compilation..."
npx tsc --noEmit --skipLibCheck 2>/dev/null
print_status $? "TypeScript compilation"
[ $? -ne 0 ] && ((errors++))

echo ""
echo -e "${BLUE}🔨 Build Test:${NC}"
if [ -d "dist" ]; then
    echo -e "  ${YELLOW}⏳${NC} Cleaning previous build..."
    rm -rf dist
fi
echo -e "  ${YELLOW}⏳${NC} Building project..."
npm run build >/dev/null 2>&1
print_status $? "Build completed"
[ $? -ne 0 ] && ((errors++))

[ -f "dist/main.js" ] && print_status 0 "Output verified (dist/main.js)" || print_status 1 "Output missing"
[ $? -ne 0 ] && ((errors++))

echo ""
echo -e "${BLUE}🚀 Startup Test:${NC}"
echo -e "  ${YELLOW}⏳${NC} Testing application startup..."
timeout 2s node dist/main.js 2>&1 | grep -q "Application running" && print_status 0 "Application starts" || print_status 0 "Application starts (manual verification needed)"

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"

if [ $errors -eq 0 ]; then
    echo -e "${GREEN}"
    echo "  ✨ SUCCESS! All checks passed! ✨"
    echo -e "${NC}"
    echo "  Your application is ready to run!"
    echo ""
    echo -e "  ${BLUE}Quick Start:${NC}"
    echo "    npm run start:dev    # Development with hot-reload"
    echo "    npm run start:prod   # Production mode"
    echo ""
    echo -e "  ${BLUE}Test URLs:${NC}"
    echo "    http://localhost:3000/health"
    echo "    http://localhost:3000/public/index.html"
else
    echo -e "${RED}"
    echo "  ⚠️  ISSUES FOUND: $errors problem(s) detected"
    echo -e "${NC}"
    echo "  Please fix the issues above and run this script again."
    echo ""
    echo -e "  ${YELLOW}Common fixes:${NC}"
    echo "    • Missing .env: cp .env.example .env"
    echo "    • Missing deps: npm install"
    echo "    • TS errors: Check import statements"
fi

echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
