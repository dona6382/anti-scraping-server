#!/bin/bash

echo "🔧 Axios 문제 해결 스크립트"

# 1. 기존 node_modules 삭제 및 재설치
echo "📦 패키지 재설치 중..."
rm -rf node_modules package-lock.json
npm install
npm install axios

# 2. axios 버전 확인
echo "📋 설치된 axios 버전:"
npm list axios

# 3. 간단한 버전으로 교체 옵션
echo ""
echo "만약 여전히 에러가 발생하면:"
echo "1) 간단한 버전 사용:"
echo "   cp src/common/services/http.service.simple.ts src/common/services/http.service.ts"
echo ""
echo "2) 또는 fetch 버전 사용:"
echo "   cp src/common/services/http.service.fetch.ts src/common/services/http.service.ts"

echo ""
echo "✅ 완료!"
echo "🚀 서버를 재시작하세요: npm run start:dev"
