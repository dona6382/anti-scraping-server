# 🚀 Swagger API 문서 설치 가이드

## 📋 현재 상태
서버는 정상적으로 실행되지만 Swagger 문서는 아직 비활성화 상태입니다.

## 🛠️ 설치 방법

### 방법 1: 자동 설치 스크립트 (권장)
```bash
cd /Users/marqvision/Desktop/kch/anti-scraping-server
chmod +x enable-swagger.sh
./enable-swagger.sh
```

### 방법 2: 수동 설치
```bash
cd /Users/marqvision/Desktop/kch/anti-scraping-server
npm install @nestjs/swagger@^7.1.10
```

## 📚 설치 후 확인
1. 서버 재시작: `npm run start:dev`
2. Swagger 문서 접속: `http://localhost:3000/api-docs`

## 🎯 현재 사용 가능한 API

### 🟢 활성화된 엔드포인트:
- **GET /api/v1/sample/user** - 샘플 JSON 데이터
- **GET /api/v1/products** - 제품 목록 (페이지네이션)
- **GET /health** - 헬스 체크
- **GET /health/detailed** - 상세 헬스 체크

### 🛡️ 보안 기능:
- IP 블랙리스트 보호 (모든 API)
- User-Agent 필터링
- Rate Limiting (API별 다른 제한)
- 헤드리스 브라우저 감지

### 📊 Rate Limits:
- Sample Data: 50회/분
- Products: 30회/분
- Health: 제한 없음

## 🔧 문제 해결

### Swagger 패키지가 설치되지 않는 경우:
```bash
npm cache clean --force
npm install
npm install @nestjs/swagger@^7.1.10
```

### 권한 문제가 있는 경우:
```bash
sudo chmod +x enable-swagger.sh
```

## 📖 설치 완료 후
설치가 완료되면 다음과 같은 Swagger 기능을 사용할 수 있습니다:

- 📝 자동 API 문서화
- 🧪 실시간 API 테스트
- 📊 요청/응답 스키마 확인
- 🔒 보안 수준 정보
- ⚡ Rate Limit 정보

---
**💡 Tip:** Swagger 설치 전에도 모든 API는 정상적으로 작동합니다!
