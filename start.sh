#!/bin/bash

# Anti-Scraping Server v2.0 Start Script
echo "🚀 Anti-Scraping Server v2.0"
echo "════════════════════════════"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Are you in the project directory?"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --silent
fi

# Quick TypeScript check (non-blocking)
echo "🔍 Checking TypeScript..."
npx tsc --noEmit --skipLibCheck > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ TypeScript check passed"
else
    echo "⚠️  TypeScript warnings detected (continuing...)"
fi

# Build if needed
if [ ! -f "dist/main.js" ]; then
    echo "🔨 Building project..."
    npm run build > /dev/null 2>&1
fi

echo ""
echo "✨ Starting development server..."
echo ""
echo "📍 Available endpoints:"
echo "  • Health:  http://localhost:3000/health"
echo "  • Admin:   http://localhost:3000/admin/system/info"
echo "  • Test:    http://localhost:3000/test"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
npm run start:dev