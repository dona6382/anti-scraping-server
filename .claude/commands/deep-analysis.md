이 프로젝트의 코드를 심층분석해. 코드 분석과 실제 브라우저 테스트를 병렬로 실행해.

## 프로세스

1. 서버 실행 확인 (localhost:3000)
2. 두 에이전트를 **병렬** 실행:
   - 🔍 **코드 분석 에이전트** (Explore subagent): 보안, 아키텍처, 코드 품질, 테스트 커버리지, 프로덕션 준비도
   - 🌐 **브라우저 테스트 에이전트** (general-purpose): Playwright headed 모드로 실제 기능 검증
3. 양쪽 결과를 통합하여 보고

## 코드 분석 범위

- **보안**: guards, auth, crypto, input validation, info leakage
- **아키텍처**: 모듈 구조, 순환 의존성, 계층 분리
- **코드 품질**: TypeScript 엄격성, 에러 처리, 메모리 누수
- **테스트 커버리지**: 미테스트 크리티컬 경로, 엣지 케이스
- **프로덕션 준비도**: Docker, 환경변수, graceful shutdown

## 브라우저 테스트 항목

| 그룹 | 테스트 |
|------|--------|
| A. 핵심 기능 | GET /, /health, /health/live, /health/ready |
| B. Guard 체인 | 보호 엔드포인트 쿠키 없이 → 403, 응답 포맷 확인 |
| C. 인증 | 잘못된 로그인 → 401, 필드 누락 → 400, JWT 없이 admin → 403 |
| D. 보안 헤더 | Helmet 헤더, X-Powered-By 제거 확인 |
| E. Rate Limiting | Health 면제, 보호 엔드포인트 제한 |
| F. WebSocket | Socket.io SID, 미인증 차단 |
| G. Edge Cases | 404, 빈 UA, SQL injection, XSS, 대용량 body |
| H. Challenge 플로우 | 보호 페이지 접근 → challenge/CAPTCHA 확인 |

## 브라우저 테스트 설정
- headless: false (사용자가 볼 수 있도록)
- 요청 간 150ms 딜레이
- 스크린샷 /tmp/ 에 저장

## False Positive 방지
- Node.js 싱글스레드 → 동기 코드 race condition 아님
- HMAC-SHA256 + 64바이트 키 → brute force 불가
- 설계 의도된 동작은 취약점이 아님
- Playwright headless 탐지 → 정상 동작 (WARN이지 FAIL 아님)

## 출력 형식

```
## 코드 분석: {CRITICAL}C / {HIGH}H / {MEDIUM}M / {LOW}L
## 브라우저 테스트: {PASS}/{TOTAL} PASS

### 발견 이슈
| # | 출처 | 심각도 | 설명 |

### 테스트 결과
| # | 테스트 | 결과 | 상세 |
```
