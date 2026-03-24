# Threat Analysis & Pattern Learning System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 차단된 요청의 패턴을 분석하고 학습하여, 유사 패턴의 새 요청을 사전에 탐지/차단하는 위협 분석 시스템 구현

**Architecture:** 3개 서비스로 분리 — `ThreatScoreService`(IP별 위협 점수 관리, Redis), `PatternAnalysisService`(DB 기반 통계 분석), `ThreatAnalysisController`(Admin API). 기존 `SecurityEventService`의 `log()`에서 `ThreatScoreService.recordViolation()`을 호출하여 실시간 점수 갱신. 통계 분석은 DB 쿼리 기반으로 온디맨드 실행.

**Tech Stack:** NestJS, TypeScript, TypeORM (PostgreSQL), Redis/Memory Cache, 통계 기반 분석 (표준편차, Z-score)

---

## File Structure

```
src/
├── common/services/
│   └── threat-score.service.ts        # IP별 위협 점수 관리 (Redis, 시간 감쇠)
├── features/analysis/
│   ├── analysis.module.ts             # 분석 모듈
│   ├── analysis.controller.ts         # Admin API (패턴 분석 결과 조회)
│   ├── analysis.service.ts            # 패턴 분석 비즈니스 로직 (DB 쿼리)
│   └── analysis.service.spec.ts       # 단위 테스트
├── common/services/
│   └── threat-score.service.spec.ts   # 위협 점수 단위 테스트
```

**수정 대상:**
- `src/common/services/security-event.service.ts` — `log()`에서 ThreatScoreService 연동
- `src/common/common.module.ts` — ThreatScoreService 등록
- `src/api/v1/v1.module.ts` — AnalysisModule import
- `src/common/guards/ip-blacklist.guard.ts` — 위협 점수 기반 사전 차단

---

### Task 1: ThreatScoreService — IP별 위협 점수 관리

**Files:**
- Create: `src/common/services/threat-score.service.ts`
- Test: `src/common/services/threat-score.service.spec.ts`

- [ ] **Step 1: 위협 점수 서비스 테스트 작성**

```typescript
// src/common/services/threat-score.service.spec.ts
import { ThreatScoreService } from './threat-score.service';

describe('ThreatScoreService', () => {
  let service: ThreatScoreService;
  let mockCache: Record<string, unknown>;

  beforeEach(() => {
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
    };
    service = new ThreatScoreService(mockCache as any);
  });

  it('위반 기록 시 점수 증가', async () => {
    (mockCache.get as jest.Mock).mockResolvedValue(null);
    await service.recordViolation('1.2.3.4', 'USER_AGENT_BLOCKED', 'MEDIUM');
    expect(mockCache.set).toHaveBeenCalled();
  });

  it('HIGH 심각도는 더 높은 점수', async () => {
    (mockCache.get as jest.Mock).mockResolvedValue(null);
    await service.recordViolation('1.2.3.4', 'HEADLESS_BROWSER_DETECTED', 'HIGH');
    const setCall = (mockCache.set as jest.Mock).mock.calls[0];
    const score = setCall[1];
    expect(score.totalScore).toBeGreaterThan(10);
  });

  it('위협 점수 조회', async () => {
    (mockCache.get as jest.Mock).mockResolvedValue({ totalScore: 50, violations: 3 });
    const result = await service.getScore('1.2.3.4');
    expect(result.totalScore).toBe(50);
  });

  it('높은 위협 점수는 차단 권장', async () => {
    (mockCache.get as jest.Mock).mockResolvedValue({ totalScore: 80, violations: 5 });
    const shouldBlock = await service.shouldPreemptiveBlock('1.2.3.4');
    expect(shouldBlock).toBe(true);
  });

  it('낮은 위협 점수는 통과', async () => {
    (mockCache.get as jest.Mock).mockResolvedValue({ totalScore: 20, violations: 1 });
    const shouldBlock = await service.shouldPreemptiveBlock('1.2.3.4');
    expect(shouldBlock).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- --testPathPattern=threat-score`
Expected: FAIL — module not found

- [ ] **Step 3: ThreatScoreService 구현**

```typescript
// src/common/services/threat-score.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ICacheService } from '../../core/cache/interfaces/cache.interface';
import { RequestUtils } from '../utils/request.utils';

export interface ThreatScore {
  totalScore: number;
  violations: number;
  lastViolation: string;
  eventTypes: Record<string, number>;
  updatedAt: string;
}

const SCORE_WEIGHTS: Record<string, number> = {
  LOW: 5,
  MEDIUM: 15,
  HIGH: 30,
  CRITICAL: 50,
};

const PREEMPTIVE_BLOCK_THRESHOLD = 70;
const SCORE_TTL = 3600; // 1시간 후 감쇠

@Injectable()
export class ThreatScoreService {
  private readonly logger = new Logger(ThreatScoreService.name);

  constructor(
    @Inject('ICacheService') private readonly cache: ICacheService,
  ) {}

  async recordViolation(ip: string, eventType: string, severity: string): Promise<ThreatScore> {
    const key = `threat:${RequestUtils.normalizeIp(ip)}`;
    const existing = await this.cache.get<ThreatScore>(key);
    const weight = SCORE_WEIGHTS[severity] ?? 10;

    const score: ThreatScore = {
      totalScore: (existing?.totalScore ?? 0) + weight,
      violations: (existing?.violations ?? 0) + 1,
      lastViolation: eventType,
      eventTypes: { ...(existing?.eventTypes ?? {}), [eventType]: ((existing?.eventTypes ?? {})[eventType] ?? 0) + 1 },
      updatedAt: new Date().toISOString(),
    };

    await this.cache.set(key, score, SCORE_TTL);
    return score;
  }

  async getScore(ip: string): Promise<ThreatScore | null> {
    const key = `threat:${RequestUtils.normalizeIp(ip)}`;
    return this.cache.get<ThreatScore>(key);
  }

  async shouldPreemptiveBlock(ip: string): Promise<boolean> {
    const score = await this.getScore(ip);
    return (score?.totalScore ?? 0) >= PREEMPTIVE_BLOCK_THRESHOLD;
  }

  async resetScore(ip: string): Promise<void> {
    const key = `threat:${RequestUtils.normalizeIp(ip)}`;
    await this.cache.delete(key);
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- --testPathPattern=threat-score`
Expected: PASS

- [ ] **Step 5: CommonModule에 등록**

Modify: `src/common/common.module.ts` — providers/exports에 `ThreatScoreService` 추가

- [ ] **Step 6: 커밋**

```bash
git add src/common/services/threat-score.service.ts src/common/services/threat-score.service.spec.ts src/common/common.module.ts
git commit -m "feat: add ThreatScoreService for IP-based threat scoring"
```

---

### Task 2: SecurityEventService에 ThreatScore 연동

**Files:**
- Modify: `src/common/services/security-event.service.ts` — `log()`에서 `ThreatScoreService.recordViolation()` 호출

- [ ] **Step 1: SecurityEventService에 ThreatScoreService 주입**

`constructor`에 `ThreatScoreService` 추가 (forwardRef 불필요 — 단방향 의존)

- [ ] **Step 2: `log()` 메서드에 위협 점수 갱신 추가**

`checkAutoBlock` 호출 직전에:
```typescript
if (dto.ip && dto.severity) {
  this.threatScoreService.recordViolation(dto.ip, dto.eventType, dto.severity).catch(() => {});
}
```

- [ ] **Step 3: 빌드 확인**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: 기존 테스트 통과 확인**

Run: `npm test`
Expected: 41 tests passing

- [ ] **Step 5: 커밋**

```bash
git add src/common/services/security-event.service.ts
git commit -m "feat: integrate ThreatScoreService into security event logging"
```

---

### Task 3: PatternAnalysisService — DB 기반 통계 분석

**Files:**
- Create: `src/features/analysis/analysis.service.ts`
- Test: `src/features/analysis/analysis.service.spec.ts`

- [ ] **Step 1: 분석 서비스 구현**

```typescript
// src/features/analysis/analysis.service.ts
// 주요 메서드:
// - getTimeDistribution(hours: number): 시간대별 차단 분포
// - getTopBlockedIps(limit: number): 가장 많이 차단된 IP 순위
// - getTopBlockedUserAgents(limit: number): 가장 많이 차단된 UA 순위
// - getEndpointAnalysis(): 엔드포인트별 차단 통계
// - getRequestIntervalAnalysis(ip: string): 특정 IP의 요청 간격 분석 (평균, 표준편차, Z-score)
// - getAttackPatterns(): 공격 패턴 클러스터링 (eventType + severity 조합)
// - getSimilarIpPatterns(ip: string): 특정 IP와 유사한 패턴의 다른 IP 조회
```

- [ ] **Step 2: 요청 간격 분석 로직 구현 (핵심)**

```typescript
async getRequestIntervalAnalysis(ip: string, hours = 24) {
  const events = await this.repo.find({
    where: { ip, createdAt: MoreThanOrEqual(new Date(Date.now() - hours * 3600000)) },
    order: { createdAt: 'ASC' },
  });

  if (events.length < 3) return { ip, intervals: [], isBot: false, confidence: 0 };

  // 요청 간격 계산
  const intervals = [];
  for (let i = 1; i < events.length; i++) {
    intervals.push(events[i].createdAt.getTime() - events[i-1].createdAt.getTime());
  }

  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const stdDev = Math.sqrt(intervals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / intervals.length);
  const cv = mean > 0 ? stdDev / mean : 0; // 변동계수

  // CV < 0.3 = 봇 의심 (일정한 간격), CV > 0.8 = 사람 패턴
  const isBot = cv < 0.3 && intervals.length >= 5;
  const confidence = isBot ? Math.min(100, Math.round((1 - cv) * 100)) : 0;

  return { ip, intervals, mean, stdDev, cv, isBot, confidence, sampleSize: events.length };
}
```

- [ ] **Step 3: 테스트 작성 및 확인**

Run: `npm test -- --testPathPattern=analysis.service`

- [ ] **Step 4: 커밋**

```bash
git add src/features/analysis/
git commit -m "feat: add PatternAnalysisService with interval analysis and attack patterns"
```

---

### Task 4: AnalysisController + AnalysisModule — Admin API

**Files:**
- Create: `src/features/analysis/analysis.controller.ts`
- Create: `src/features/analysis/analysis.module.ts`
- Modify: `src/api/v1/v1.module.ts` — import AnalysisModule

- [ ] **Step 1: 컨트롤러 구현**

```
GET /admin/analysis/time-distribution?hours=24    — 시간대별 차단 분포
GET /admin/analysis/top-ips?limit=20              — 상위 차단 IP
GET /admin/analysis/top-user-agents?limit=20      — 상위 차단 UA
GET /admin/analysis/endpoints                     — 엔드포인트별 통계
GET /admin/analysis/interval/:ip                  — IP 요청 간격 분석
GET /admin/analysis/patterns                      — 공격 패턴 클러스터
GET /admin/analysis/similar/:ip                   — 유사 패턴 IP 조회
GET /admin/analysis/threat-score/:ip              — IP 위협 점수 조회
```

모든 엔드포인트: `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles('admin')`

- [ ] **Step 2: AnalysisModule 생성 및 v1.module에 등록**

- [ ] **Step 3: 빌드 + E2E 확인**

Run: `npx tsc --noEmit && npm test && npm run test:e2e`

- [ ] **Step 4: 커밋**

```bash
git add src/features/analysis/ src/api/v1/v1.module.ts
git commit -m "feat: add analysis admin API endpoints for threat pattern analysis"
```

---

### Task 5: IpBlacklistGuard에 위협 점수 기반 사전 차단

**Files:**
- Modify: `src/common/guards/ip-blacklist.guard.ts`

- [ ] **Step 1: Guard에 ThreatScoreService 주입**

- [ ] **Step 2: `canActivate()`에서 블랙리스트 체크 후 위협 점수 체크 추가**

```typescript
// 기존 블랙리스트 체크 이후
if (!isBlocked) {
  const shouldBlock = await this.threatScoreService.shouldPreemptiveBlock(ip);
  if (shouldBlock) {
    // 위협 점수 기반 사전 차단 + 자동 블랙리스트 등록
    await this.ipBlacklistService.blockIp(ip, 'SUSPICIOUS_BEHAVIOR', 3600);
    this.securityEventService.log({ eventType: 'AUTO_BLOCKED', severity: 'HIGH', ip, ... });
    throw new IpBlockedException(this.hashIp(ip), 'Threat score exceeded');
  }
}
```

- [ ] **Step 3: 기존 테스트 + E2E 통과 확인**

Run: `npm test && npm run test:e2e`

- [ ] **Step 4: 커밋**

```bash
git add src/common/guards/ip-blacklist.guard.ts
git commit -m "feat: preemptive blocking based on threat score in IpBlacklistGuard"
```

---

### Task 6: 문서 업데이트

**Files:**
- Modify: `README.md` — 위협 분석 API 섹션 추가
- Modify: `CHANGELOG.md` — v2.3.0 추가
- Modify: `CLAUDE.md` — 분석 모듈 구조 반영

- [ ] **Step 1: README에 분석 API 엔드포인트 추가**
- [ ] **Step 2: CHANGELOG v2.3.0 작성**
- [ ] **Step 3: CLAUDE.md 구조도 업데이트**
- [ ] **Step 4: 커밋**

```bash
git add README.md CHANGELOG.md CLAUDE.md
git commit -m "docs: add threat analysis system documentation"
```
