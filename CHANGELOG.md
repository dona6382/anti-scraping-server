# Changelog

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
