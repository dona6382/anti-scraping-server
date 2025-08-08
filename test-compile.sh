#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔧 TypeScript Compilation Test${NC}"
echo "================================"

# Check if TypeScript compiles without errors
npx tsc --noEmit --skipLibCheck

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ All TypeScript errors fixed!${NC}"
    echo ""
    echo "You can now run:"
    echo "  npm run start:dev"
else
    echo ""
    echo -e "${RED}❌ TypeScript errors still exist${NC}"
    exit 1
fi
