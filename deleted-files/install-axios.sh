#!/bin/bash

echo "🔧 axios 패키지 설치 스크립트"

# axios 패키지 설치
echo "📦 axios 패키지 설치 중..."
npm install axios@^1.6.0

# TypeScript 타입 정의 설치 (필요한 경우)
npm install --save-dev @types/axios@^0.14.0

echo "✅ 설치 완료!"
echo "🚀 서버를 재시작하세요: npm run start:dev"
