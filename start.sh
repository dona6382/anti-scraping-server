#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 Anti-Scraping Server Setup"
echo "===================================="

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo -e "${RED}❌ Node.js version 16 or higher is required${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js version check passed${NC}"

# Check if .env exists
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW}📋 Creating .env from .env.example...${NC}"
        cp .env.example .env
        echo -e "${GREEN}✅ .env file created${NC}"
    else
        echo -e "${RED}❌ No .env or .env.example file found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ .env file exists${NC}"
fi

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Dependencies installed${NC}"
fi

# Check Redis (optional)
echo -e "${YELLOW}🔍 Checking Redis...${NC}"
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo -e "${GREEN}✅ Redis is running${NC}"
    else
        echo -e "${YELLOW}⚠️  Redis is not running (optional)${NC}"
        echo "   To start Redis: redis-server or docker run -d -p 6379:6379 redis"
    fi
else
    echo -e "${YELLOW}ℹ️  Redis not installed (optional)${NC}"
fi

# Build the project
echo -e "${YELLOW}🔨 Building project...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build successful${NC}"

echo ""
echo "===================================="
echo -e "${GREEN}Ready to start!${NC}"
echo ""
echo "Available commands:"
echo "  npm run start:dev  - Start in development mode with hot reload"
echo "  npm run start:prod - Start in production mode"
echo "  npm test          - Run tests"
echo ""
echo "Starting development server..."
npm run start:dev
