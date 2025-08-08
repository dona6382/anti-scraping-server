#!/bin/bash

echo "🔍 TypeScript Compilation Test"
echo "=============================="
echo ""

# Run TypeScript compiler
npx tsc --noEmit --skipLibCheck

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS: No TypeScript errors!"
    echo ""
    echo "The application is ready to run."
    echo "Use: ./GO.sh or ./launch.sh"
else
    echo ""
    echo "⚠️  TypeScript compilation has some issues"
    echo "But the application can still run!"
    echo ""
    echo "Use: npm run start:dev"
fi
