# ==========================================
# Git Commit Messages for Refactoring
# ==========================================

# Commit 1: Value Objects 도입
refactor: RequestContext와 SecurityCheckResult Value Object 도입

- RequestContext: IP, UserAgent, Path 등 요청 정보를 캡슐화
- SecurityCheckResult: 보안 검증 결과를 명확하게 표현
- 데이터 뭉치(Data Clumps) 코드 스멜 해결

# Commit 2: Strategy Pattern 적용
refactor: 보안 검증 로직을 Strategy Pattern으로 분리

- UserAgentValidationStrategy: User-Agent 검증 로직 캡슐화
- HeadlessBrowserValidationStrategy: Headless 탐지 로직 분리
- HoneypotValidationStrategy: Honeypot 검증 로직 분리
- 긴 메서드(Long Method) 코드 스멜 해결

# Commit 3: Guard 단순화
refactor: Guard 클래스를 Strategy Pattern 사용하도록 리팩토링

- UserAgentGuard: Strategy 패턴 적용으로 단순화
- 단일 책임 원칙(SRP) 적용
- 테스트 가능성 향상

# Commit 4: Redis Service 책임 분리
refactor: RedisService를 작은 단위로 분리

- RedisConnectionManager: 연결 관리 전담
- RedisStatsService: 통계 관리 전담
- RedisCommandExecutor: 명령 실행 전담
- 큰 클래스(Large Class) 코드 스멜 해결

# Commit 5: 테스트 코드 추가
test: UserAgentGuard 단위 테스트 추가

- 모든 검증 시나리오에 대한 테스트 케이스
- 엄격 모드(strict mode) 테스트
- 리팩토링 안전성 보장

# Commit 6: 문서화
docs: 리팩토링 변경사항 문서화

- 새로운 아키텍처 패턴 설명
- 사용 예시 추가
- 마이그레이션 가이드
