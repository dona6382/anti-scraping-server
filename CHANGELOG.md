# Changelog

## [2.5.0] - 2026-03-27

### Features
- **BehavioralGuard**: 실시간 요청 간격 CV 분석으로 기계적 패턴 자동 차단 (7단계 보안 체인)
- **Honeypot 트랩**: /api/internal/users, /api/internal/config, /api/v2/data (ResponseBuilder 포맷 — 구별 불가)
- **적응형 PoW 난이도**: 기본 4 (65K hashes), 위협 시 5→6 (1M→16M hashes)
- **Fingerprint 크로스-IP 추적**: >3 서브넷에서 동일 FP → SUSPICIOUS_ACTIVITY + 전체 IP 위협 점수
- **Request Logger Middleware**: 전 요청 행동 데이터 캐시 수집 (응답 상태 포함, health 제외)
- **실시간 분석 API**: GET /admin/analysis/realtime/behavior/:ip, /realtime/log/:ip, /fingerprint/:hash

### Security
- **Swagger Basic Auth**: /api-docs + /api-docs-json 보호 (JWT_SECRET 파생 제거)
- **PoW 기본 난이도 3→4**: 봇 풀이 시간 1ms → 15ms (30배 증가)
- **Cookie TTL 24h→1h**: 봇이 매시간 PoW 재풀이 필요
- **Analysis 입력 검증**: ParseIntPipe, validateIp, 상한 제한

### Testing
- `behavioral.guard.spec.ts`: 8 tests
- `honeypot.controller.spec.ts`: 5 tests
- `request-logger.middleware.spec.ts`: 5 tests
- getDifficulty 적응형 난이도: 6 tests
- **Total: 162 unit (13 suites) + 28 e2e tests**

### Penetration Test Results
- 공격자 관점 11개 시나리오 침투 테스트 → **100% 방어율 (10/10)**
- 일반 사용자 7개 시나리오 테스트 → **0건 거짓 차단**
- Security Researcher 최종 판정: **STRONG**

---

## [2.4.0] - 2026-03-26

### Features
- **JS Challenge + Browser Fingerprint**: 프록시 회전 공격 방어를 위한 Proof-of-Work 챌린지 시스템
  - SHA-256 기반 PoW (difficulty 3, 클라이언트 ~50ms 풀이)
  - HMAC-SHA256 서명된 일회용 토큰 (30s TTL)
  - Canvas + Navigator 기반 브라우저 핑거프린트 수집
  - 서명된 쿠키 (128-bit HMAC, HttpOnly, 24h TTL, /24 서브넷 바인딩)
  - `@SkipChallenge()` 데코레이터 + API key bypass (환경변수 검증)
- **ChallengeGuard**: 6단계 보안 체인의 마지막 Guard (APP_GUARD)
- **ChallengeController**: POST `/challenge/verify` 엔드포인트 (rate limit 10/min)
- **Atomic getAndDelete**: ICacheService 인터페이스 확장, Redis GETDEL + Memory 구현

### Security (A-Group — Critical/High 수정)
- **x-api-key 검증 강화**: 환경변수 `API_KEY` 대조 + `timingSafeEqual` (이전: 아무 값이나 bypass)
- **XSS 방어**: `JSON.stringify(token).replace(/</g, '\\u003c')` + `Number(difficulty)` (이전: 직접 문자열 삽입)
- **async generateToken**: `await cache.set()` (이전: fire-and-forget → 캐시 실패 시 토큰 검증 불가)
- **Timing-safe HMAC 비교**: `crypto.timingSafeEqual` 적용 — 토큰/쿠키 서명 검증 (이전: `===` 비교)
- **Cookie HMAC 확장**: 64-bit → 128-bit (32 hex chars)
- **VerifyChallengeDto**: class-validator 데코레이터 (`@IsString`, `@IsNotEmpty`, `@MaxLength`)
- **@Res({ passthrough: true })**: NestJS 인터셉터/필터 정상 작동

### Security (B-Group — Medium 수정)
- **CHALLENGE_SECRET 필수화**: 프로덕션 환경에서 미설정 시 부팅 실패
- **Token TOCTOU 방지**: `getAndDelete` atomic 연산으로 토큰 재사용 차단
- **`</script>` escape**: `\u003c`로 HTML parser breakout 방어
- **x-api-key timing-safe**: Guard에서도 `timingSafeEqual` 적용

### Runtime Bug Fixes (실전 브라우저 + Playwright 테스트에서 발견)
- **IPv6 토큰 파싱**: 구분자 `:`가 `::1`과 충돌 → `|`로 변경
- **Rate limit 충돌**: 글로벌 ThrottlerGuard가 challenge verify 차단 → `@SkipThrottle` 제거 + `@Throttle(10/min)` 정상 작동
- **Cookie URL-encoding**: 브라우저가 `:`를 `%3A`로 인코딩 → guard에서 `decodeURIComponent` 적용
- **fetch Set-Cookie 미적용**: `fetch()` → hidden form submit + HTML redirect로 변경 (쿠키 확실히 설정)
- **returnUrl**: hidden field로 원래 URL 전달 + open redirect 방지 (pathname만 추출)
- **meta refresh XSS**: meta 태그 제거, JS-only redirect + `\u003c` escape
- **Debug 로그 IP 노출**: `RequestUtils.hashIp()` 적용

### Testing
- `challenge.service.spec.ts`: 26 unit tests (토큰, PoW, 쿠키, 핑거프린트, XSS, IPv6)
- `challenge.guard.spec.ts`: 14 unit tests (skip, api-key, cookie, fail-open, URL-encoding)
- E2E Challenge Flow: 12 tests (DTO 검증, MaxLength, 잘못된 토큰, api-key, returnUrl)
- Playwright 실전 테스트: 3 requests로 챌린지 플로우 검증 완료
- **Total: 135 unit (10 suites) + 28 e2e tests**

### Security Review Summary
- 4개 에이전트 5회 심층분석 (최초 → A그룹 → A+B그룹 → 실전 버그 후 → 최종)
- 최초: CRITICAL 2 / HIGH 4 → 최종: **CRITICAL 0 / HIGH 0 / MEDIUM 0**
- Security Researcher 최종 판정: **STRONG**
- Playwright 실전 테스트: GET(403 challenge) → POST(verify + cookie) → GET(200 data) ✅

---

## [2.3.0] - 2026-03-24

### Features
- **위협 점수 시스템 (ThreatScoreService)**: IP별 위협 점수 관리 (가중치: LOW=5, MEDIUM=15, HIGH=30, CRITICAL=50), 1시간 TTL 감쇠, 70점 이상 사전 차단
- **패턴 분석 시스템 (PatternAnalysisService)**: 시간대별 차단 분포, 상위 차단 IP/UA 순위, 엔드포인트별 통계, 요청 간격 분석 (변동계수 기반 봇 탐지), 공격 패턴 클러스터링, 유사 패턴 IP 매칭
- **분석 Admin API**: 8개 엔드포인트 (`/admin/analysis/*`) — JWT+admin 보호
- **사전 차단 (Preemptive Blocking)**: IpBlacklistGuard에서 위협 점수 기반 자동 차단

### Testing
- ThreatScoreService: 11 unit tests
- AnalysisService: 5 unit tests (봇 탐지 정확도 포함)
- Total: 57 unit + 16 e2e tests

## [2.2.0] - 2026-03-24

### Features
- **자동 IP 차단 (Auto-Blocking)**: 5분 윈도우 내 위반 횟수 기반 단계별 차단 (3회→1시간, 5회→24시간, 10회→7일)
- **GeoIP / VPN / Tor 탐지**: 데이터센터 IP 대역 (AWS, GCP, DigitalOcean, Hetzner, Linode, OVH, Vultr), VPN 서비스 대역 (NordVPN, Mullvad, ProtonVPN, ExpressVPN, Surfshark), ip-api.com 기반 위치 정보
- **E2E 테스트**: 16개 통합 테스트 (Root/Health, Auth Flow, Admin JWT, UA Guard, DTO Validation)

### Security
- reCAPTCHA 코드 완전 제거 (5단계 보안 레이어로 정리)
- `@SkipIpBlacklist()` 메서드 레벨로 이동 (change-password는 IP 체크 적용)
- BaseSecurityGuard, SecurityAdminController 로그에서 IP 해시화 통일
- register 응답에서 내부 필드(lastLoginIp 등) 노출 제거
- JWT algorithm `HS256` 명시 + verifyOptions 추가
- 비밀번호 복잡도 규칙 적용 (대문자+숫자+특수문자)
- 회원가입 사용자 열거 방지 (일반화된 에러 메시지)
- IPv6/IPv4 정규화 적용 (블랙리스트 우회 방지)

### Code Quality
- `Record<string, any>` 전부 `Record<string, unknown>`으로 교체
- Redis `KEYS` → `SCAN` 교체 (O(N) 블로킹 방지)
- `clearBlocklist` N+1 → batch `deleteMany`
- `ICacheService` 이중 정의 → 단일 소스 (re-export)
- `MemoryCacheService` `OnModuleDestroy` 인터페이스 선언
- Shutdown hooks 이중 등록 제거
- MySQL DB 옵션 → PostgreSQL 옵션으로 수정
- Redis host 기본값 'localhost' → '' (memory fallback 정상 작동)
- 미사용 타입/상수/엔티티/dependencies 제거
- `changeLogLevel` 무효 API 제거
- `TestRequestData` interface → DTO class (ValidationPipe 적용)
- `detectHeadlessBrowser` 불필요한 async 제거
- MemoryCache keys() 정규식 이스케이프 추가
- `/health/detailed` admin 인증 필수화
- DB config SSL `rejectUnauthorized` 환경변수 제어

### Cleanup
- `@sendgrid/mail`, `nodemailer`, `axios` 미사용 dependencies 제거
- `test/sendgrid.ts`, `test/test_email.ts`, `templates/` 잔재 파일 삭제
- 미사용 타입 7개 삭제 (RedisClient, CacheEntry, ThrottleConfig 등)
- `DatabaseSeeder` dead code 삭제

## [2.1.0] - 2026-03-23

### Architecture
- 3계층 모듈 구조 정리 (Core → Common → Features)
- 타입 정의 단일 소스화 (`src/types/` 제거 → `core/types/` 통합)
- 예외 클래스 통합 (`security-specific.exception.ts` 제거 → `application.exception.ts`로 병합)
- 미사용 필터 제거 (`HttpExceptionFilter`, `ValidationExceptionFilter`)
- `BaseSecurityGuard` 간소화 (205줄 → 57줄, 미사용 래퍼 메서드 제거)
- `AppService` 제거, `AppController` 최소화

### Security
- AuthModule 활성화 + Admin/Security 라우트 JWT+Roles 보호
- IpBlacklistGuard 전역 적용 (APP_GUARD) + `@SkipIpBlacklist()` 데코레이터
- helmet 미들웨어 적용 (CSP, HSTS, X-Frame-Options 등)
- request body size limit (1MB)
- JWT 시크릿 하드코딩 제거 → 환경변수 필수 (없으면 부팅 실패)
- admin 비밀번호 하드코딩 제거 → `INITIAL_ADMIN_PASSWORD` 환경변수
- IP_HASH_SALT 인스턴스 레벨 고정 (호출마다 변경되던 버그 수정)

### Features
- SecurityEventService 신규: Guard 위반 시 DB 기록 (3개 Guard 모두 연동)
- HealthService 실제 DB/Redis 연결 체크 구현 (stub 제거)
- `changePassword` 실제 구현 (현재 비밀번호 검증 + bcrypt 재해시)
- 로그인 시 `lastLoginAt`, `lastLoginIp` 업데이트
- AdminService 실제 DB 연동 (목 데이터 제거)

### Validation
- Auth DTO: `@IsNotEmpty`, `@IsString`, `@MinLength`, `@IsEmail` 등
- `BlockIpDto`: `@IsIP`, `@IsEnum`, `@Min/@Max`
- `ChangeLogLevelDto`: `@IsEnum`
- Generic `throw new Error()` → NestJS 표준 예외 (`UnauthorizedException` 등)

### Performance
- IP Blacklist `getBlocklist()` N+1 쿼리 제거 → `cache.getMany()` batch fetch
- SecurityEvent 복합 인덱스 추가 (`severity+createdAt`, `eventType+severity`)
- Entity 중복 인덱스 제거 (클래스/프로퍼티 레벨 중복)

### Infrastructure
- Docker Compose: PostgreSQL 서비스 추가 + healthcheck
- `DB_SYNCHRONIZE=false` (프로덕션 안전)
- Graceful shutdown: `process.exit()` → `await app.close()` (DB/Redis 연결 정리)
- `.env.example`에 `JWT_SECRET`, `IP_HASH_SALT`, `INITIAL_ADMIN_PASSWORD` 추가

### Testing
- UserAgentGuard: 8 tests (차단, strict mode, SecurityEvent 기록)
- HeadlessBrowserGuard: 6 tests (HeadlessChrome, PhantomJS, 점수 기반)
- IpBlacklistGuard: 5 tests (차단, fail-open, @SkipIpBlacklist)
- AuthService: 10 tests (login, register, changePassword, validateToken)
- IpBlacklistService: 12 tests (block, unblock, getBlocklist, isValidIp)
- **Total: 5 suites, 41 tests**

### Cleanup
- 불필요 파일 삭제: 13 .md + 16 .sh + 3 backup 디렉토리
- 미사용 상수 제거 (`WHITELISTED_USER_AGENTS`, `SUSPICIOUS_PATTERNS`)
- TODO 주석 정리 (`core.module.ts`)
- Swagger placeholder URL 제거
- 테스트 UI (`public/index.html`) 엔드포인트 URL 수정

## [2.0.0] - Initial

- NestJS 10 기반 안티 스크래핑 서버
- 6단계 보안 레이어 설계
- PostgreSQL + Redis + Docker Compose
