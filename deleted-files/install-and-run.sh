#!/bin/bash

echo "🔧 컴파일 에러 최종 수정 스크립트"

# 1. 패키지 설치
echo "📦 필요한 패키지 설치 중..."
npm install @nestjs/event-emitter@^2.0.0 class-transformer@^0.5.1 class-validator@^0.14.0

# 2. TypeScript 컴파일 확인
echo "🔍 TypeScript 컴파일 확인..."
npx tsc --noEmit

# 3. 개발 서버 시작
echo "✅ 수정 완료!"
echo "🚀 개발 서버를 시작합니다..."
npm run start:dev
