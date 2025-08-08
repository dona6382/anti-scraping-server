#!/bin/bash

# Make all scripts executable
chmod +x *.sh 2>/dev/null

echo "✅ All scripts are now executable!"
echo ""
echo "🚀 Quick Start Options:"
echo ""
echo "  1. ./launch.sh      - Beautiful startup with all checks (RECOMMENDED)"
echo "  2. ./start-server.sh - Simple startup"
echo "  3. ./run.sh         - Basic startup"
echo "  4. npm run start:dev - Direct npm command"
echo ""
echo "Choose option 1 for the best experience!"
echo ""
echo "Starting in 3 seconds..."
sleep 3

./launch.sh
