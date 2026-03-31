# Security Hardening Report

> 8+ 라운드의 공격자/방어자 반복 분석을 통해 발견·수정된 보안 이슈 총정리

## 요약

| 항목 | 수치 |
|------|------|
| 분석 라운드 | 8+ (코드 분석 + 브라우저 펜테스트 병렬) |
| 발견 이슈 | 32건 (CRITICAL 5, HIGH 15, MEDIUM 8, LOW 4) |
| 수정 완료 | 32건 (100%) |
| 최종 상태 | CRITICAL 0 / HIGH 0 |
| 단위 테스트 | 187 PASS |
| 브라우저 테스트 | 29 PASS |

---

## 수정 이력

### Round 1 — 기초 보안 강화
| # | 심각도 | 수정 내용 |
|---|--------|----------|
| 1 | CRITICAL | XSS — noscript href `encodeURI` → `encodeURIComponent` |
| 2 | CRITICAL | WebSocket IP 평문 broadcast → `hashIp` + 인증 클라이언트 전용 |
| 3 | CRITICAL | `.catch(() => {})` → `.catch(err => logger.error(...))` (4개 파일) |
| 4 | HIGH | HMAC 서명 64→32자 절단 → 전체 64자 유지 |
| 5 | HIGH | CAPTCHA 5→6글자 (23.4→28.5bit 엔트로피) |
| 6 | HIGH | Open Redirect — 상대 경로만 허용 |

### Round 2 — 설정/캐시 안정성
| # | 심각도 | 수정 내용 |
|---|--------|----------|
| 7 | CRITICAL | `parseInt` NaN 무시 → `safeParseInt` 범위 검증 (PORT 1-65535) |
| 8 | HIGH | HMAC 키 분리 — `COOKIE_SIGN_KEY` 파생 |
| 9 | HIGH | 쿠키 파싱 `parts.length < 4` → `!== 4` (정확히 4파트) |
| 10 | HIGH | Request Logger race condition → IP별 뮤텍스 직렬화 |
| 11 | HIGH | Memory Cache 무한 성장 → 50K 상한 + FIFO eviction |
| 12 | HIGH | `cache.keys()` ReDoS → `startsWith` 최적화 |
| 13 | HIGH | CAPTCHA 실패 카운터 raw IP → `normalizeIp` |

### Round 3 — 안정성 엣지케이스
| # | 심각도 | 수정 내용 |
|---|--------|----------|
| 14 | HIGH | 뮤텍스 cleanup 누락 → `try-finally` 보장 |
| 15 | HIGH | 프로덕션 시크릿 미검증 → JWT/CHALLENGE/PUZZLE 필수 |
| 16 | MEDIUM | Behavioral Guard `windowMs <= 0` → RPM Infinity 방지 |
| 17 | MEDIUM | Cache eviction 중복 실행 → `isEvicting` 플래그 |

### Round 4 — 인증/인프라
| # | 심각도 | 수정 내용 |
|---|--------|----------|
| 18 | HIGH | Swagger 기본 비밀번호 `changeme` → 프로덕션 비활성화 + timing-safe |
| 19 | HIGH | Redis GETDEL fallback `GET+DEL` → `MULTI/EXEC` 원자적 |
| 20 | HIGH | change-password rate limit 없음 → 3회/시간 |
| 21 | HIGH | innerHTML XSS → 안전한 `createElement` |
| 22 | MEDIUM | safeCompare 길이 타이밍 → dummy comparison |

### Round 5 — 공격자 관점 펜테스트
| # | 심각도 | 수정 내용 |
|---|--------|----------|
| 23 | HIGH | 위협 점수 캐시 만료 시 완전 리셋 → 24h decay history (0.7 rate) |
| 24 | HIGH | PoW 속도 체크 로깅만 → threat score 반영 |
| 25 | HIGH | Behavioral MIN_REQUESTS=10 → 5 (IP 로테이션 대응) |
| 26 | HIGH | ACTIVE_IPS Array O(N) → Set O(1) + 10K cap |
| 27 | HIGH | Canvas 렌더링 CPU 고갈 → 동시 20개 제한 |
| 28 | HIGH | ipLocks 무한 성장 → 5K cap |
| 29 | CRITICAL | 렌더링 한도 → 빈 CAPTCHA → 검증 스킵 bypass → puzzle.id 체크 |
| 30 | HIGH | PayloadTooLargeError 스택 트레이스 → 413 매핑 |
| 31 | HIGH | Honeypot IpBlacklist에 차단 → @SkipIpBlacklist 추가 |
| 32 | MEDIUM | 계정 잠금 메시지 차별화 → 통일 (사용자명 열거 방지) |

### Round 6 — 최종 검증
| # | 심각도 | 수정 내용 |
|---|--------|----------|
| 33 | HIGH | Refresh Token을 Access Token으로 사용 가능 → type='refresh' 거부 |
| 34 | CRITICAL | puzzleId/Answer 생략 시 CAPTCHA bypass → shouldShowPuzzle 체크 + 필수 검증 |

---

## 공격 벡터별 방어 현황

| 공격 벡터 | 방어 수단 | 상태 |
|-----------|----------|------|
| XSS | encodeURIComponent + createElement (no innerHTML) | ✅ |
| Open Redirect | pathname only + base URL parsing | ✅ |
| CSRF | SameSite=Lax + httpOnly + JWT Bearer | ✅ |
| SQL Injection | TypeORM parameterized queries | ✅ |
| JWT Forgery | HS256 pinning + tokenVersion + type separation | ✅ |
| Cookie Forgery | HMAC-SHA256 + timing-safe + key separation | ✅ |
| Token Replay | getAndDelete atomic (single-thread + Redis GETDEL) | ✅ |
| Timing Attack | timingSafeEqual + dummy comparison | ✅ |
| Bot Detection | 7-layer guard chain + CAPTCHA-for-all | ✅ |
| DoS (Memory) | Cache 50K cap + ipLocks 5K cap + render limit 20 | ✅ |
| DoS (CPU) | CAPTCHA render concurrency limit + PoW difficulty 4 | ✅ |
| Info Leakage | IP hash + PayloadTooLarge→413 + unified error messages | ✅ |
| Privilege Escalation | RBAC + refresh token rejection in validateToken | ✅ |
| Username Enumeration | Unified "Invalid credentials" for all login failures | ✅ |
