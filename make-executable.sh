#!/bin/bash

# Make all scripts executable
chmod +x start.sh
chmod +x setup-lint.sh
chmod +x check-code.sh
chmod +x make-executable.sh
chmod +x .husky/pre-commit 2>/dev/null || true

echo "✅ All scripts are now executable"
echo ""
echo "Available scripts:"
echo "  ./check-code.sh  - Check code for errors"
echo "  ./setup-lint.sh  - Setup ESLint & Prettier"
echo "  ./start.sh       - Start the application"
