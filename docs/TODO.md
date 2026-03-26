# TODO

## 완료 (v2.1.0 ~ v2.4.0)

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
- [x] @SkipUserAgent, @SkipHeadlessBrowser, @SkipChallenge 데코레이터
- [x] 위협 점수 시스템 (ThreatScoreService)
- [x] 패턴 분석 시스템 (AnalysisService) + Admin API 8개
- [x] JS Challenge + Browser Fingerprint (PoW + HMAC + 서명 쿠키)
- [x] 보안 강화: timingSafeEqual, atomic getAndDelete, XSS 방어, DTO MaxLength
- [x] process.env → AppConfigService 일부 통일

---

## Backlog

### P1 — 기능 개선
- [ ] 적응형 PoW 난이도: `getDifficulty()` ↔ ThreatScoreService 연동
- [ ] CIDR 매칭 최적화: O(N) → Trie 또는 정렬 기반 이진 탐색
- [ ] IPv6 서브넷 처리 개선: /64 prefix 기반 쿠키 바인딩
- [ ] EventEmitter 디커플링: SecurityEventService → Guard 직접 의존 제거

### P2 — 보안 강화
- [ ] TLS Fingerprinting (JA3/JA4) — 프록시 회전 추가 방어
- [ ] Behavioral Analysis Middleware — 요청 간격/패턴 실시간 분석
- [ ] Tarpit Strategy — 봇에게 의도적으로 느린 응답
- [ ] Swagger 프로덕션 보호 (Basic Auth 또는 비활성화)
- [ ] auto-block 카운터 Redis INCR 원자적 증가

### P3 — 아키텍처
- [ ] 라이브러리화: `AntiScrapingModule.forRoot()` DynamicModule
- [ ] process.env 잔여 사용처 → AppConfigService 전면 통일
- [ ] 봇 탐지 CV threshold 동적 조정 (Admin API)

### 별도 프로젝트
- [ ] 공격 스크래퍼 레포: 이 서버를 대상으로 스크래핑 시도 (포트폴리오 "공격 vs 방어")
