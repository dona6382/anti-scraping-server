# Anti-Scraping Server

> Production-grade web scraping defense system with 7-layer security chain.
> Built with NestJS + TypeScript + PostgreSQL + Redis.

## Overview (English)

This project is a multi-layer bot detection and blocking server designed to defend web applications against scraping, credential stuffing, and automated abuse. Every incoming request passes through a 6-stage security guard chain — rate limiting, IP/CIDR blacklisting with automatic escalation, User-Agent pattern filtering, headless browser detection (9-signal weighted scoring for Puppeteer/Selenium/PhantomJS), a JavaScript Proof-of-Work challenge paired with browser fingerprinting, and finally the route handler itself. The system is built to stop not only naive bots but also sophisticated attackers who rotate proxies or spoof browser environments.

The architecture follows a strict layered design: a global Core module (config, cache, database), a shared Common module (guards, services, utilities), and isolated Feature modules (auth, admin, analysis, realtime, etc.). Redis serves as the primary cache with automatic in-memory fallback, and all guards follow a fail-open strategy — if an infrastructure dependency is down, requests are allowed through with full logging rather than causing an outage. JWT authentication supports access/refresh token rotation, RBAC, and account lockout. A real-time WebSocket dashboard streams security events to authenticated admins.

Code quality was enforced through a **5-round agent security review process**: design review, pre-implementation security audit, TDD implementation, dual code review (type safety + security testing), and PM sign-off — with any issues cycling back through implementation. The test suite includes 135 unit tests across 10 suites and 28 end-to-end integration tests covering the full security chain.

## Security Chain

```
Request
  │
  ▼
┌─────────────────────┐
│ 1. Rate Limiting     │  IP-based request throttling (configurable window + limit)
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 2. IP Blacklist      │  Dynamic IP/CIDR blocking + auto-ban escalation + threat score pre-block
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 3. User-Agent Filter │  Bot/scraper UA pattern matching (Googlebot whitelisted)
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 4. Headless Detect   │  9-signal weighted scoring (Puppeteer, Selenium, PhantomJS, etc.)
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 5. Behavioral Guard   │  Real-time request interval CV analysis (auto-blocks mechanical patterns)
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 6. JS Challenge      │  Proof-of-Work + browser fingerprint (defeats proxy rotation)
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 7. Route Handler     │  Business logic (JWT/RBAC auth applied per-route)
└─────────────────────┘
```

## Key Features

- **7-Layer Guard Chain** — Every request passes through six global security guards before reaching any route handler, all registered as `APP_GUARD` for zero-config coverage.
- **JS Challenge with Proof-of-Work** — Clients must solve a SHA-256 PoW puzzle and submit a canvas/navigator fingerprint; cookies are HMAC-signed, one-time-use, and subnet-bound.
- **Threat Scoring Engine** — Per-IP threat scores with weighted violations (LOW=5 to CRITICAL=50), 1-hour TTL decay, and automatic pre-blocking at score 70+.
- **Automatic IP Ban Escalation** — 10 violations in 15 min = 30-min ban; 20 = 1 hour; 50 = 24 hours. Supports manual IP/CIDR management via admin API.
- **Behavioral Analysis** — Request interval coefficient-of-variation (CV) for bot detection, attack pattern clustering, and similar-pattern IP matching.
- **Headless Browser Detection** — 9 weighted signals detect automation frameworks, including navigator property checks, WebDriver flags, and plugin/language anomalies.
- **Real-Time Dashboard** — WebSocket-powered security event stream with JWT + admin role authentication.
- **GeoIP / VPN / Tor Detection** — Flags datacenter IP ranges (AWS, GCP, DigitalOcean) and known VPN/proxy service subnets.
- **Fail-Open Resilience** — Guards gracefully degrade on infrastructure failure (Redis down, DB timeout) — requests pass through with full incident logging.
- **Cache-First Architecture** — Redis primary with automatic in-memory fallback via factory pattern; no configuration change needed.
- **5-Round Security Review** — Every feature goes through design, security audit, TDD implementation, dual review, and PM sign-off before merge.

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+ (optional — falls back to in-memory cache)

### Install & Run

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET, DB credentials at minimum

# Start development server
npm run start:dev
```

### Endpoints

- API: http://localhost:3000
- Swagger Docs: http://localhost:3000/api-docs
- Test UI: http://localhost:3000/public
- Health Check: http://localhost:3000/health

### Docker

```bash
export JWT_SECRET=your-secret-key
export IP_HASH_SALT=your-salt

docker-compose up -d
# Services: app (3000) + postgres (5432) + redis (6379) + redis-commander (8081)
```

### Test

```bash
npm test               # 135 unit tests
npm run test:e2e       # 28 integration tests
npm run test:cov       # Coverage report
```

---

## 한국어 문서 (Korean Documentation)

7단계 보안 체인을 갖춘 웹 스크래핑/봇 탐지 및 차단 서버.
NestJS + TypeScript + PostgreSQL + Redis 기반.

## 기술 스택

| 영역 | 기술 |
|------|------|
| Framework | NestJS 10 (Express) |
| Language | TypeScript 5 |
| Database | PostgreSQL 16 (TypeORM) |
| Cache | Redis 7 / In-Memory fallback |
| Auth | JWT (access 15m + refresh 7d) + bcrypt + RBAC + account lockout |
| Security | helmet, throttler, IP/CIDR blacklist, UA filter, headless detection, JS challenge, fingerprint |
| Realtime | WebSocket (Socket.io) — 보안 이벤트 실시간 스트림 |
| Validation | class-validator + class-transformer |
| API Docs | Swagger (OpenAPI 3.0) |
| Container | Docker Compose |
| Test | Jest (138 unit + 28 e2e) |

## 보안 체인 (7단계)

```
Request → ThrottlerGuard → IpBlacklistGuard → UserAgentGuard → HeadlessBrowserGuard → BehavioralGuard → ChallengeGuard → Route Handler
```

| # | 레이어 | 설명 | 적용 범위 |
|---|--------|------|----------|
| 1 | **Rate Limiting** | IP별 요청 속도 제한 (configurable) | 전역 (APP_GUARD) |
| 2 | **IP Blacklist** | 동적 IP/CIDR 차단 + 자동 차단 + 위협 점수 사전 차단 | 전역 (APP_GUARD) |
| 3 | **User-Agent Filter** | 봇/스크래퍼 UA 패턴 매칭 + Googlebot 허용 | 전역 (APP_GUARD) |
| 4 | **Headless Detection** | 9개 시그널 가중치 점수제 (Puppeteer, Selenium, PhantomJS 등) | 전역 (APP_GUARD) |
| 5 | **Behavioral Guard** | 실시간 요청 간격 CV 분석 — 기계적 패턴 자동 차단 | 전역 (APP_GUARD) |
| 6 | **JS Challenge** | Proof-of-Work + Browser Fingerprint (프록시 회전 방어) | 전역 (APP_GUARD) |
| 7 | **Route Handler** | 비즈니스 로직 (JWT/RBAC 인증은 라우트별) | 라우트별 |

### JS Challenge + Browser Fingerprint (v2.4.0)
프록시만 바꿔서 IP 기반 차단을 우회하는 공격에 대응:

1. 유효한 쿠키 없는 요청 → ChallengeGuard가 PoW 챌린지 HTML 반환
2. 브라우저가 JavaScript 실행: Canvas/Navigator 핑거프린트 생성 + SHA-256 PoW 풀이
3. 서버에 제출 → HMAC 서명, IP 서브넷, 일회용 토큰 검증
4. 통과 시 서명된 쿠키 발급 (24h, /24 서브넷 바인딩, HttpOnly)

**보안 특성:**
- HMAC-SHA256 토큰 서명 + `crypto.timingSafeEqual` (timing attack 방어)
- Atomic `getAndDelete`로 토큰 일회용 보장 (TOCTOU 방지)
- Cookie HMAC 128-bit + IP 서브넷 바인딩
- XSS 방어 (`JSON.stringify` + `\u003c` escape)
- `CHALLENGE_SECRET` 프로덕션 필수 환경변수

### 추가 보안 기능
- **자동 IP 차단**: 15분 내 위반 10회→30분, 20회→1시간, 50회→24시간 단계별 차단
- **위협 점수 시스템**: IP별 위협 점수 관리 (가중치: LOW=5, MEDIUM=15, HIGH=30, CRITICAL=50), 1시간 TTL 감쇠, 70점 이상 사전 차단
- **GeoIP / VPN / Tor 탐지**: 데이터센터 IP 대역 (AWS, GCP, DO 등), VPN 서비스 대역 자동 탐지
- **요청 패턴 분석**: 요청 간격 변동계수(CV) 기반 봇 탐지, 공격 패턴 클러스터링, 유사 패턴 IP 매칭
- **실시간 대시보드**: WebSocket으로 보안 이벤트 실시간 스트림 (JWT+admin 인증)

## 빠른 시작

### 사전 요구사항
- Node.js 18+
- PostgreSQL 14+
- Redis 7+ (선택, 없으면 in-memory fallback)

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일에서 JWT_SECRET, DB 정보 수정

# 개발 서버 실행
npm run start:dev
```

서버 접속:
- API: http://localhost:3000
- Swagger: http://localhost:3000/api-docs
- Test UI: http://localhost:3000/public
- Health: http://localhost:3000/health

### Docker Compose

```bash
# JWT_SECRET, IP_HASH_SALT 설정 필요
export JWT_SECRET=your-secret-key
export IP_HASH_SALT=your-salt

docker-compose up -d
```

서비스: app (3000) + postgres (5432) + redis (6379) + redis-commander (8081)

## API 엔드포인트

### Public (인증 불필요)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | 서버 상태 |
| GET | `/health` | 기본 헬스체크 |
| GET | `/health/detailed` | 상세 헬스체크 (DB, Redis, CPU, Memory) |
| GET | `/health/live` | Kubernetes liveness probe |
| GET | `/health/ready` | Kubernetes readiness probe |
| GET | `/api/public/data` | 공개 데이터 |
| GET | `/api/public/search/:query` | 검색 |
| GET | `/api/public/stats` | 공개 통계 |

### Auth (인증)
| Method | Path | 설명 |
|--------|------|------|
| POST | `/auth/login` | 로그인 (access + refresh token 발급) |
| POST | `/auth/register` | 회원가입 |
| POST | `/auth/refresh` | Refresh token으로 access token 재발급 |
| POST | `/auth/change-password` | 비밀번호 변경 (JWT 필요, tokenVersion++) |

### Challenge
| Method | Path | 설명 |
|--------|------|------|
| POST | `/challenge/verify` | 브라우저 챌린지 검증 (PoW + Fingerprint) |

### Admin (JWT + admin 역할 필요)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/admin/system/info` | 시스템 정보 |
| GET | `/admin/system/stats` | 보안 통계 |
| GET | `/admin/security/events` | 보안 이벤트 로그 |
| GET | `/admin/config` | 설정 조회 |
| DELETE | `/admin/cache` | 캐시 초기화 |
| POST | `/admin/system/health-check` | 강제 헬스체크 |
| POST | `/admin/security/blacklist/ip` | IP 차단 |
| DELETE | `/admin/security/blacklist/ip/:ip` | IP 차단 해제 |
| GET | `/admin/security/statistics` | IP 차단 통계 |

### Analysis (JWT + admin 역할 필요)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/admin/analysis/time-distribution` | 시간대별 차단 분포 |
| GET | `/admin/analysis/top-blocked-ips` | 상위 차단 IP 순위 |
| GET | `/admin/analysis/top-blocked-uas` | 상위 차단 User-Agent 순위 |
| GET | `/admin/analysis/endpoint-stats` | 엔드포인트별 차단 통계 |
| GET | `/admin/analysis/request-intervals/:ip` | IP별 요청 간격 분석 (봇 탐지) |
| GET | `/admin/analysis/attack-clusters` | 공격 패턴 클러스터링 |
| GET | `/admin/analysis/similar-patterns/:ip` | 유사 패턴 IP 매칭 |
| GET | `/admin/analysis/threat-score/:ip` | IP 위협 점수 조회 |

### Testing
| Method | Path | 설명 |
|--------|------|------|
| GET | `/test` | 기본 기능 테스트 |
| GET | `/test/security-full` | 전체 보안 레이어 테스트 |
| POST | `/test/action` | 폼 제출 테스트 |

## 프로젝트 구조

```
src/
├── main.ts                     # Bootstrap (helmet, CORS, validation, shutdown)
├── app.module.ts               # Root (전역 Guard/Filter 등록)
│
├── core/                       # 인프라 계층 (@Global)
│   ├── config/                 # 환경변수 관리 (AppConfigService)
│   ├── cache/                  # Redis/Memory 캐시 (Factory 패턴)
│   ├── database/               # TypeORM + PostgreSQL
│   │   └── entities/           # User, IpBlacklist, SecurityEvent, SystemConfig
│   └── types/                  # 전역 타입 정의 (단일 소스)
│
├── common/                     # 공유 계층 (@Global)
│   ├── guards/                 # 보안 Guard (Base, UserAgent, IpBlacklist, Headless, Challenge)
│   ├── filters/                # UnifiedExceptionFilter
│   ├── services/               # IpBlacklist, SecurityEvent, ThreatScore, Challenge
│   ├── exceptions/             # 통합 예외 계층 (BaseApplicationException)
│   ├── constants/              # 에러 코드, 보안 상수, threshold 상수
│   └── utils/                  # RequestUtils, ResponseBuilder, CidrUtils, PaginationUtils
│
├── features/                   # 비즈니스 모듈
│   ├── auth/                   # JWT 인증 (access+refresh) + RBAC + account lockout
│   ├── admin/                  # 시스템 관리
│   ├── security/               # IP/CIDR 차단 관리
│   ├── health/                 # 헬스체크 (DB/Redis 실제 체크)
│   ├── public/                 # 공개 API
│   ├── client-info/            # 클라이언트 핑거프린팅 + GeoIP
│   ├── analysis/               # 위협 분석 (패턴 분석, 봇 탐지, Admin API)
│   ├── challenge/              # JS Challenge 검증 엔드포인트
│   ├── realtime/               # WebSocket 실시간 보안 이벤트 (@Global)
│   └── testing/                # 보안 테스트 (프로덕션 비활성화)
│
└── api/v1/                     # API 버전 관리
```

## 환경변수

### 필수
```env
JWT_SECRET=your-jwt-secret          # JWT 서명 키 (없으면 부팅 실패)
DB_HOST=localhost                    # PostgreSQL 호스트
DB_PORT=5432
DB_USERNAME=p_user
DB_PASSWORD=p_pw
DB_DATABASE=anti_scraping
```

### 선택
```env
IP_HASH_SALT=your-salt              # IP 해시 솔트 (없으면 랜덤 생성)
CHALLENGE_SECRET=your-challenge-key # Challenge HMAC 키 (프로덕션 필수)
API_KEY=your-api-key                # API key bypass용 (Challenge Guard)
INITIAL_ADMIN_PASSWORD=Admin@1234   # 초기 admin 비밀번호
REDIS_HOST=localhost                # Redis (없으면 in-memory)
SECURITY_STRICT_MODE=false          # strict 모드
DB_SYNCHRONIZE=true                 # 개발용 스키마 자동 동기화
```

전체 목록은 `.env.example` 참조.

## 개발

```bash
npm run start:dev      # 개발 서버 (watch 모드)
npm run build          # 프로덕션 빌드
npm run lint           # ESLint
npm run format         # Prettier
npm test               # Jest 단위 테스트 (10 suites, 135 tests)
npm run test:e2e       # E2E 통합 테스트 (28 tests)
npm run test:cov       # 커버리지 리포트
```

## 아키텍처

### 모듈 의존성
```
CoreModule (Global)         → Config, Cache, Database
    ↓
CommonModule (Global)       → Guards, Services, Throttler, SecurityEvent
    ↓
ApiModule → V1Module        → Auth, Admin, Security, Health, Public, ...
```

### 보안 이벤트 흐름
```
Guard 위반 탐지 → SecurityEventService.log() → PostgreSQL 저장 (비동기)
                → ThreatScoreService.recordViolation() → 위협 점수 갱신
                → RealtimeGateway.broadcast() → WebSocket 실시간 알림
                → Logger 출력 (IP 해시화)
```

### 캐시 전략
```
CacheFactory → REDIS_HOST 설정됨? → RedisCacheService
                                  → MemoryCacheService (fallback)
```

## 라이선스

MIT
