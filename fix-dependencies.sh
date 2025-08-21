#!/bin/bash

echo "Removing old @types/axios and updating dependencies..."

# Remove @types/axios if it exists
npm uninstall @types/axios

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
npm install

echo "Dependencies updated. Testing compilation..."
npm run build