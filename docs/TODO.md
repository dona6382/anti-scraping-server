# TODO

## 완료 (v2.0.0 → v2.5.0)

- [x] 3계층 모듈 구조 정리 (Core → Common → Features)
- [x] JWT 인증 활성화 + Admin/Security RBAC 보호
- [x] IpBlacklistGuard 전역화 (APP_GUARD)
- [x] SecurityEventService + DB 기록
- [x] 자동 IP 차단 (위반 횟수 기반 단계별)
- [x] GeoIP / VPN / Tor / 데이터센터 IP 탐지
- [x] JWT Refresh Token + 토큰 무효화 (tokenVersion)
- [x] 계정 잠금 (5회 실패 → 15분 잠금)
- [x] testing 모듈 프로덕션 비활성화
- [x] client-info 엔드포인트 JWT 인증 + IP 해시화
- [x] admin/cache 네임스페이스 분리
- [x] 실시간 WebSocket 대시보드 (JWT+admin)
- [x] CIDR / IP 범위 차단
- [x] UserAgentGuard, HeadlessBrowserGuard 전역화 (APP_GUARD)
- [x] @SkipUserAgent, @SkipHeadlessBrowser, @SkipChallenge, @SkipBehavioral 데코레이터
- [x] 위협 점수 시스템 (ThreatScoreService)
- [x] 패턴 분석 시스템 (AnalysisService) + Admin API
- [x] JS Challenge + Browser Fingerprint (PoW + HMAC + 서명 쿠키)
- [x] 보안 강화: timingSafeEqual, atomic getAndDelete, XSS 방어, DTO MaxLength
- [x] 적응형 PoW 난이도: getDifficulty() ↔ ThreatScoreService 연동 (기본 4, 위협 시 5→6)
- [x] BehavioralGuard: 실시간 CV 기반 봇 자동 차단
- [x] Honeypot 트랩 엔드포인트 (/api/internal/*, /api/v2/data)
- [x] Fingerprint 크로스-IP 추적 (>3 서브넷 → SUSPICIOUS_ACTIVITY)
- [x] Request Logger Middleware (전 요청 행동 데이터 캐시 수집)
- [x] 실시간 분석 API (행동 분석, 핑거프린트 분석)
- [x] Swagger Basic Auth 보호
- [x] 침투 테스트 100% 방어율 (10/10 시나리오)
- [x] 일반 사용자 경험 테스트 0건 차단 (7/7 시나리오)
- [x] 174 unit (14 suites) + 28 E2E 테스트
- [x] 영문 + 한국어 이중 문서

---

## Backlog (비차단 — 선택적 개선)

### P2 — 성능/아키텍처
- [ ] CIDR 매칭 최적화: O(N) → Trie 또는 정렬 기반 이진 탐색
- [ ] IPv6 서브넷 처리 개선: /64 prefix 기반 쿠키 바인딩
- [ ] EventEmitter 디커플링: SecurityEventService → Guard 직접 의존 제거
- [ ] auto-block 카운터 Redis INCR 원자적 증가
- [ ] process.env 잔여 사용처 → AppConfigService 전면 통일

### P3 — 추가 보안
- [ ] TLS Fingerprinting (JA3/JA4) — 프록시 회전 추가 방어
- [ ] Tarpit Strategy — 봇에게 의도적으로 느린 응답
- [ ] 라이브러리화: `AntiScrapingModule.forRoot()` DynamicModule
- [ ] 봇 탐지 CV threshold 동적 조정 (Admin API)

### 별도 프로젝트
- [ ] 공격 스크래퍼 레포: 이 서버를 대상으로 5단계 스크래핑 시도 (포트폴리오 "공격 vs 방어")
