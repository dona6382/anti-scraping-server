#!/bin/bash

echo "🧪 Clean Project Test"
echo "===================="

# Test TypeScript compilation
echo "1. Testing TypeScript compilation..."
npx tsc --noEmit --skipLibCheck
if [ $? -eq 0 ]; then
    echo "✅ TypeScript: PASSED"
else
    echo "❌ TypeScript: FAILED"
    exit 1
fi

# Test build
echo "2. Testing build..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Build: PASSED"
else
    echo "❌ Build: FAILED"
    exit 1
fi

# Test if main file exists
if [ -f "dist/main.js" ]; then
    echo "✅ Build output: PASSED"
else
    echo "❌ Build output: FAILED"
    exit 1
fi

echo ""
echo "🎉 All tests passed! Project is clean and working."
echo ""
echo "📊 Cleanup summary:"
echo "  • Archived files: $(find cleanup-archive -type f | wc -l) files"
echo "  • Main directory: $(find . -maxdepth 1 -type f | wc -l) files"
echo "  • Key scripts: start.sh, start-server.sh"
echo "  • Documentation: README.md, QUICK_START.md"
echo ""
echo "🚀 Ready to start: ./start.sh"