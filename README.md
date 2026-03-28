# Anti-Scraping Server

> Production-grade web scraping defense system with 7-layer security chain.
> Built with NestJS + TypeScript + PostgreSQL + Redis.
>
> **Built with AI** — Claude Code를 시니어 개발팀처럼 활용하여 설계·구현·검증한 프로젝트.

## How This Project Was Built

이 프로젝트는 **AI를 도구로 활용**하여 프로덕션 수준의 보안 시스템을 설계하고 구현한 과정을 담고 있습니다.

### AI 활용 전략

단순히 "코드 생성"이 아니라, **5개 전문 에이전트를 시니어 개발팀처럼 구성**하고 각자의 관점에서 반복 검증하는 프로세스를 설계했습니다:

| 에이전트 | 역할 | 기여 |
|----------|------|------|
| **TS Code Reviewer** | 타입 안전성, 코드 일관성, dead code | 매 기능 구현 후 3-pass 심층분석 |
| **NestJS Backend Dev** | 아키텍처, DI, Guard 체인, 성능 | 모듈 설계 + 구현 |
| **Security Researcher** | 공격 벡터, 암호화, timing attack, XSS | 취약점 발견 → 수정 → 재검증 |
| **Security Test Engineer** | 테스트 커버리지, 회귀 방지 | 174 unit + 28 E2E 작성 |
| **Project Manager** | 우선순위, 기능 갭, 종합 판정 | REJECT → APPROVE 사이클 관리 |

### 사람이 한 것 vs AI가 한 것

| 사람 (나) | AI (Claude Code) |
|-----------|-----------------|
| 보안 아키텍처 설계 판단 | 코드 구현 + 테스트 작성 |
| 에이전트 역할/프로세스 설계 | 5개 관점에서 반복 심층분석 |
| 기능 우선순위 결정 | 취약점 발견 + 수정 제안 |
| 실 브라우저 테스트로 런타임 버그 5건 발견 | 버그 원인 분석 + 수정 |
| 최종 승인/거부 판단 | PR 수준의 코드 리뷰 리포트 |

### 품질 관리: REJECT → APPROVE 사이클

모든 주요 기능은 아래 사이클을 거쳤습니다:

```
설계 → 보안 사전 리뷰 → 구현 → 4개 에이전트 심층분석 → 이슈 발견 → 수정 → 재분석 → PM 승인
```

예시 — JS Challenge 시스템:
- **1차 분석**: CRITICAL 2건 + HIGH 4건 발견 → **REJECT**
- **2차 (A그룹 수정 후)**: 7건 해결 확인 → **CONDITIONAL**
- **3차 (B그룹 + 테스트)**: 전부 해결, 47개 테스트 → **APPROVE**
- **4차 (실전 브라우저 테스트)**: 런타임 버그 5건 추가 발견 → 수정 → **APPROVE**
- **5차 (최종)**: Security Researcher 판정 **STRONG**

### AI가 못 찾고 사람이 찾은 버그

Playwright 실전 테스트에서 **AI 에이전트의 단위 테스트가 잡지 못한 런타임 버그 5건**을 발견:

1. IPv6 `::1` 토큰 파싱 — 구분자 `:` 충돌
2. Rate limit 충돌 — 글로벌 ThrottlerGuard가 Challenge verify 차단
3. Cookie URL-encoding — 브라우저가 `:`를 `%3A`로 인코딩
4. fetch() Set-Cookie — 브라우저 보안 정책으로 쿠키 미적용
5. returnUrl null — form hidden field 누락

→ 이 경험은 "AI가 만든 코드도 반드시 실 환경에서 검증해야 한다"는 교훈을 보여줍니다.

---

## Overview

This project is a multi-layer bot detection and blocking server designed to defend web applications against scraping, credential stuffing, and automated abuse. Every incoming request passes through a 7-stage security guard chain — rate limiting, IP/CIDR blacklisting with automatic escalation, User-Agent pattern filtering, headless browser detection (9-signal weighted scoring), real-time behavioral analysis (CV-based bot detection), a JavaScript Proof-of-Work challenge paired with browser fingerprinting, and finally the route handler itself.

The architecture follows a strict layered design: a global Core module (config, cache, database), a shared Common module (guards, services, utilities), and isolated Feature modules (auth, admin, analysis, realtime, etc.). All guards follow a fail-open strategy — if an infrastructure dependency is down, requests pass through with full logging rather than causing an outage.

**Test results:** 174 unit tests (14 suites) + 28 E2E tests. Penetration test: 100% defense rate (10/10 scenarios). Normal user test: 0 false positives (7/7 scenarios).

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
- **AI-Driven Multi-Agent Review** — 5 specialized AI agents (code reviewer, backend dev, security researcher, test engineer, PM) independently analyze every feature through REJECT→APPROVE cycles.
- **Scoreboard (Judge System)** — Real-time attack vs defense scoring dashboard with Guard-layer contribution analysis and improvement recommendations for both sides.

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
npm test               # 174 unit tests (14 suites)
npm run test:e2e       # 28 integration tests
npm run test:cov       # Coverage report
```

---

## 한국어 문서 (Korean Documentation)

7단계 보안 체인을 갖춘 웹 스크래핑/봇 탐지 및 차단 서버.
NestJS + TypeScript + PostgreSQL + Redis 기반.
**AI(Claude Code)를 5개 전문 에이전트로 활용**하여 설계·구현·검증.

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
| Test | Jest (174 unit + 28 e2e) |

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
npm test               # Jest 단위 테스트 (14 suites, 174 tests)
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
