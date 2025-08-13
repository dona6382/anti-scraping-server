#!/bin/bash

chmod +x *.sh
chmod +x .husky/pre-commit 2>/dev/null || true

echo "✅ All scripts are now executable!"
echo ""
echo "Quick commands:"
echo "  ./run.sh         - Install deps & start server (recommended)"
echo "  ./test-compile.sh - Test TypeScript compilation"
echo "  ./final-check.sh  - Full system check"
echo ""
echo "Start with: ./run.sh"
