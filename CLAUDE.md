# Anti-Scraping Server

## 프로젝트 개요
웹 스크래핑/봇을 탐지하고 차단하는 다층 보안 서버. NestJS 기반 TypeScript 프로젝트.
개인 포트폴리오 프로젝트로, 코드 품질과 아키텍처 완성도가 중요함.

## 기술 스택
- **Framework**: NestJS 10 (Express)
- **Language**: TypeScript 5
- **Database**: PostgreSQL (TypeORM)
- **Cache**: Redis (ioredis) / In-Memory fallback
- **Auth**: JWT + bcrypt + RBAC (JwtAuthGuard, RolesGuard)
- **Security**: helmet, rate limiting, IP blacklist, UA filtering, headless detection
- **Rate Limiting**: @nestjs/throttler
- **Validation**: class-validator + class-transformer (DTO 기반)
- **API Docs**: Swagger (`/api-docs`)
- **Container**: Docker Compose (app + postgres + redis)
- **Test**: Jest (41 tests, 5 suites)

## 프로젝트 구조
```
src/
├── main.ts                  # 부트스트랩 (helmet, body limit, graceful shutdown)
├── app.module.ts            # 루트 모듈 (전역 Guard/Filter 등록)
├── app.controller.ts        # 루트 엔드포인트
├── core/                    # 인프라 계층 (@Global)
│   ├── config/              # ConfigModule, AppConfigService
│   ├── cache/               # Redis/Memory 캐시 (Factory 패턴)
│   ├── database/            # TypeORM + PostgreSQL
│   │   └── entities/        # User, IpBlacklist, SecurityEvent, SystemConfig
│   └── types/               # 전역 타입 (단일 소스)
├── common/                  # 공유 계층 (@Global)
│   ├── guards/              # BaseSecurityGuard, UserAgent, IpBlacklist, HeadlessBrowser
│   ├── filters/             # UnifiedExceptionFilter
│   ├── services/            # IpBlacklistService, SecurityEventService
│   ├── exceptions/          # BaseApplicationException 계층 (통합)
│   ├── constants/           # error.constants, security.constants
│   └── utils/               # RequestUtils, ResponseBuilder
├── features/                # 비즈니스 모듈
│   ├── admin/               # 시스템 관리 (JWT+admin 필수)
│   ├── auth/                # JWT 인증 (login, register, change-password)
│   ├── security/            # IP 차단 CRUD (JWT+admin 필수)
│   ├── health/              # 헬스체크 (DB/Redis 실제 체크)
│   ├── public/              # 공개 API
│   ├── client-info/         # 클라이언트 핑거프린팅
│   └── testing/             # 보안 테스트 엔드포인트
└── api/                     # API 버전 관리 (v1)
```

## 모듈 로딩 순서
1. **CoreModule** (Global) → Config, Cache, Database
2. **CommonModule** (Global) → Guards, Services, ThrottlerModule, SecurityEventService
3. **ApiModule** → V1Module → Auth, Security, Health, Public, Admin, ClientInfo, Testing

## 전역 보안 체인
`ThrottlerGuard` → `IpBlacklistGuard` → Route-level Guards (UserAgent, Headless, JWT)

## 개발 규칙

### 코드 스타일
- NestJS 공식 컨벤션 준수 (Module, Controller, Service, Guard, Filter)
- path alias `@/*` → `src/*`
- DTO는 반드시 class-validator 데코레이터 적용
- 컨트롤러에 raw body type 금지 → DTO 클래스 사용
- 예외는 NestJS 표준 (UnauthorizedException 등) 또는 BaseApplicationException 계층 사용
- Generic `throw new Error()` 금지

### 아키텍처 원칙
- Core → Common → Features 계층 분리 유지
- @Global 모듈은 Core, Common만 허용
- Feature 모듈 간 직접 의존 금지 (공유 로직은 Common으로)
- 타입 정의는 `core/types/index.ts` 단일 소스
- 예외 클래스는 `common/exceptions/application.exception.ts`에 통합

### 보안 원칙
- JWT_SECRET, IP_HASH_SALT 등 시크릿은 환경변수 필수 (하드코딩 금지)
- Admin 엔드포인트는 반드시 @UseGuards(JwtAuthGuard, RolesGuard) + @Roles('admin')
- Guard fail-open 전략 (서비스 장애 시 요청 허용, 로깅)
- SecurityEventService로 보안 이벤트 DB 기록

### 테스트
- 단위 테스트: `*.spec.ts` (같은 디렉토리에 위치)
- Jest + ts-jest, describe/it 구조
- Guard, Service 테스트 필수

### 커밋 컨벤션
- 영어, conventional commits (feat:, fix:, refactor:, test:, docs:, chore:)

## 주요 명령어
```bash
npm run start:dev      # 개발 서버 (watch)
npm run build          # 빌드
npm test               # Jest 테스트 (41 tests)
npm run lint           # ESLint
npm run format         # Prettier
docker-compose up -d   # Docker 실행 (app + postgres + redis)
```

## 환경변수 (필수)
```
JWT_SECRET=            # JWT 서명 키 (필수, 없으면 부팅 실패)
IP_HASH_SALT=          # IP 해시 솔트 (없으면 랜덤 생성)
DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE  # PostgreSQL
```

## 주의사항
- Redis 미설정 시 In-Memory 캐시로 자동 fallback
- DB_SYNCHRONIZE=true는 개발 환경에서만 사용
- 전역 UnifiedExceptionFilter (APP_FILTER), ThrottlerGuard + IpBlacklistGuard (APP_GUARD)
- Health 엔드포인트는 @SkipIpBlacklist + @SkipThrottle (모니터링 프로브용)
