# Anti-Scraping Server 리팩토링 히스토리

> 2026-03-23 ~ 2026-03-24 진행된 전체 프로젝트 리팩토링 기록

## 개요

개인 포트폴리오 프로젝트를 프로덕션 수준으로 끌어올리기 위한 대규모 리팩토링.
4개 에이전트(코드 리뷰어, 백엔드 개발자, 보안 테스트 엔지니어, 보안 연구원) + PM이 반복적으로 분석/수정/검증하는 방식으로 진행.

**시작 상태**: v2.0.0 — 기본 구조만 있고, 인증 비활성화, 테스트 0개, 중복 코드 다수
**최종 상태**: v2.3.0 — 57 unit + 16 e2e 테스트, 5단계 보안 + 위협 분석 시스템, PM 평가 9.0/10

---

## Phase 1: 불필요 파일 정리 + 기초 구조 확립

### 삭제
- 불필요 .md 파일 13개 (BUILD_FIX, CLEANUP_GUIDE, FINAL_GUIDE 등)
- 불필요 .sh 스크립트 16개
- cleanup-archive, cleanup-backup 디렉토리 3개

### 중복 코드 통합
- `src/types/` 디렉토리 삭제 → `core/types/` 단일 소스로 통합
- `security-specific.exception.ts` → `application.exception.ts`로 병합
- 미사용 필터 삭제 (`HttpExceptionFilter`, `ValidationExceptionFilter`)
- `BaseSecurityGuard` 205줄 → 57줄 (미사용 래퍼 메서드 제거)
- `AppService` 삭제, `AppController` 최소화

---

## Phase 2: 인증 + 보안 강화

### AuthModule 활성화
- `v1.module.ts`에 AuthModule import
- Admin/Security 컨트롤러에 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin')` 적용
- JWT_SECRET 환경변수 필수화 (하드코딩 제거)
- JWT algorithm `HS256` 명시 + verifyOptions 추가

### IpBlacklistGuard 전역 적용
- APP_GUARD 등록, `@SkipIpBlacklist()` 데코레이터 추가
- Health/Auth 엔드포인트 제외 처리
- `@SkipIpBlacklist()` 클래스 → 메서드 레벨 이동 (change-password는 IP 체크)

### 보안 강화
- helmet 미들웨어 (CSP, HSTS, X-Frame 등)
- Body size limit (1MB)
- Graceful shutdown (`app.close()` 기반)
- `trust proxy` 설정 (X-Forwarded-For 스푸핑 방지)
- IP 로그 해시화 통일 (`RequestUtils.hashIp()`)
- 비밀번호 복잡도 규칙 (`@Matches` — 대문자+숫자+특수문자)
- 회원가입 사용자 열거 방지
- IPv6/IPv4 정규화
- `validateToken`/`validateUser`에서 `isActive` 검증

---

## Phase 3: 코드 품질 개선 (4차 반복 분석)

### 타입 안전성
- `Record<string, any>` 전부 `Record<string, unknown>` 교체
- `as any` 7곳 제거 → 적절한 타입으로
- `RedisCacheService.client: any` → `RedisClient | null`
- `AppConfigService.get<T=any>` → `T=unknown`
- `memory-cache value: any` → `unknown`

### 아키텍처 정리
- `ICacheService` 이중 정의 → 단일 소스 (re-export)
- `CommonModule`에서 `CoreConfigModule` 불필요 re-import 제거
- `SecurityModule`에서 `CommonModule` (@Global) 불필요 import 제거
- `DatabaseSeeder` (Core→Feature 역방향 의존) 삭제
- 미사용 엔티티(IpBlacklist, SystemConfig) entity glob에서 제외 → 명시적 배열

### 미사용 코드 삭제
- 미사용 타입 7개 (RedisClient, CacheEntry, ThrottleConfig, PaginatedResponse, HealthStatus, ISecurityService, CacheStatistics)
- 미사용 상수 (WHITELISTED_USER_AGENTS, SUSPICIOUS_PATTERNS, BLOCKED_USER_AGENTS)
- `changeLogLevel` 무효 API (실제 동작 안 함) 제거
- `sendAlert` stub 삭제
- `@sendgrid/mail`, `nodemailer`, `axios` 미사용 dependencies 제거
- `test/sendgrid.ts`, `test/test_email.ts`, `templates/` 잔재 삭제

### 성능 개선
- Redis `KEYS` → `SCAN` (O(N) 블로킹 방지)
- `clearBlocklist` N+1 → `cache.deleteMany()` batch
- `getBlocklist` N+1 → `cache.getMany()` batch
- MySQL DB 옵션 → PostgreSQL 옵션 수정
- `MemoryCacheService` `OnModuleDestroy` 인터페이스 선언
- Shutdown hooks 이중 등록 제거

### 버그 수정
- `RolesGuard` 클래스 레벨 `@Roles` 무시 → `getAllAndOverride` 수정
- `blockedAt.getTime()` 런타임 에러 → `new Date()` 변환
- Redis host 기본값 `'localhost'` → `''` (memory fallback 정상 작동)
- 키 프리픽스 제거 `replace()` → `slice()` (안전한 파싱)
- `config.schema.ts` logging level 기본값 `'info'` → `'log'`
- MemoryCache `keys()` 정규식 메타문자 이스케이프 추가

---

## Phase 4: DTO 검증 + Docker 보안

### DTO 검증
- `auth.dto.ts`: `@IsNotEmpty`, `@IsString`, `@MinLength`, `@IsEmail`, `@Matches`
- `BlockIpDto`: `@IsIP`, `@IsEnum`, `@Min/@Max`
- `TestActionDto`: interface → class (ValidationPipe 적용)

### Docker Compose 보안
- DB/Redis 비밀번호 → 환경변수 필수화 (`${DB_PASSWORD:?required}`)
- PostgreSQL/Redis 포트 외부 노출 제거 (내부 네트워크만)
- Redis `--requirepass` 조건부 적용
- `redis-commander` 프로덕션에서 제거
- `DB_SYNCHRONIZE=false`
- SSL `rejectUnauthorized` 환경변수 제어

---

## Phase 5: Must Have 기능 추가

### reCAPTCHA 제거
- 14개 파일에서 완전 제거 (설정만 있고 구현 없는 레이어)
- 보안 레이어 6단계 → 5단계로 정리

### 자동 IP 차단 (Auto-Blocking)
- `SecurityEventService`에 auto-block 로직 추가
- 5분 윈도우 내 위반: 3회→1시간, 5회→24시간, 10회→7일
- `IpBlacklistService.blockIp()` 통해 차단 (캐시 키 일관성)

### GeoIP / VPN / Tor 탐지
- 데이터센터 IP 대역 탐지 (AWS, GCP, DO, Hetzner, Linode, OVH, Vultr)
- VPN 서비스 대역 탐지 (NordVPN, Mullvad, ProtonVPN, ExpressVPN, Surfshark)
- ip-api.com 기반 위치 정보 (GeoIP)

### E2E 테스트
- 16개 통합 테스트 (Supertest 기반)
- Root/Health, Auth Flow (가입/로그인/중복/비밀번호), Admin JWT 보호, UA Guard, DTO 검증

---

## Phase 6: 위협 분석 시스템 (v2.3.0)

### ThreatScoreService
- IP별 위협 점수 관리 (Redis/Memory 캐시)
- 가중치: LOW=5, MEDIUM=15, HIGH=30, CRITICAL=50
- 1시간 TTL 감쇠, 70점 이상 사전 차단
- 11 unit tests

### PatternAnalysisService
- 시간대별 차단 분포 (DB 쿼리)
- 상위 차단 IP/UA 순위
- 엔드포인트별 통계
- **요청 간격 분석** — 변동계수(CV) 기반 봇 탐지 (CV < 0.3 = 봇 의심)
- 공격 패턴 클러스터링
- 유사 패턴 IP 매칭
- 5 unit tests

### Analysis Admin API (8개 엔드포인트)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/admin/analysis/time-distribution` | 시간대별 차단 분포 |
| GET | `/admin/analysis/top-ips` | 상위 차단 IP |
| GET | `/admin/analysis/top-user-agents` | 상위 차단 UA |
| GET | `/admin/analysis/endpoints` | 엔드포인트별 통계 |
| GET | `/admin/analysis/interval/:ip` | IP 요청 간격 분석 (봇 탐지) |
| GET | `/admin/analysis/patterns` | 공격 패턴 클러스터 |
| GET | `/admin/analysis/similar/:ip` | 유사 패턴 IP |
| GET | `/admin/analysis/threat-score/:ip` | IP 위협 점수 |

### IpBlacklistGuard 사전 차단
- `ThreatScoreService.shouldPreemptiveBlock()` 체크
- 위협 점수 70점 이상 → 자동 블랙리스트 1시간 등록

---

## Phase 7: UI 리디자인

### 테스트 UI (`public/index.html`)
- 기존: 보라색 그라데이션 + 기본 폼 (463줄)
- 변경: **SHIELD Command Center** 테마
  - 다크 테마 + 포스포 그린/앰버/사이안/레드
  - JetBrains Mono + Outfit 폰트
  - 스캔라인 오버레이
  - 카드 기반 그리드 레이아웃 (반응형)
  - 실시간 시계 + 업타임 카운터 + 요청/차단 카운터
  - 7개 테스트 카드 (각각 응답 패널)

---

## 에이전트별 분석 횟수

| 에이전트 | 분석 횟수 | 역할 |
|---------|----------|------|
| ts-code-reviewer | 5회 | 타입 안전성, 코드 일관성, dead code |
| nestjs-backend-dev | 5회 | 아키텍처, NestJS 패턴, 성능, TypeORM |
| nestjs-security-test-engineer | 5회 | 인증/인가, 입력 검증, 정보 노출, Rate Limit |
| security-researcher | 5회 | 고급 보안 (우회 시나리오, OWASP, Docker) |
| project-manager | 3회 | 기능 갭 분석, 우선순위, 문서 정합성 |

---

## 최종 테스트 결과

| 항목 | 결과 |
|------|------|
| TypeScript 빌드 | 0 에러 |
| Unit Tests | 57 passing (7 suites) |
| E2E Tests | 16 passing (1 suite) |
| `as any` 잔존 | 0건 (프로덕션 코드) |
| 보안 검증 | 4개 에이전트 ALL PASS |

---

## 알려진 한계 (설계 결정)

| 항목 | 현재 상태 | 이유 |
|------|----------|------|
| JWT 토큰 무효화 | 미구현 | Refresh Token + 블랙리스트 필요 (신규 기능) |
| Headless 탐지 | 헤더 기반만 | 클라이언트 사이드 JS SDK 필요 |
| Fail-open 전략 | Redis 장애 시 보안 우회 | 가용성 우선 설계 결정 |
| process.env 직접 참조 | 6곳+ | AppConfigService 전면 통일은 대규모 리팩토링 |
| 봇 탐지 CV threshold | 0.3 고정 | 분석 API 전용, 자동 차단 미연동 |
| auto-block 카운터 | 비원자적 | Redis INCR로 교체 시 해결 가능 |

---

## 버전 히스토리

| 버전 | 날짜 | 주요 변경 |
|------|------|----------|
| 2.0.0 | 이전 | 초기 버전 (NestJS 기본 구조) |
| 2.1.0 | 2026-03-23 | 대규모 리팩토링 (인증, 보안, 테스트, Docker) |
| 2.2.0 | 2026-03-24 | 자동 차단, GeoIP/VPN, E2E, reCAPTCHA 제거, UI 리디자인 |
| 2.3.0 | 2026-03-24 | 위협 분석 시스템 (ThreatScore, PatternAnalysis, 사전 차단) |
