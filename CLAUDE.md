# Anti-Scraping Server

## 절대 규칙

**커밋과 push는 사용자가 명시적으로 요청할 때만 수행한다.**
- 에이전트/PM이 자의적으로 커밋/push 하지 않는다
- "커밋해줘", "푸시해줘" 등 사용자의 직접 요청이 있어야만 실행
- 서브에이전트에게 위임할 때도 "Do NOT commit" 명시 필수
- 빌드/테스트 검증은 자유롭게 하되, git 조작은 사용자 승인 필수

---

## 프로젝트 개요
웹 스크래핑/봇을 탐지하고 차단하는 다층 보안 서버. NestJS 기반 TypeScript 프로젝트.
AI(Claude Code)를 활용하여 공격자/방어자 양쪽 관점으로 반복 검증하며 구축한 프로젝트.

## 기술 스택
- **Framework**: NestJS 10 (Express)
- **Language**: TypeScript 5
- **Database**: PostgreSQL (TypeORM)
- **Cache**: Redis (ioredis) / In-Memory fallback (50K 상한, FIFO eviction)
- **Auth**: JWT (access 15m + refresh 7d) + bcrypt(12) + RBAC + account lockout(5회/15분)
- **CAPTCHA**: Canvas PNG 텍스트 (6글자, 10초 TTL, 5회 실패 시 블랙리스트)
- **Security**: helmet, rate limiting, IP/CIDR blacklist, UA filtering, headless detection (11-signal), behavioral analysis (CV+RPM, MIN_REQUESTS=5), JS challenge + PoW (difficulty 4) + fingerprint, TLS fingerprinting, header order fingerprinting, threat scoring (2h TTL + 24h decay history)
- **Realtime**: WebSocket (Socket.io) — 보안 이벤트 실시간 스트림 (IP 해시 + 인증 전용)
- **Validation**: class-validator + class-transformer (DTO 기반)
- **API Docs**: Swagger (`/api-docs`, 프로덕션 기본 비밀번호 시 비활성화)
- **Container**: Docker Compose (app + postgres + redis)
- **Test**: Jest (187 unit, 16 suites)

## 프로젝트 구조
```
src/
├── main.ts                  # 부트스트랩 (helmet, body limit, graceful shutdown, Swagger)
├── app.module.ts            # 루트 모듈 (전역 Guard 7개 + Filter 등록)
├── app.controller.ts        # 루트 엔드포인트
├── core/                    # 인프라 계층 (@Global)
│   ├── config/              # ConfigModule, AppConfigService, safeParseInt 검증
│   ├── cache/               # Redis/Memory 캐시 (Factory, MAX_SIZE 50K, ReDoS 방지)
│   ├── database/            # TypeORM + PostgreSQL
│   │   └── entities/        # User, SecurityEvent
│   └── types/               # 전역 타입 (단일 소스)
├── common/                  # 공유 계층 (@Global)
│   ├── guards/              # 7개: Throttler, IpBlacklist, UserAgent, HeadlessBrowser, Behavioral, TlsFingerprint, Challenge
│   ├── filters/             # UnifiedExceptionFilter (PayloadTooLarge→413 매핑)
│   ├── services/            # IpBlacklist, SecurityEvent, ThreatScore(decay), Challenge(키분리), PuzzleCaptcha(Canvas)
│   ├── middleware/           # RequestLoggerMiddleware (IP별 뮤텍스, Set O(1))
│   ├── exceptions/          # SecurityException 계층
│   ├── constants/           # error.constants, security.constants, threshold.constants
│   └── utils/               # RequestUtils, ResponseBuilder, PaginationUtils, SystemUtils, CidrUtils
├── features/                # 비즈니스 모듈
│   ├── admin/               # 시스템 관리 (JWT+admin 필수)
│   ├── auth/                # JWT 인증 (login, register, refresh, change-password)
│   ├── security/            # IP/CIDR 차단 CRUD (JWT+admin 필수)
│   ├── health/              # 헬스체크 (DB/Redis 실제 체크)
│   ├── public/              # 공개 API
│   ├── client-info/         # 클라이언트 핑거프린팅 + GeoIP
│   ├── analysis/            # 위협 분석 (패턴 분석, 봇 탐지, Admin API)
│   ├── challenge/           # JS Challenge 검증 엔드포인트
│   ├── honeypot/            # 함정 엔드포인트 (모든 Guard Skip + IpBlacklist Skip)
│   ├── scoreboard/          # 공격/방어 스코어보드 (Admin API)
│   ├── realtime/            # WebSocket 실시간 보안 이벤트 (@Global)
│   └── testing/             # 보안 테스트 (프로덕션 비활성화)
└── api/                     # API 버전 관리 (v1)
```

## 전역 보안 체인
```
모든 요청 → ThrottlerGuard → IpBlacklistGuard → UserAgentGuard → HeadlessBrowserGuard → BehavioralGuard → TlsFingerprintGuard → ChallengeGuard(+CAPTCHA) → Route Handler
```

## 보안 설계 원칙

### 암호화
- HMAC-SHA256 (전체 64자, 절단 없음) + timing-safe 비교 (dummy comparison 포함)
- CHALLENGE_SECRET → COOKIE_SIGN_KEY 파생 (키 분리 원칙)
- CAPTCHA: crypto.randomBytes (Math.random 아님)
- getAndDelete: 원자적 토큰 소비 (Redis GETDEL / MULTI·EXEC fallback)

### 방어 전략
- CAPTCHA-for-all (PUZZLE_THRESHOLD=0): 모든 방문자에게 Canvas PNG CAPTCHA 표시 (AI/OCR 비용 부과)
- JWT 토큰 타입 분리: validateToken()에서 refresh token 거부
- fail-open 전략: 서비스 장애 시 요청 허용, 에러 로깅 (silent catch 없음)
- Honeypot: 모든 Guard Skip (IpBlacklist 포함) — 블랙리스트 IP도 함정에 도달
- 위협 점수 감쇠: 2h TTL + 24h blocked_history (0.7 decay rate, 완전 리셋 방지)

### 인프라 안정성
- Memory Cache: 50K 상한, isEvicting 플래그, FIFO eviction
- Request Logger: IP별 뮤텍스 (try-finally), 5K cap, ACTIVE_IPS Set O(1) + 10K cap
- CAPTCHA 렌더링: 동시 20개 제한 (Canvas CPU 고갈 방지)
- Config: safeParseInt (범위 검증), 프로덕션 시크릿 필수 검증
- PayloadTooLargeError → 413 매핑 (스택 트레이스 노출 방지)

---

## 개발 규칙

### 코드 스타일
- NestJS 공식 컨벤션 (Module, Controller, Service, Guard, Filter)
- DTO는 반드시 class-validator 데코레이터 적용
- 컨트롤러에 raw body type 금지 → DTO 클래스 사용
- 예외는 NestJS 표준 또는 SecurityException 계층 사용

### 아키텍처 원칙
- Core → Common → Features 계층 분리 유지
- @Global 모듈은 Core, Common만 허용
- Feature 모듈 간 직접 의존 금지 (공유 로직은 Common으로)
- 타입 정의는 `core/types/index.ts` 단일 소스

### 보안 원칙
- 시크릿은 환경변수 필수 (하드코딩 금지, 프로덕션 부팅 시 검증)
- Admin 엔드포인트는 반드시 JwtAuthGuard + RolesGuard + @Roles('admin')
- WebSocket은 JWT 인증 + admin role 필수 + IP 해시 broadcast
- Guard fail-open 전략 (서비스 장애 시 요청 허용, 로깅)
- IP는 로그/응답/WebSocket에서 해시화 (RequestUtils.hashIp)
- fire-and-forget에 반드시 에러 로깅 (.catch(err => logger.error(...)))

### 테스트
- 단위 테스트: `*.spec.ts` (같은 디렉토리)
- E2E 테스트: `test/` 디렉토리
- Jest + ts-jest, 한글 테스트명 허용

### 커밋 컨벤션
- 영어, conventional commits (feat:, fix:, refactor:, test:, docs:, chore:, security:)

## 주요 명령어
```bash
npm run start:dev      # 개발 서버 (watch)
npm run build          # 빌드
npm test               # Jest 테스트 (187 tests, 16 suites)
npm run test:e2e       # E2E 테스트
npm run lint           # ESLint
npx tsc --noEmit       # 타입 체크
docker-compose up -d   # Docker 실행
```

## 환경변수 (필수)
```
JWT_SECRET=            # JWT 서명 키 (필수, 없으면 부팅 실패)
CHALLENGE_SECRET=      # Challenge HMAC 키 (프로덕션 필수)
PUZZLE_SECRET=         # CAPTCHA HMAC 키 (프로덕션 필수)
IP_HASH_SALT=          # IP 해시 솔트 (없으면 랜덤 생성)
SWAGGER_PASSWORD=      # Swagger Basic Auth (프로덕션 필수, 'changeme' 시 비활성화)
DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE  # PostgreSQL
PORT=                  # 서버 포트 (기본 3000, 범위 1-65535)
```

## 주의사항
- Redis 미설정 시 In-Memory 캐시로 자동 fallback (50K 상한)
- DB_SYNCHRONIZE=true는 개발 환경에서만 사용
- Health/Root 엔드포인트는 모든 Guard Skip (모니터링 프로브용)
- Honeypot은 모든 Guard Skip (IpBlacklist 포함, 함정 목적)
- Testing 모듈은 프로덕션에서 자동 비활성화
- Swagger는 프로덕션에서 기본/changeme 비밀번호 시 자동 비활성화
