#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Quick Build Test${NC}"
echo "===================="

# Clean previous build
echo -e "${YELLOW}🧹 Cleaning previous build...${NC}"
rm -rf dist

# Check TypeScript compilation
echo -e "${YELLOW}🔧 Testing TypeScript compilation...${NC}"
npx tsc --noEmit --skipLibCheck

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ TypeScript OK${NC}"
else
    echo -e "${RED}❌ TypeScript errors found${NC}"
    echo ""
    echo "Common fixes:"
    echo "  1. Check import statements"
    echo "  2. Verify all types are defined"
    echo "  3. Run 'npm install' if packages are missing"
    exit 1
fi

# Try to build
echo -e "${YELLOW}🔨 Building...${NC}"
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful!${NC}"
    echo ""
    echo "You can now run:"
    echo "  npm run start:prod"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
