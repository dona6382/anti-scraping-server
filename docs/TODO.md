# TODO

## 완료 (v2.0.0 → v2.6.0)

### 핵심 기능
- [x] 3계층 모듈 구조 (Core → Common → Features)
- [x] JWT 인증 (access 15m + refresh 7d + tokenVersion 무효화 + 타입 분리)
- [x] 계정 잠금 (5회 실패 → 15분, 통일된 에러 메시지)
- [x] RBAC (Admin/User 역할 기반 접근 제어)

### 보안 체인 (7-layer)
- [x] ThrottlerGuard (전역 + per-endpoint)
- [x] IpBlacklistGuard (IP/CIDR 차단, 자동 단계별 차단)
- [x] UserAgentGuard (봇 UA 필터링)
- [x] HeadlessBrowserGuard (11-signal 탐지 + 헤더 순서 핑거프린팅)
- [x] BehavioralGuard (CV + RPM 분석, MIN_REQUESTS=5)
- [x] TlsFingerprintGuard (Nginx X-TLS-Fingerprint, signal-only)
- [x] ChallengeGuard (PoW + Canvas CAPTCHA)

### CAPTCHA 시스템
- [x] Canvas PNG 텍스트 CAPTCHA (6글자, 혼동 문자 제외)
- [x] 10초 TTL (AI/OCR 비용 부과 목적)
- [x] PUZZLE_THRESHOLD=0 (모든 방문자, 의도적)
- [x] 5회 실패 시 IP 자동 블랙리스트
- [x] 렌더링 동시 실행 20개 제한 (CPU 보호)
- [x] puzzleId/Answer 필수 검증 (빈 문자열 bypass 방지)

### 암호화/보안 강화 (30+ fixes)
- [x] HMAC-SHA256 전체 64자 (절단 제거)
- [x] COOKIE_SIGN_KEY 파생 (키 분리 원칙)
- [x] timing-safe 비교 (dummy comparison on length mismatch)
- [x] getAndDelete 원자적 (Redis GETDEL / MULTI·EXEC)
- [x] XSS 방지: innerHTML → createElement, encodeURIComponent
- [x] Open Redirect 방지: pathname only
- [x] PayloadTooLargeError → 413 매핑
- [x] Swagger 프로덕션 비활성화 + timing-safe Basic Auth
- [x] Refresh Token Access Token 사용 방지 (type 검증)
- [x] 사용자명 열거 방지 (통일된 에러 메시지)

### 인프라 안정성
- [x] Memory Cache 50K 상한 + FIFO eviction + isEvicting 플래그
- [x] cache.keys() ReDoS 방지 (startsWith 최적화)
- [x] Request Logger IP별 뮤텍스 (try-finally) + 5K cap
- [x] ACTIVE_IPS Set O(1) + 10K cap
- [x] safeParseInt 범위 검증 (PORT 1-65535)
- [x] 프로덕션 시크릿 필수 검증 (JWT/CHALLENGE/PUZZLE)

### 기타
- [x] 위협 점수 감쇠 (2h TTL + 24h history, 0.7 decay)
- [x] PoW 속도 체크 → threat score 반영
- [x] Honeypot @SkipIpBlacklist (블랙리스트 IP도 함정 도달)
- [x] WebSocket IP 해시 + 인증 클라이언트 전용 broadcast
- [x] fire-and-forget 에러 로깅 (silent catch 전면 제거)
- [x] Scoreboard 대시보드 + Admin API
- [x] 실시간 WebSocket 대시보드 (JWT+admin)
- [x] 프론트엔드 대시보드 (Security Tests, Live Feed, Scoreboard)

---

## Backlog (비차단 — 선택적 개선)

### P2 — 성능/아키텍처
- [ ] CIDR 매칭 최적화: O(N) → Trie 또는 정렬 기반 이진 탐색
- [ ] IPv6 서브넷 처리 개선: /64 prefix 기반 쿠키 바인딩
- [ ] auto-block 카운터 Redis INCR 원자적 증가
- [ ] process.env 잔여 사용처 → AppConfigService 전면 통일

### P3 — 추가 보안
- [ ] Tarpit Strategy — 봇에게 의도적으로 느린 응답
- [ ] 라이브러리화: `AntiScrapingModule.forRoot()` DynamicModule
- [ ] 봇 탐지 CV threshold 동적 조정 (Admin API)
- [ ] Refresh Token 로테이션 (매 refresh 시 새 토큰 발급)

### 별도 프로젝트
- [ ] 공격 스크래퍼 레포: 이 서버를 대상으로 5단계 스크래핑 시도 (공격 vs 방어)
