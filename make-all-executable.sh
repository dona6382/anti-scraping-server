#!/bin/bash

chmod +x start.sh
chmod +x setup-lint.sh
chmod +x check-code.sh
chmod +x make-executable.sh
chmod +x quick-test.sh
chmod +x verify.sh
chmod +x .husky/pre-commit 2>/dev/null || true

echo "✅ All scripts are now executable"
echo ""
echo "Run ./verify.sh to check if everything works!"
