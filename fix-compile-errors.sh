#!/bin/bash

echo "🔧 컴파일 에러 수정 스크립트"

# 1. 패키지 설치
echo "📦 필요한 패키지 설치 중..."
npm install @nestjs/event-emitter class-transformer class-validator

# 2. shared.bak 폴더 제거
echo "🗑️ 백업 폴더 정리 중..."
rm -rf src/shared.bak
rm -rf src/modules/app/app.module.ts.bak
rm -rf src/modules/app/app.controller.ts.bak
rm -rf src/common/filters/global-exception.filter.ts.bak

# 3. TypeScript 컴파일 확인
echo "🔍 TypeScript 컴파일 확인..."
npx tsc --noEmit

echo "✅ 수정 완료!"
echo "🚀 다음 명령어로 서버를 시작하세요: npm run start:dev"
