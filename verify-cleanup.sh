#!/bin/bash

echo "🔍 프로젝트 정리 검증"
echo "===================="
echo ""

# 1. 주요 파일 존재 확인
echo "1. 주요 파일 확인:"
files=(
    "package.json:📦"
    "README.md:📖" 
    "start.sh:🚀"
    "start-server.sh:🔧"
    "src/app.module.ts:⚙️"
    "src/main.ts:🏗️"
)

for item in "${files[@]}"; do
    IFS=':' read -r file emoji <<< "$item"
    if [ -f "$file" ]; then
        echo "  ✅ $emoji $file"
    else
        echo "  ❌ $emoji $file (누락)"
    fi
done

echo ""

# 2. 제거된 파일 확인 
echo "2. 정리 확인:"
removed_files=(
    "GO.sh"
    "launch.sh" 
    "README.v2.md"
    "phase1-complete.sh"
    "congratulations.sh"
)

for file in "${removed_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "  ✅ 🗑️  $file (제거됨)"
    else
        echo "  ⚠️  ⚠️  $file (아직 존재)"
    fi
done

echo ""

# 3. 아카이브 확인
echo "3. 아카이브 확인:"
if [ -d "cleanup-archive" ]; then
    archive_count=$(find cleanup-archive -type f 2>/dev/null | wc -l)
    echo "  ✅ 📦 cleanup-archive/ ($archive_count 개 파일 보관)"
else
    echo "  ❌ 📦 cleanup-archive/ (누락)"
fi

echo ""

# 4. 패키지 정보 확인
echo "4. 프로젝트 정보:"
if [ -f "package.json" ]; then
    name=$(grep '"name"' package.json | cut -d'"' -f4)
    version=$(grep '"version"' package.json | cut -d'"' -f4)
    echo "  📦 $name v$version"
else
    echo "  ❌ package.json 정보 읽기 실패"
fi

echo ""

# 5. 시작 스크립트 실행 권한 확인
echo "5. 실행 권한 확인:"
if [ -x "start.sh" ]; then
    echo "  ✅ 🚀 start.sh 실행 가능"
else
    echo "  ⚠️  🚀 start.sh 권한 없음 (chmod +x start.sh 필요)"
fi

if [ -x "start-server.sh" ]; then
    echo "  ✅ 🔧 start-server.sh 실행 가능"
else
    echo "  ⚠️  🔧 start-server.sh 권한 없음 (chmod +x start-server.sh 필요)"
fi

echo ""
echo "🎉 정리 검증 완료!"
echo ""
echo "📋 다음 단계:"
echo "  1. 의존성 설치: npm install"
echo "  2. 서버 시작: ./start.sh" 
echo "  3. 테스트: http://localhost:3000/health"
echo ""
echo "🔗 도움말:"
echo "  • 빠른 시작: ./start.sh"
echo "  • 상세 시작: ./start-server.sh"
echo "  • 문서: cat README.md"
echo "  • 복원: cp cleanup-archive/[파일명] ."