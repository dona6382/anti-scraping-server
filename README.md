# Anti-Scraping Server

5단계 보안 레이어를 갖춘 웹 스크래핑/봇 탐지 및 차단 서버.
NestJS + TypeScript + PostgreSQL + Redis 기반.

## 기술 스택

| 영역 | 기술 |
|------|------|
| Framework | NestJS 10 (Express) |
| Language | TypeScript 5 |
| Database | PostgreSQL 16 (TypeORM) |
| Cache | Redis 7 / In-Memory fallback |
| Auth | JWT + bcrypt + RBAC |
| Security | helmet, throttler, IP blacklist, UA filter, headless detection |
| Validation | class-validator + class-transformer |
| API Docs | Swagger (OpenAPI 3.0) |
| Container | Docker Compose |
| Test | Jest (57 unit + 16 e2e) |

## 보안 레이어 (5단계)

```
Request → ThrottlerGuard → IpBlacklistGuard → UserAgentGuard → HeadlessBrowserGuard → Honeypot
```

| 레이어 | 설명 | 적용 범위 |
|--------|------|----------|
| Rate Limiting | IP별 요청 속도 제한 | 전역 (APP_GUARD) |
| IP Blacklist | Redis/Memory 기반 동적 IP 차단 + **자동 차단** | 전역 (APP_GUARD) |
| User-Agent Filter | 봇/스크래퍼 UA 패턴 매칭 | 라우트별 |
| Headless Detection | Puppeteer, Selenium 등 자동화 탐지 (점수 기반) | 라우트별 |
| Honeypot | 숨겨진 필드로 자동화 도구 탐지 | 라우트별 |

### 추가 보안 기능
- **자동 IP 차단**: 5분 내 위반 3회→1시간, 5회→24시간, 10회→7일 단계별 차단
- **GeoIP / VPN / Tor 탐지**: 데이터센터 IP 대역 (AWS, GCP, DO 등), VPN 서비스 대역 자동 탐지
- **IP Reputation**: 위반 횟수 누적 기반 점진적 차단 에스컬레이션
- **위협 점수 시스템**: IP별 위협 점수 관리 (가중치: LOW=5, MEDIUM=15, HIGH=30, CRITICAL=50), 1시간 TTL 감쇠, 70점 이상 사전 차단
- **요청 패턴 분석 (봇 탐지)**: 시간대별 차단 분포, 상위 차단 IP/UA 순위, 엔드포인트별 통계, 요청 간격 변동계수 기반 봇 탐지, 공격 패턴 클러스터링

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
| POST | `/auth/login` | 로그인 (JWT 발급) |
| POST | `/auth/register` | 회원가입 |
| POST | `/auth/change-password` | 비밀번호 변경 (JWT 필요) |

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
│   ├── guards/                 # 보안 Guard (Base, UserAgent, IpBlacklist, Headless)
│   ├── filters/                # UnifiedExceptionFilter
│   ├── services/               # IpBlacklistService, SecurityEventService
│   ├── exceptions/             # 통합 예외 계층 (BaseApplicationException)
│   ├── constants/              # 에러 코드, 보안 상수
│   └── utils/                  # RequestUtils, ResponseBuilder
│
├── features/                   # 비즈니스 모듈
│   ├── auth/                   # JWT 인증 + RBAC
│   ├── admin/                  # 시스템 관리
│   ├── security/               # IP 차단 관리
│   ├── health/                 # 헬스체크 (DB/Redis 실제 체크)
│   ├── public/                 # 공개 API
│   ├── client-info/            # 클라이언트 핑거프린팅
│   └── testing/                # 보안 테스트
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
npm test               # Jest 테스트 (7 suites, 57 tests)
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
                → Logger 출력 (IP 해시화)
```

### 캐시 전략
```
CacheFactory → REDIS_HOST 설정됨? → RedisCacheService
                                  → MemoryCacheService (fallback)
```

## 라이선스

MIT
