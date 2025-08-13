# 삭제된 파일들

## 이유: 사용하지 않는 코드 정리

### 1. 백업 디렉토리
- `src/shared.bak/` → `src/shared.bak.deleted/` (이름 변경으로 비활성화)

### 2. 중복 스크립트 파일들 (다음 파일들을 삭제 예정)
- `check-code.sh` - `final-check.sh`와 중복
- `chmod-all.sh` - `make-all-executable.sh`와 중복  
- `fix-axios.sh` - 더 이상 필요 없음
- `fix-compile-errors.sh` - 더 이상 필요 없음
- `install-and-run.sh` - `install-deps.sh`와 중복
- `install-axios.sh` - package.json에서 관리
- `make-all-executable.sh` - `chmod-all.sh`와 중복
- `quick-test.sh` - `test-compile.sh`와 중복
- `setup-lint.sh` - 더 이상 필요 없음
- `test-compile.sh` - `test-ts.sh`와 중복
- `verify.sh` - `final-check.sh`와 중복

### 3. 기본 NestJS 테스트 파일
- `src/app.controller.spec.ts` - 기본 템플릿 테스트
- `test/app.e2e-spec.ts` - 기본 e2e 테스트

### 4. 유지할 중요 파일들
- `GO.sh` - 메인 시작 스크립트
- `launch.sh` - 예쁜 시작 인터페이스
- `start-server.sh` - 심플한 시작
- `run.sh` - 기본 시작
- `final-check.sh` - 종합 체크
- `install-deps.sh` - 의존성 설치
- `test-scripts/` - 실제 API 테스트

## 삭제 날짜: $(date '+%Y-%m-%d %H:%M:%S')
