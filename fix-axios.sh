#!/bin/bash

# Update axios types
npm uninstall @types/axios
npm install --save axios@latest

echo "Updated axios. Testing compilation..."
npm run build
