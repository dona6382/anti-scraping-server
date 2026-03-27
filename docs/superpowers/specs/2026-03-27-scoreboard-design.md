# Scoreboard Module Design Spec

## Overview

방어 서버 내장형 심판 시스템. 공격 vs 방어 양쪽의 성과를 정량 측정하고, 양쪽 모두에게 개선 방향을 제시한다. 기존 SecurityEvent DB + Request Logger 캐시를 읽기 전용으로 조합하며, 새 테이블 없이 기존 데이터만 집계한다.

## Constraints

- NestJS + TypeScript, 기존 Core → Common → Features 아키텍처 유지
- PostgreSQL (TypeORM) + Redis/Memory 캐시
- 프론트엔드는 기존 `public/index.html` SHIELD Command Center에 탭 추가 (별도 프레임워크 없음)
- 라운드/세션 구분 없이 연속 흐름 + 시간 필터(`hours`)로 조회
- 공격측 제안은 외부 관찰 가능 정보만 (HTTP 응답 코드, 패턴) — 내부 Guard 이름/구조 노출 금지

## Architecture

### Backend

`src/features/scoreboard/` — ScoreboardModule, ScoreboardService, ScoreboardController

**의존하는 기존 인프라 (읽기 전용):**
- `SecurityEvent` entity (TypeORM Repository) — 보안 이벤트 집계
- `ICacheService` — Request Logger 캐시 (`req_log:{ip}`) 조회
- `ThreatScoreService` — IP별 현재 위협 점수 조회
- `RealtimeGateway` — WebSocket 실시간 점수 브로드캐스트 (선택적)

**새 테이블/엔티티: 없음.** 기존 데이터를 집계 쿼리로 산출.

### Frontend

`public/index.html` — 기존 SHIELD Command Center 내 "Scoreboard" 탭 추가

---

## API Endpoints (5개)

모두 `JWT + admin` 보호, `@SkipThrottle()` 적용.

### 1. GET /admin/scoreboard/summary

전체 공격/방어 점수 요약.

**Query:** `?hours=1` (기본 1, 최대 720)

**Response:**
```json
{
  "status": "success",
  "data": {
    "defense": {
      "score": 87.3,
      "totalBlocked": 523,
      "totalEvents": 599
    },
    "attack": {
      "score": 12.7,
      "totalSuccess": 76,
      "totalRequests": 599
    },
    "period": {
      "hours": 1,
      "from": "2026-03-27T04:00:00Z",
      "to": "2026-03-27T05:00:00Z"
    },
    "topAttackerIp": "d23a6537...",
    "topTargetEndpoint": "/api/public/data",
    "activeThreats": 3
  }
}
```

### 2. GET /admin/scoreboard/layers

Guard별 차단 통계.

**Query:** `?hours=1`

**Response:**
```json
{
  "data": {
    "layers": [
      {
        "name": "Rate Limiting",
        "eventType": "RATE_LIMITED",
        "blocked": 120,
        "percentage": 23.1,
        "severity": "MEDIUM"
      },
      {
        "name": "IP Blacklist",
        "eventTypes": ["IP_BLOCKED", "AUTO_BLOCKED"],
        "blocked": 200,
        "percentage": 38.5
      },
      {
        "name": "User-Agent Filter",
        "eventType": "USER_AGENT_BLOCKED",
        "blocked": 80,
        "percentage": 15.4
      },
      {
        "name": "Headless Detection",
        "eventType": "HEADLESS_BROWSER_DETECTED",
        "blocked": 50,
        "percentage": 9.6
      },
      {
        "name": "Behavioral Analysis",
        "eventType": "BOT_DETECTED",
        "blocked": 30,
        "percentage": 5.8
      },
      {
        "name": "Honeypot",
        "eventType": "HONEYPOT_TRIGGERED",
        "blocked": 10,
        "percentage": 1.9
      }
    ],
    "totalBlocked": 490
  }
}
```

### 3. GET /admin/scoreboard/attacker/:ip

특정 IP의 공격 분석.

**Query:** `?hours=1`

**Response:**
```json
{
  "data": {
    "ip": "d23a6537...",
    "totalRequests": 150,
    "blockedCount": 130,
    "successCount": 20,
    "successRate": 13.3,
    "threatScore": 85,
    "eventBreakdown": {
      "USER_AGENT_BLOCKED": 40,
      "HEADLESS_BROWSER_DETECTED": 30,
      "IP_BLOCKED": 50,
      "BOT_DETECTED": 10
    },
    "targetEndpoints": [
      { "endpoint": "/api/public/data", "count": 100 },
      { "endpoint": "/api/public/stats", "count": 50 }
    ],
    "behaviorAnalysis": {
      "cv": 0.15,
      "verdict": "BOT_SUSPECTED",
      "requestsPerMinute": 12.5
    }
  }
}
```

### 4. GET /admin/scoreboard/timeline

시간대별 공격/방어 흐름 (5분 단위).

**Query:** `?hours=1`

**Response:**
```json
{
  "data": {
    "intervals": [
      {
        "time": "2026-03-27T04:00:00Z",
        "blocked": 45,
        "success": 8,
        "total": 53,
        "defenseScore": 84.9
      },
      {
        "time": "2026-03-27T04:05:00Z",
        "blocked": 52,
        "success": 3,
        "total": 55,
        "defenseScore": 94.5
      }
    ],
    "intervalMinutes": 5
  }
}
```

### 5. GET /admin/scoreboard/recommendations

양쪽 개선 제안.

**Response:**
```json
{
  "data": {
    "defense": [
      {
        "priority": "HIGH",
        "message": "Honeypot 미트리거 — 공격자가 함정을 피하고 있음. 새 트랩 경로 추가 고려",
        "metric": "honeypotTriggerRate",
        "value": 0
      },
      {
        "priority": "MEDIUM",
        "message": "/api/public/data에 공격 72% 집중 — 이 엔드포인트 추가 보강 필요",
        "metric": "endpointConcentration",
        "value": 72
      }
    ],
    "attack": [
      {
        "priority": "HIGH",
        "message": "403 응답이 87% — 요청 헤더 구성이 부족할 수 있음",
        "metric": "blockRate",
        "value": 87
      },
      {
        "priority": "MEDIUM",
        "message": "같은 IP에서 반복 차단 — IP 회전 필요",
        "metric": "sameIpBlockRate",
        "value": 95
      }
    ]
  }
}
```

---

## Scoring Logic

### 방어 점수

```
defenseScore = (blockedEvents / totalRequestsInWindow) × 100
```

- `blockedEvents`: SecurityEvent에서 시간 윈도우 내 차단 이벤트 수 (IP_BLOCKED, USER_AGENT_BLOCKED, HEADLESS_BROWSER_DETECTED, BOT_DETECTED, RATE_LIMITED, AUTO_BLOCKED, HONEYPOT_TRIGGERED)
- `totalRequestsInWindow`: Request Logger 캐시에서 모든 IP의 요청 수 합계. 캐시 TTL(1h) 초과 시 SecurityEvent count로 대체.

### 공격 점수

```
attackScore = (successfulRequests / totalRequestsInWindow) × 100
```

- `successfulRequests`: Request Logger에서 status 200인 요청 수
- 두 점수의 합은 정확히 100이 아닐 수 있음 (403 challenge, 302 redirect 등 중간 상태 존재)

### Guard별 기여도

eventType → Guard 매핑:
| eventType | Guard |
|-----------|-------|
| RATE_LIMITED | Rate Limiting (ThrottlerGuard) |
| IP_BLOCKED, AUTO_BLOCKED | IP Blacklist (IpBlacklistGuard) |
| USER_AGENT_BLOCKED | User-Agent Filter (UserAgentGuard) |
| HEADLESS_BROWSER_DETECTED | Headless Detection (HeadlessBrowserGuard) |
| BOT_DETECTED | Behavioral Analysis (BehavioralGuard) |
| HONEYPOT_TRIGGERED | Honeypot |

---

## Recommendation Engine

### 방어측 제안 (내부 관점)

| 조건 | 우선순위 | 메시지 |
|------|---------|--------|
| Guard 차단율 0% | HIGH | "{layer}를 통과한 공격이 있음" |
| 단일 엔드포인트 집중 >60% | MEDIUM | "{endpoint}에 공격 집중 — 추가 보강 필요" |
| Honeypot 미트리거 | MEDIUM | "공격자가 함정을 피하고 있음 — 새 트랩 경로 추가 고려" |
| 위협 점수 >50인 IP가 아직 차단 안 됨 | HIGH | "고위협 IP 미차단 — 사전 차단 임계값 조정 고려" |
| 200 응답 비율 >20% | HIGH | "공격 성공률이 높음 — 보안 체인 점검 필요" |

### 공격측 제안 (외부 관찰 가능 정보만)

| 조건 | 우선순위 | 메시지 |
|------|---------|--------|
| 403 비율 >80% | HIGH | "403 응답이 대부분 — 요청 헤더 구성이 부족할 수 있음" |
| 같은 IP 반복 차단 >90% | MEDIUM | "같은 IP에서 반복 차단 — IP 회전 필요" |
| 특정 엔드포인트만 200 | LOW | "일부 경로만 접근 가능 — 다른 경로 탐색 필요" |
| 요청 간격 CV <0.3 | HIGH | "요청 간격이 일정해서 차단됨 — 랜덤 딜레이 추가 필요" |
| Honeypot 트리거됨 | HIGH | "함정에 빠짐 — 예측 가능한 경로(`/api/internal/*`, `/api/v2/*`) 피해야 함" |

---

## Frontend (Scoreboard 탭)

기존 `public/index.html` SHIELD Command Center에 탭 추가.

### 레이아웃

```
┌─────────────────────────────────────────────────┐
│  SHIELD Command Center  [Tests] [Feed] [Score]  │  ← 탭 추가
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─────────────┐    ┌─────────────┐             │
│  │  DEFENSE     │    │  ATTACK     │             │
│  │   87.3%      │    │   12.7%     │             │
│  │  ████████░░  │    │  █░░░░░░░░  │             │
│  │  523 blocked │    │  76 success │             │
│  └─────────────┘    └─────────────┘             │
│                                                  │
│  ┌─ Guard Contribution ───────────────────────┐ │
│  │  IP Blacklist    ████████████  38.5%        │ │
│  │  Rate Limit      ██████       23.1%        │ │
│  │  UA Filter       ████         15.4%        │ │
│  │  Headless        ███           9.6%        │ │
│  │  Behavioral      ██            5.8%        │ │
│  │  Honeypot        █             1.9%        │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌─ Timeline ──────┐  ┌─ Recommendations ─────┐ │
│  │  ▁▃█▇▅▃▁▂▄█▇   │  │  🛡️ Defense:           │ │
│  │  blocked ── success│  │  - Honeypot 미트리거   │ │
│  │  5min intervals  │  │  ⚔️ Attack:            │ │
│  │                  │  │  - 403 대부분          │ │
│  └──────────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 실시간 갱신

- WebSocket `/security` 네임스페이스 재사용
- `security-event` 이벤트 수신 시 점수 카운터 업데이트
- 30초마다 summary API 자동 폴링으로 정확도 보정

### 스타일

- 기존 다크 테마 (배경 `#0a0e17`, 포스포 그린 `#00ff88`, 앰버 `#ff9f43`)
- 방어 = 그린(`#00ff88`), 공격 = 레드(`#ff4757`)
- JetBrains Mono + Outfit 폰트 유지

---

## File Structure

```
src/features/scoreboard/
├── scoreboard.module.ts
├── scoreboard.service.ts
└── scoreboard.controller.ts

public/index.html  ← "Scoreboard" 탭 추가 (기존 파일 수정)
```

## Testing

- `scoreboard.service.spec.ts`: summary/layers/timeline/recommendations 로직 단위 테스트
- 기존 E2E에 scoreboard 엔드포인트 추가 불필요 (admin API이므로 JWT 필요)
