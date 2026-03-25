# 보안 Guard 전역화 설계

## 목표
모든 API 요청이 동일한 5단계 보안 체인을 통과하도록 변경

## 보안 체인
```
모든 요청 → ThrottlerGuard → IpBlacklistGuard → UserAgentGuard → HeadlessBrowserGuard → Route Handler
```

## Skip 데코레이터 매핑

| 엔드포인트 | Throttle | IpBlacklist | UserAgent | Headless |
|-----------|:---:|:---:|:---:|:---:|
| GET / (root) | Skip | Skip | Skip | Skip |
| GET /health/* | Skip | Skip | Skip | Skip |
| POST /auth/login,register | - | Skip | Skip | Skip |
| POST /auth/change-password | - | - | - | - |
| GET /admin/* | Skip | - | - | - |
| GET /admin/analysis/* | Skip | - | - | - |
| GET /api/public/* | - | - | - | - |
| GET /test/* | - | - | - | - |
| GET /api/client/* | - | - | - | - |

## 변경 파일
- `user-agent.guard.ts` — SkipUserAgent 데코레이터 + Reflector
- `headless-browser.guard.ts` — SkipHeadlessBrowser 데코레이터 + Reflector
- `app.module.ts` — APP_GUARD 2개 추가
- `app.controller.ts` — Skip 데코레이터
- `health.controller.ts` — Skip 데코레이터
- `auth.controller.ts` — login/register에 Skip
- `public.controller.ts` — @UseGuards 제거
- `testing.controller.ts` — @UseGuards 제거
- E2E 테스트 업데이트

## 패턴 (IpBlacklistGuard와 동일)
```typescript
export const SKIP_USER_AGENT_KEY = 'skipUserAgent';
export const SkipUserAgent = () => SetMetadata(SKIP_USER_AGENT_KEY, true);
```
