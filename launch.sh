#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

clear

# ASCII Art
echo -e "${CYAN}"
cat << "EOF"
     _          _   _       ____                      _             
    / \   _ __ | |_(_)     / ___|  ___ _ __ __ _ _ __(_)_ __   __ _ 
   / _ \ | '_ \| __| |_____\___ \ / __| '__/ _` | '_ \ | '_ \ / _` |
  / ___ \| | | | |_| |_____|___) | (__| | | (_| | |_) | | | | | (_| |
 /_/   \_\_| |_|\__|_|     |____/ \___|_|  \__,_| .__/|_|_| |_|\__, |
                                                 |_|            |___/ 
                           🛡️ Server v0.0.1 🛡️
EOF
echo -e "${NC}"

# Function to print with color
print_step() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check Node.js
print_step "Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_success "Node.js $NODE_VERSION"
else
    print_error "Node.js not found!"
    exit 1
fi

# Check npm
print_step "Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    print_success "npm $NPM_VERSION"
else
    print_error "npm not found!"
    exit 1
fi

# Install dependencies
print_step "Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    if [ $? -eq 0 ]; then
        print_success "Dependencies installed"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
else
    print_success "Dependencies ready"
fi

# Check .env file
print_step "Checking configuration..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_warning ".env created from .env.example"
    else
        print_warning "No .env file found (using defaults)"
    fi
else
    print_success "Configuration loaded"
fi

# TypeScript compilation
print_step "Checking TypeScript..."
npx tsc --noEmit --skipLibCheck 2> /dev/null
if [ $? -eq 0 ]; then
    print_success "TypeScript OK"
else
    print_warning "TypeScript has warnings (non-critical)"
fi

# Build
print_step "Building application..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ] && [ -f "dist/main.js" ]; then
    print_success "Build complete"
else
    print_warning "Build incomplete (will use ts-node)"
fi

echo ""
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}         🚀 Application Ready to Launch! 🚀${NC}"
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Display configuration
echo -e "${CYAN}Configuration:${NC}"
echo -e "  • Port:        ${YELLOW}3000${NC}"
echo -e "  • Environment: ${YELLOW}development${NC}"
echo -e "  • Redis:       ${YELLOW}optional (memory fallback)${NC}"
echo -e "  • Rate Limit:  ${YELLOW}20 req/10sec${NC}"
echo ""

echo -e "${CYAN}Security Features:${NC}"
echo -e "  ✓ IP Blacklisting"
echo -e "  ✓ User-Agent Filtering"
echo -e "  ✓ Rate Limiting"
echo -e "  ✓ Honeypot Protection"
echo -e "  ✓ Headless Browser Detection"
echo ""

echo -e "${CYAN}Available URLs:${NC}"
echo -e "  • API:         ${GREEN}http://localhost:3000${NC}"
echo -e "  • Health:      ${GREEN}http://localhost:3000/health${NC}"
echo -e "  • Test UI:     ${GREEN}http://localhost:3000/public/index.html${NC}"
echo ""

echo -e "${CYAN}Commands:${NC}"
echo -e "  • Stop server: ${YELLOW}Ctrl+C${NC}"
echo -e "  • Restart:     ${YELLOW}rs${NC} (type in terminal)"
echo ""

echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Starting server...${NC}"
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Start the server
exec npm run start:dev
