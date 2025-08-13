#!/bin/bash

echo "🚀 Swagger 설치 및 활성화 스크립트"
echo "=================================="

cd /Users/marqvision/Desktop/kch/anti-scraping-server

echo "1️⃣ Swagger 패키지 설치 중..."
npm install @nestjs/swagger@^7.1.10

if [ $? -eq 0 ]; then
    echo "✅ Swagger 패키지 설치 완료!"
    
    echo ""
    echo "2️⃣ Swagger 코드 활성화 중..."
    
    # main.ts에서 Swagger import 주석 해제
    sed -i '' 's|// import { DocumentBuilder, SwaggerModule } from|import { DocumentBuilder, SwaggerModule } from|g' src/main.ts
    
    # main.ts에서 Swagger 설정 주석 해제
    sed -i '' 's|// TODO: Setup Swagger documentation after package installation|// Setup Swagger documentation|g' src/main.ts
    sed -i '' 's|/\*|/* SWAGGER_START|g' src/main.ts
    sed -i '' 's|\*/|SWAGGER_END */|g' src/main.ts
    sed -i '' '/SWAGGER_START/,/SWAGGER_END/s|/\* SWAGGER_START||g' src/main.ts
    sed -i '' '/SWAGGER_START/,/SWAGGER_END/s|SWAGGER_END \*/||g' src/main.ts
    
    echo "✅ Swagger 코드 활성화 완료!"
    
    echo ""
    echo "🎉 설치 완료!"
    echo "========================"
    echo "📚 Swagger 문서: http://localhost:3000/api-docs"
    echo "🔄 서버를 재시작하세요: npm run start:dev"
    echo ""
    
else
    echo "❌ Swagger 패키지 설치 실패!"
    echo "수동으로 설치해 주세요: npm install @nestjs/swagger@^7.1.10"
fi
