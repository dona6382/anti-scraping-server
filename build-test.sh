#!/bin/bash

echo "Starting TypeScript build test..."
echo "================================"

# TypeScript 컴파일 테스트
echo "Running TypeScript compilation..."
npx tsc --noEmit 2>&1 | head -100

echo ""
echo "================================"
echo "Build test complete!"
