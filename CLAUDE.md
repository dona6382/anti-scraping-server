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
AI(Claude Code)를 5개 전문 에이전트로 활용하여 설계·구현·검증한 프로젝트.

## 기술 스택
- **Framework**: NestJS 10 (Express)
- **Language**: TypeScript 5
- **Database**: PostgreSQL (TypeORM)
- **Cache**: Redis (ioredis) / In-Memory fallback
- **Auth**: JWT (access 15m + refresh 7d) + bcrypt + RBAC + account lockout
- **Security**: helmet, rate limiting, IP/CIDR blacklist, UA filtering, headless detection (11-signal), behavioral analysis (CV+RPM), JS challenge + PoW (difficulty 5~7) + fingerprint, header order fingerprinting, threat scoring
- **Realtime**: WebSocket (Socket.io) — 보안 이벤트 실시간 스트림
- **Validation**: class-validator + class-transformer (DTO 기반)
- **API Docs**: Swagger (`/api-docs`)
- **Container**: Docker Compose (app + postgres + redis)
- **Test**: Jest (174 unit + 28 e2e)

## 프로젝트 구조
```
src/
├── main.ts                  # 부트스트랩 (helmet, body limit, graceful shutdown)
├── app.module.ts            # 루트 모듈 (전역 Guard 6개 + Filter 등록)
├── app.controller.ts        # 루트 엔드포인트
├── core/                    # 인프라 계층 (@Global)
│   ├── config/              # ConfigModule, AppConfigService
│   ├── cache/               # Redis/Memory 캐시 (Factory 패턴)
│   ├── database/            # TypeORM + PostgreSQL
│   │   └── entities/        # User, SecurityEvent
│   └── types/               # 전역 타입 (단일 소스)
├── common/                  # 공유 계층 (@Global)
│   ├── guards/              # BaseSecurityGuard, UserAgent, IpBlacklist, HeadlessBrowser, Challenge
│   ├── filters/             # UnifiedExceptionFilter
│   ├── services/            # IpBlacklist, SecurityEvent, ThreatScore, Challenge
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
│   ├── realtime/            # WebSocket 실시간 보안 이벤트 (@Global)
│   └── testing/             # 보안 테스트 (프로덕션 비활성화)
└── api/                     # API 버전 관리 (v1)
```

## 전역 보안 체인
```
모든 요청 → ThrottlerGuard → IpBlacklistGuard (+ CIDR + 위협 점수) → UserAgentGuard → HeadlessBrowserGuard → BehavioralGuard → ChallengeGuard → Route Handler
```

## 개발 프로세스

### 새 기능 추가 흐름
```
설계 → 보안 리뷰 → 구현 → 코드 리뷰 + 보안 테스트 → PM 승인 → (사용자 요청 시) 커밋
  ↑                                    |
  └──────── 이슈 발견 시 되돌아감 ────────┘
```

1. **설계** — PM이 요구사항 정리
2. **보안 리뷰** — 보안 연구원이 인증, 성능, 입력 검증, 공격 벡터 사전 검토
3. **구현** — 백엔드 개발자가 TDD로 코드 작성
4. **검증** — 코드 리뷰어(타입/패턴) + 보안 테스트(인증/입력/노출) 둘 다 PASS
5. **PM 승인** — 이슈 있으면 3번으로 되돌아감
6. **커밋** — **사용자가 요청할 때만** 실행

### 커밋 전 체크리스트
- [ ] 새 엔드포인트에 인증 Guard 적용? (JWT, Roles)
- [ ] WebSocket/실시간 기능에 인증?
- [ ] 입력값 검증 DTO? (class-validator)
- [ ] 외부 API 호출에 타임아웃/캐싱?
- [ ] O(N) 이상 복잡도가 매 요청에 실행되지 않는가?
- [ ] 민감 정보(IP, 토큰)가 로그/응답에 평문 노출되지 않는가?
- [ ] 극단적 입력(`0.0.0.0/0`, 빈 문자열 등) 처리?
- [ ] fire-and-forget에 에러 로깅?
- [ ] `npx tsc --noEmit` 통과?
- [ ] `npm test` + E2E 통과?

---

## 개발 규칙

### 코드 스타일
- NestJS 공식 컨벤션 (Module, Controller, Service, Guard, Filter)
- DTO는 반드시 class-validator 데코레이터 적용
- 컨트롤러에 raw body type 금지 → DTO 클래스 사용
- 예외는 NestJS 표준 또는 SecurityException 계층 사용
- Generic `throw new Error()` 금지

### 아키텍처 원칙
- Core → Common → Features 계층 분리 유지
- @Global 모듈은 Core, Common만 허용
- Feature 모듈 간 직접 의존 금지 (공유 로직은 Common으로)
- 타입 정의는 `core/types/index.ts` 단일 소스

### 보안 원칙
- 시크릿은 환경변수 필수 (하드코딩 금지)
- Admin 엔드포인트는 반드시 JwtAuthGuard + RolesGuard + @Roles('admin')
- WebSocket은 JWT 인증 + admin role 필수
- Guard fail-open 전략 (서비스 장애 시 요청 허용, 로깅)
- IP는 로그/응답에서 해시화 (RequestUtils.hashIp)

### 테스트
- 단위 테스트: `*.spec.ts` (같은 디렉토리)
- E2E 테스트: `test/` 디렉토리
- Jest + ts-jest, 한글 테스트명 허용

### 커밋 컨벤션
- 영어, conventional commits (feat:, fix:, refactor:, test:, docs:, chore:)

## 주요 명령어
```bash
npm run start:dev      # 개발 서버 (watch)
npm run build          # 빌드
npm test               # Jest 테스트 (174 tests, 14 suites)
npm run test:e2e       # E2E 테스트 (28 tests)
npm run lint           # ESLint
docker-compose up -d   # Docker 실행
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
- 전역 Guard 6개: ThrottlerGuard → IpBlacklistGuard → UserAgentGuard → HeadlessBrowserGuard → BehavioralGuard → ChallengeGuard
- Health/Root 엔드포인트는 모든 Guard Skip (모니터링 프로브용)
- Testing 모듈은 프로덕션에서 자동 비활성화
