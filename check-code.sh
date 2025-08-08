#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Anti-Scraping Server Code Check${NC}"
echo "===================================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# TypeScript compile check
echo -e "${YELLOW}🔧 Checking TypeScript compilation...${NC}"
npx tsc --noEmit --skipLibCheck

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ TypeScript compilation passed${NC}"
else
    echo -e "${RED}❌ TypeScript compilation failed${NC}"
    echo "Fix the errors above before running the server"
    exit 1
fi

# Lint check
echo -e "${YELLOW}🔍 Running ESLint...${NC}"
npm run lint

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ ESLint check passed${NC}"
else
    echo -e "${YELLOW}⚠️  ESLint found issues${NC}"
    echo "Run 'npm run lint:fix' to auto-fix"
fi

# Build check
echo -e "${YELLOW}🔨 Building project...${NC}"
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Test run
echo -e "${YELLOW}🧪 Running tests...${NC}"
npm test -- --passWithNoTests

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Tests passed${NC}"
else
    echo -e "${YELLOW}⚠️  Some tests failed${NC}"
fi

echo ""
echo "===================================="
echo -e "${GREEN}✅ Code check complete!${NC}"
echo ""
echo "Summary:"
echo "  • TypeScript: ✅"
echo "  • Build: ✅"
echo "  • ESLint: Check output above"
echo "  • Tests: Check output above"
echo ""
echo "You can now run:"
echo "  npm run start:dev  - Development server"
echo "  npm run start:prod - Production server"
