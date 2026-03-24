# TODO

## Next Priority

### 보안 Guard 전역화 — 통합 보안 체인
**목표:** 모든 API 요청이 동일한 5단계 보안 체인을 통과하도록 변경

**현재 문제:**
- `ThrottlerGuard`, `IpBlacklistGuard`만 전역 (APP_GUARD)
- `UserAgentGuard`, `HeadlessBrowserGuard`는 라우트별 `@UseGuards()`로 개별 적용
- 엔드포인트마다 보안 수준이 다름 — 테스트/관리가 복잡

**변경:**
```
모든 요청 → ThrottlerGuard → IpBlacklistGuard → UserAgentGuard → HeadlessBrowserGuard → Route Handler
```

- `UserAgentGuard`, `HeadlessBrowserGuard`를 `app.module.ts`에 APP_GUARD 등록
- `@SkipUserAgent()`, `@SkipHeadlessBrowser()` 데코레이터 추가 (Health, Auth 등 제외용)
- 기존 `@UseGuards(UserAgentGuard)` 개별 적용 코드 제거
- 아무 API 호출해도 전체 보안 체인 작동

**영향 범위:**
- `src/app.module.ts` — APP_GUARD 2개 추가
- `src/common/guards/user-agent.guard.ts` — @SkipUserAgent 데코레이터 추가
- `src/common/guards/headless-browser.guard.ts` — @SkipHeadlessBrowser 데코레이터 추가
- `src/features/testing/testing.controller.ts` — 개별 @UseGuards 제거
- `src/features/public/public.controller.ts` — 개별 @UseGuards 제거
- Health, Auth 엔드포인트에 Skip 데코레이터 적용
- E2E 테스트 업데이트

---

## Backlog (설계/기능 변경)

### 기능 추가
- [ ] JWT Refresh Token + 토큰 무효화 (블랙리스트)
- [ ] 계정 잠금 (failedLoginAttempts 카운터)
- [ ] testing 모듈 프로덕션 비활성화
- [ ] client-info 엔드포인트 인증 추가 + 민감 헤더 필터링
- [ ] admin/cache 네임스페이스별 분리 (블랙리스트 보호)
- [ ] 실시간 WebSocket 대시보드
- [ ] CIDR / IP 범위 차단

### 리팩토링
- [ ] process.env → AppConfigService 전면 통일 (6곳+)
- [ ] auto-block 카운터 Redis INCR 원자적 증가
- [ ] 라이브러리화 (`AntiScrapingModule.forRoot()` DynamicModule)

### 보안 강화
- [ ] Swagger 프로덕션 보호 (Basic Auth)
- [ ] 봇 탐지 CV threshold 동적 조정
- [ ] TLS fingerprinting (JA3/JA4)
- [ ] 클라이언트 사이드 JS SDK (Canvas, WebGL fingerprint)
