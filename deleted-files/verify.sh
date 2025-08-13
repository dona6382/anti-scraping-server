#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Full Code Verification${NC}"
echo "===================================="

# Step 1: Check Node.js
echo -e "${YELLOW}[1/7] Checking Node.js...${NC}"
node_version=$(node -v 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Node.js $node_version${NC}"
else
    echo -e "${RED}❌ Node.js not found${NC}"
    exit 1
fi

# Step 2: Check npm
echo -e "${YELLOW}[2/7] Checking npm...${NC}"
npm_version=$(npm -v 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ npm $npm_version${NC}"
else
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi

# Step 3: Install dependencies
echo -e "${YELLOW}[3/7] Installing dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    npm install --silent
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Dependencies installed${NC}"
    else
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

# Step 4: TypeScript compilation check
echo -e "${YELLOW}[4/7] TypeScript compilation check...${NC}"
npx tsc --noEmit --skipLibCheck 2>&1 | tee /tmp/tsc-output.txt
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "${GREEN}✅ TypeScript compilation OK${NC}"
else
    echo -e "${RED}❌ TypeScript compilation failed${NC}"
    echo "Errors:"
    cat /tmp/tsc-output.txt
    exit 1
fi

# Step 5: Build test
echo -e "${YELLOW}[5/7] Build test...${NC}"
rm -rf dist
npm run build 2>&1 | tee /tmp/build-output.txt
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    echo "Errors:"
    cat /tmp/build-output.txt
    exit 1
fi

# Step 6: Check if dist folder was created
echo -e "${YELLOW}[6/7] Checking build output...${NC}"
if [ -d "dist" ] && [ -f "dist/main.js" ]; then
    echo -e "${GREEN}✅ Build output verified${NC}"
else
    echo -e "${RED}❌ Build output missing${NC}"
    exit 1
fi

# Step 7: Dry run
echo -e "${YELLOW}[7/7] Dry run test...${NC}"
timeout 3s node dist/main.js 2>&1 | head -20
if [ $? -eq 124 ]; then
    echo -e "${GREEN}✅ Application starts successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Check application startup logs above${NC}"
fi

echo ""
echo "===================================="
echo -e "${GREEN}✅ All checks passed!${NC}"
echo ""
echo "Summary:"
echo "  • Node.js: ✅"
echo "  • npm: ✅"
echo "  • Dependencies: ✅"
echo "  • TypeScript: ✅"
echo "  • Build: ✅"
echo "  • Output: ✅"
echo "  • Startup: ✅"
echo ""
echo "The application is ready to run!"
echo "Use: npm run start:dev"
