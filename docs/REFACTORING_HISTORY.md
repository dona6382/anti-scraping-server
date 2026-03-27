# Anti-Scraping Server 리팩토링 히스토리

> 2026-03-23 ~ 2026-03-28 진행된 전체 프로젝트 리팩토링 기록

## 개요

개인 포트폴리오 프로젝트를 프로덕션 수준으로 끌어올리기 위한 대규모 리팩토링.
5개 에이전트(TS 코드 리뷰어, NestJS 백엔드 개발자, 보안 테스트 엔지니어, 보안 연구원, PM)가 반복적으로 분석/수정/검증하는 방식으로 진행.

**시작 상태**: v2.0.0 — 기본 구조만 있고, 인증 비활성화, 테스트 0개, 중복 코드 다수
**최종 상태**: v2.5.0 — 174 unit + 28 E2E 테스트, 7단계 보안 체인 + Scoreboard 심판 시스템, Security Researcher: STRONG, 침투 테스트 100%

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

## Phase 8: JS Challenge + Browser Fingerprint (v2.4.0)

프록시만 바꿔서 IP 기반 차단을 우회하는 공격에 대응하기 위한 PoW + Fingerprint 시스템.

### 구현
- **ChallengeGuard** (APP_GUARD, 체인 5번째): 쿠키 없는 요청에 PoW 챌린지 HTML 반환
- **ChallengeService**: HMAC-SHA256 토큰 생성/검증, PoW 검증, 서명 쿠키, 핑거프린트 저장
- **ChallengeController**: POST `/challenge/verify` (rate limit 10/min, DTO 검증)
- **ICacheService.getAndDelete**: 토큰 일회용 보장을 위한 atomic 연산 (Redis GETDEL + Memory)

### 보안 심층분석 (3회 반복)

**1차 분석** — 최초 구현 후:
- CRITICAL 2건: x-api-key 무검증 bypass, XSS via HTML 템플릿
- HIGH 4건: cache.set 미await, timing attack, Cookie HMAC 64-bit, 테스트 0%
- PM 판정: **REJECT**

**2차 분석** — A그룹 수정 후 (7건 Critical/High 수정):
- 7/7 수정 완료 확인, 잔존 이슈 MEDIUM 이하
- PM 판정: **APPROVE** (코드), **NEEDS WORK** (테스트)

**3차 분석** — A+B그룹 수정 + 테스트 작성 후:
- 12/12 이슈 전부 해결
- PM 판정: **✅ APPROVE**

**4차 분석** — 실전 브라우저 + Playwright 테스트 후:
- 런타임 버그 5건 발견 (IPv6, Rate Limit, Cookie encoding, fetch/form, returnUrl)
- 에이전트 추가 이슈 3건 (SkipThrottle 무효화, meta XSS, 테스트 false positive)
- PM 판정: **⚠️ CONDITIONAL**

**5차 분석 (최종)** — 전체 수정 + 회귀 테스트 후:
- 모든 이슈 해결, 회귀 방지 테스트 추가
- 135 unit + 28 E2E (Challenge 전용 52개)
- PM 판정: **✅ APPROVE** — Security Researcher: STRONG

### A그룹 수정 (Critical/High)
| # | 수정 내용 |
|---|----------|
| A1 | x-api-key 환경변수 검증 + timingSafeEqual |
| A2 | XSS 방어: JSON.stringify + `\u003c` escape |
| A3 | generateToken() async + await cache.set |
| A4 | crypto.timingSafeEqual (토큰/쿠키 HMAC) |
| A5 | Cookie HMAC 64→128-bit (32 hex) |
| A6 | VerifyChallengeDto (class-validator) |
| A7 | @Res({ passthrough: true }) |

### B그룹 수정 (Medium + 테스트)
| # | 수정 내용 |
|---|----------|
| B2-1 | CHALLENGE_SECRET 프로덕션 필수화 |
| B2-2 | Token TOCTOU → atomic getAndDelete |
| B2-3 | `</script>` XSS 추가 방어 |
| B2-4 | x-api-key timingSafeEqual |
| B3 | DTO @MaxLength(512/32/128) |
| B1 | 테스트: service 25개 + guard 13개 + E2E 9개 |

### 런타임 버그 수정 (실전 Playwright 테스트에서 발견)
| # | 수정 내용 |
|---|----------|
| R1 | IPv6 `::1` 토큰 구분자 `:`→`\|` |
| R2 | Rate limit: `@SkipThrottle` 제거, `@Throttle(10/min)` 정상 작동 |
| R3 | Cookie URL-encoding: `decodeURIComponent` 적용 |
| R4 | fetch → hidden form submit + HTML redirect (Set-Cookie 확실 적용) |
| R5 | returnUrl hidden field + open redirect 방지 (pathname 추출) |
| C1 | meta refresh XSS 제거 → JS-only redirect + `\u003c` escape |
| C2 | debug 로그 IP `hashIp()` 적용 |
| T1-T3 | 회귀 방지: IPv6 토큰, URL-encoded 쿠키, returnUrl 테스트 추가 |

---

## 에이전트별 분석 횟수

| 에이전트 | 분석 횟수 | 역할 |
|---------|----------|------|
| ts-code-reviewer | 10회 | 타입 안전성, 코드 일관성, dead code |
| nestjs-backend-dev | 10회 | 아키텍처, NestJS 패턴, DI, 성능 |
| nestjs-security-test-engineer | 10회 | 테스트 커버리지, 인증/인가, 입력 검증 |
| security-researcher | 10회 | 공격 벡터, 암호화, timing attack, XSS |
| project-manager | 8회 | 기능 갭 분석, 우선순위, 종합 보고서 |

---

## 최종 테스트 결과

| 항목 | 결과 |
|------|------|
| TypeScript 빌드 | 0 에러 |
| Unit Tests | 174 passing (14 suites) |
| E2E Tests | 28 passing (1 suite) |
| Playwright 실전 | 3 requests로 챌린지 통과 |
| 침투 테스트 | 100% 방어율 (10/10) |
| 보안 취약점 (C/H/M) | 0건 |
| Security Researcher 판정 | **STRONG** |

---

## 알려진 한계 (설계 결정)

| 항목 | 현재 상태 | 이유 |
|------|----------|------|
| IPv6 서브넷 | full IP fallback | /64 prefix 처리 개선 예정 |
| Fail-open 전략 | Redis 장애 시 보안 우회 | 가용성 우선 설계 결정 |
| process.env 직접 참조 | 일부 잔존 | AppConfigService 전면 통일은 P3 |
| auto-block 카운터 | 비원자적 | Redis INCR로 교체 시 해결 가능 |
| CIDR 매칭 | O(N) per request | 대규모 CIDR 시 Trie 최적화 필요 |

---

## 버전 히스토리

| 버전 | 날짜 | 주요 변경 |
|------|------|----------|
| 2.0.0 | 이전 | 초기 버전 (NestJS 기본 구조) |
| 2.1.0 | 2026-03-23 | 대규모 리팩토링 (인증, 보안, 테스트, Docker) |
| 2.2.0 | 2026-03-24 | 자동 차단, GeoIP/VPN, E2E, reCAPTCHA 제거, UI 리디자인 |
| 2.3.0 | 2026-03-24 | 위협 분석 시스템 (ThreatScore, PatternAnalysis, 사전 차단) |
| 2.4.0 | 2026-03-26 | JS Challenge + Browser Fingerprint, 6단계 보안 체인, 보안 강화 (A+B그룹) |
| 2.5.0 | 2026-03-28 | BehavioralGuard, Honeypot, Scoreboard, 적응형 PoW, 침투 테스트 100%, 174 unit + 28 E2E |
