#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Setting up ESLint and Prettier...${NC}"
echo "===================================="

# Install dependencies
echo -e "${YELLOW}📦 Installing ESLint packages...${NC}"
npm install --save-dev \
  @typescript-eslint/eslint-plugin@^8.20.0 \
  @typescript-eslint/parser@^8.20.0 \
  eslint@^8.57.0 \
  eslint-config-prettier@^9.1.0 \
  eslint-plugin-import@^2.31.0 \
  eslint-plugin-prettier@^5.2.2 \
  eslint-import-resolver-typescript@^3.6.3 \
  prettier@^3.4.2 \
  husky@^9.1.7 \
  lint-staged@^15.3.0

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install packages${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Packages installed${NC}"

# Initialize husky
echo -e "${YELLOW}🐕 Initializing Husky...${NC}"
npx husky install
npx husky add .husky/pre-commit "npm run lint:staged"
chmod +x .husky/pre-commit

echo -e "${GREEN}✅ Husky configured${NC}"

# Run initial lint
echo -e "${YELLOW}🔍 Running initial lint check...${NC}"
npm run lint

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Lint issues found. Running auto-fix...${NC}"
    npm run lint:fix
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Some lint issues could not be auto-fixed${NC}"
        echo "Please fix them manually and run 'npm run lint' again"
    else
        echo -e "${GREEN}✅ Lint issues auto-fixed${NC}"
    fi
else
    echo -e "${GREEN}✅ No lint issues found${NC}"
fi

# Format code
echo -e "${YELLOW}✨ Formatting code with Prettier...${NC}"
npm run format

echo ""
echo "===================================="
echo -e "${GREEN}✅ ESLint setup complete!${NC}"
echo ""
echo "Available commands:"
echo "  npm run lint       - Check for lint issues"
echo "  npm run lint:fix   - Auto-fix lint issues"
echo "  npm run format     - Format code with Prettier"
echo ""
echo "Tips:"
echo "  • VS Code will auto-format on save"
echo "  • Git commits will trigger lint-staged"
echo "  • Check .eslintrc.js for rule customization"
