# 의존성 주입 문제 해결

## 문제
`IpBlacklistService`가 `ConfigurationService` 대신 `ConfigService`를 사용해야 합니다.

## 해결
1. `IpBlacklistService`를 `ConfigService` 사용하도록 수정 완료
2. `CommonModule`에서 필요한 서비스들 제공

## 테스트
```bash
npm run start:dev
```
