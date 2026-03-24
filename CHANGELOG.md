# Changelog

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
