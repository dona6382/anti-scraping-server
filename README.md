# 🛡️ Anti-Scraping Server

> 모듈형 아키텍처와 포괄적인 보안 기능을 갖춘 프로덕션 레디 안티 스크래핑 솔루션

## 📋 목차

- [주요 기능](#-주요-기능)
- [빠른 시작](#-빠른-시작)
- [API 문서](#-api-문서)
- [프로젝트 구조](#-프로젝트-구조)
- [환경 설정](#-환경-설정)
- [개발](#-개발)
- [테스트](#-테스트)
- [Docker](#-docker)
- [모니터링](#-모니터링)

## ✨ 주요 기능

### 보안 기능
- 🔒 **IP 차단** - Redis/메모리 캐시를 활용한 동적 IP 차단
- 🤖 **봇 탐지** - User-Agent 필터링 및 패턴 매칭
- ⚡ **요청 제한** - IP별 요청 속도 제한
- 🍯 **허니팟 보호** - 자동화 도구를 잡아내는 숨겨진 필드
- 👻 **헤드리스 브라우저 탐지** - Puppeteer, Selenium 등 차단
- 🔍 **클라이언트 분석** - 고급 핑거프린팅 및 위험 점수 산정

### 시스템 기능
- 📊 실시간 보안 통계
- 🔧 동적 설정 관리
- 📈 성능 모니터링
- 🚀 자동 확장 가능한 아키텍처

## 🚀 빠른 시작

### 자동 설치 및 실행
```bash
# 프로젝트 클론
git clone [repository-url]
cd anti-scraping-server

# 실행 권한 부여 및 서버 시작
chmod +x start.sh && ./start.sh
```

### 수동 설치
```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run start:dev

# 프로덕션 빌드 및 실행
npm run build
npm run start:prod
```

서버 접속: http://localhost:3000

## 📚 API 문서

### 상태 확인
| 메소드 | 경로 | 설명 |
|--------|------|------|
| GET | `/health` | 기본 상태 확인 |
| GET | `/health/detailed` | 상세 시스템 메트릭 |

### 공개 API
| 메소드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/public/data` | 공개 데이터 접근 |
| GET | `/api/public/health` | 공개 상태 정보 |

### 관리자 API
| 메소드 | 경로 | 설명 |
|--------|------|------|
| GET | `/admin/system/info` | 시스템 정보 조회 |
| GET | `/admin/security/statistics` | 보안 통계 조회 |
| POST | `/admin/security/blacklist/ip` | IP 차단 추가 |
| DELETE | `/admin/security/blacklist/ip/:ip` | IP 차단 해제 |

### 테스트 API
| 메소드 | 경로 | 설명 |
|--------|------|------|
| GET | `/test` | 기본 기능 테스트 |
| GET | `/test/security-full` | 전체 보안 기능 테스트 |

## 📁 프로젝트 구조

```
src/
├── core/               # 핵심 인프라
│   ├── cache/         # 캐시 관리
│   ├── config/        # 설정 관리
│   ├── database/      # 데이터베이스 연결
│   └── types/         # 타입 정의
│
├── common/            # 공통 컴포넌트
│   ├── guards/        # 보안 가드
│   ├── filters/       # 예외 필터
│   ├── services/      # 공통 서비스
│   └── utils/         # 유틸리티
│
├── features/          # 비즈니스 모듈
│   ├── admin/         # 관리자 기능
│   ├── auth/          # 인증
│   ├── client-info/   # 클라이언트 정보
│   ├── health/        # 헬스체크
│   ├── public/        # 공개 API
│   ├── security/      # 보안 기능
│   └── testing/       # 테스트 엔드포인트
│
├── api/               # API 버전 관리
│   └── v1/           # v1 API
│
└── legacy/            # 레거시 호환성
```

## ⚙️ 환경 설정

`.env.example`을 `.env`로 복사 후 설정:

### 기본 설정
```env
# 서버 설정
PORT=3000
NODE_ENV=development

# 보안 설정
SECURITY_STRICT_MODE=false
BLOCKED_USER_AGENTS=scrapy,python-requests,curl,bot

# 요청 제한
THROTTLE_TTL=60
THROTTLE_LIMIT=20
```

### Redis 설정 (선택사항)
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=
```

### 고급 보안 설정
```env
# reCAPTCHA (선택사항)
RECAPTCHA_SECRET_KEY=your-secret-key
RECAPTCHA_SCORE_THRESHOLD=0.5

# Honeypot
HONEYPOT_FIELD_NAME=_hp
HONEYPOT_ENABLED=true

# IP 차단
IP_BLACKLIST_TTL=3600
IP_BLACKLIST_ENABLED=true
```

## 🔧 개발

### 코드 품질
```bash
# 린트 실행
npm run lint

# 코드 포맷팅
npm run format

# TypeScript 체크
npm run type-check
```

### 유용한 스크립트
```bash
# 빌드 테스트
./build-test.sh

# TypeScript 오류 수정
./fix-typescript-errors.sh

# 정리 검증
./verify-cleanup.sh
```

## 🧪 테스트

```bash
# 단위 테스트
npm test

# 테스트 커버리지
npm run test:cov

# E2E 테스트
npm run test:e2e

# 보안 기능 테스트
curl http://localhost:3000/test/security-full
```

## 🐳 Docker

### Docker Compose로 실행
```bash
# 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f app

# 서비스 중지
docker-compose down
```

### Docker 이미지 빌드
```bash
docker build -t anti-scraping-server .
docker run -p 3000:3000 anti-scraping-server
```

## 📈 모니터링

서버는 다음과 같은 내장 모니터링 기능을 제공합니다:

- **시스템 상태**: CPU, 메모리, 디스크 사용량
- **보안 이벤트**: 실시간 위협 탐지 및 로깅
- **성능 메트릭**: 응답 시간, 처리량, 에러율
- **캐시 통계**: 히트율, 메모리 사용량

### 모니터링 엔드포인트
- `/health/detailed` - 상세 시스템 메트릭
- `/admin/system/info` - 시스템 정보
- `/admin/security/statistics` - 보안 통계

## 🤝 기여

1. 저장소 포크
2. 기능 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 변경사항 커밋 (`git commit -m 'Add amazing feature'`)
4. 브랜치 푸시 (`git push origin feature/amazing-feature`)
5. Pull Request 생성

## 📄 라이선스

MIT License - 자세한 내용은 LICENSE 파일 참조

## 🛠️ 기술 스택

- **Framework**: NestJS
- **Language**: TypeScript
- **Cache**: Redis / In-Memory
- **Database**: PostgreSQL
- **Container**: Docker
- **Testing**: Jest

---

**Built with ❤️ using NestJS, TypeScript, and Redis**
