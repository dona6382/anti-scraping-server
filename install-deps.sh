#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📦 Installing Required Dependencies${NC}"
echo "===================================="

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

# Install class-validator and class-transformer
echo -e "${YELLOW}Installing class-validator and class-transformer...${NC}"
npm install class-validator class-transformer

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
else
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    echo "Try running: npm install --force"
    exit 1
fi

# Install all other dependencies
echo -e "${YELLOW}Installing all project dependencies...${NC}"
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ All dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠️  Some dependencies may have failed${NC}"
fi

# Check TypeScript compilation
echo ""
echo -e "${YELLOW}🔧 Testing TypeScript compilation...${NC}"
npx tsc --noEmit --skipLibCheck

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ TypeScript compilation successful!${NC}"
    echo ""
    echo "You can now run:"
    echo "  npm run start:dev"
else
    echo -e "${RED}❌ TypeScript errors remain${NC}"
    echo "Please check the errors above"
fi
