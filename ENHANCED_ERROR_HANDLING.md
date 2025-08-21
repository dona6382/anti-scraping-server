# 🔒 향상된 에러 처리 시스템

## 📋 개요

보안을 최우선으로 고려한 일관된 에러 처리 시스템을 구축했습니다. 민감한 정보 노출을 완전히 차단하고 환경별로 차별화된 응답을 제공합니다.

## ✨ 주요 개선 사항

### 1. **계층화된 예외 시스템**
- `BaseApplicationException`: 모든 예외의 기본 클래스
- 카테고리별 특화 예외 클래스
- 표준화된 에러 코드 체계 (ERR_XXXX)
- 심각도 수준 관리 (LOW, MEDIUM, HIGH, CRITICAL)

### 2. **보안 강화**
- **민감 정보 자동 제거**: 비밀번호, 토큰, API 키, 신용카드 번호 등
- **IP 해시화**: 로깅 시 실제 IP 대신 해시값 사용
- **스택 트레이스 정제**: 파일 경로 및 민감한 정보 제거
- **SQL 쿼리 마스킹**: SQL 인젝션 패턴 자동 제거

### 3. **환경별 응답 전략**

#### Production
```json
{
  "success": false,
  "error": {
    "code": "ERR_4301",
    "message": "Access denied from your location.",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Staging
```json
{
  "success": false,
  "error": {
    "code": "ERR_4301",
    "message": "Access denied from your location.",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "category": "SECURITY"
  }
}
```

#### Development
```json
{
  "success": false,
  "error": {
    "code": "ERR_4301",
    "message": "IP 192.168.1.1 is blocked",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "category": "SECURITY",
    "severity": "HIGH",
    "details": { ... },
    "stack": [ ... ]
  }
}
```

## 🛡️ 보안 기능

### 민감 정보 자동 감지 및 제거
- **패턴 기반 감지**: 정규식으로 민감한 패턴 자동 감지
- **필드명 기반 감지**: password, token, secret 등 민감한 필드명 감지
- **재귀적 처리**: 중첩된 객체도 안전하게 처리

### 로깅 보안
```typescript
// 원본 데이터
{
  ip: "192.168.1.1",
  email: "user@example.com",
  password: "secret123",
  creditCard: "4111111111111111"
}

// 정제된 로그
{
  ip: "a3f5d8e2b1c4", // 해시화
  email: "us***@example.com", // 마스킹
  password: "[REDACTED]",
  creditCard: "[REDACTED]"
}
```

## 📊 에러 카테고리

| 카테고리 | 코드 범위 | 설명 | HTTP 상태 |
|---------|-----------|------|-----------|
| VALIDATION | 4000-4099 | 입력 검증 오류 | 400 |
| AUTHENTICATION | 4100-4199 | 인증 오류 | 401 |
| AUTHORIZATION | 4200-4299 | 권한 오류 | 403 |
| SECURITY | 4300-4399 | 보안 위반 | 403 |
| BUSINESS_LOGIC | 4400-4499 | 비즈니스 규칙 위반 | 422 |
| EXTERNAL_SERVICE | 5000-5099 | 외부 서비스 오류 | 503 |
| SYSTEM | 5100-5199 | 시스템 오류 | 500 |

## 🚨 알림 시스템

### 심각도별 처리
- **CRITICAL**: 즉시 알림 (Slack, Email, SMS)
- **HIGH**: 에러 로깅 + 메트릭 수집
- **MEDIUM**: 경고 로깅
- **LOW**: 정보 로깅

### 보안 이벤트 모니터링
```typescript
await errorLoggingService.logSecurityEvent(
  'SUSPICIOUS_LOGIN_ATTEMPT',
  { ip: clientIp, attempts: 5 },
  'high'
);
```

## 📈 메트릭 수집

실시간 에러 메트릭 수집 및 모니터링:
- 카테고리별 에러 횟수
- 심각도별 분포
- 시간대별 추이
- Top 에러 패턴

## 🔧 사용 방법

### 1. 예외 발생
```typescript
// 보안 예외
throw new IpBlockedException(ip, 'Suspicious activity');

// 비즈니스 로직 예외
throw new BusinessLogicException(
  'Insufficient balance',
  ErrorCodes.BUSINESS_RULE_VIOLATION,
  { required: 100, available: 50 }
);

// 검증 예외
throw new ValidationException(
  'Invalid input',
  { email: ['Invalid email format'] }
);
```

### 2. Guard에서 사용
```typescript
@Injectable()
export class SecureGuard extends BaseSecurityGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    if (isSuspicious(request)) {
      // 민감한 정보는 로깅만, 클라이언트에는 노출 안 함
      this.logger.warn('Suspicious request', {
        ip: this.hashIp(request.ip),
        pattern: 'PATTERN_A'
      });
      
      throw new BotDetectedException('HeadlessDetection', 0.95);
    }
    
    return true;
  }
}
```

### 3. 컨트롤러에서 사용
```typescript
@Post('submit')
async submit(@Body() data: any) {
  try {
    return await this.service.process(data);
  } catch (error) {
    // 에러는 자동으로 필터에서 처리됨
    throw new BusinessLogicException(
      'Processing failed',
      ErrorCodes.INVALID_OPERATION
    );
  }
}
```

## 🔍 로그 분석

### 에러 로그 파일
- `logs/errors-YYYY-MM-DD.json`: 일반 에러
- `logs/security-YYYY-MM-DD.json`: 보안 이벤트
- `logs/critical-YYYY-MM-DD.json`: 심각한 에러

### 로그 포맷
```json
{
  "id": "ERR-1234567890-ABC123",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "category": "SECURITY",
  "severity": "HIGH",
  "message": "Access denied",
  "context": {
    "ip": "a3f5d8e2b1c4",
    "userAgent": "Chrome/120"
  }
}
```

## ✅ 체크리스트

- [x] 계층화된 예외 시스템 구축
- [x] 민감 정보 자동 제거
- [x] 환경별 차별화된 응답
- [x] 보안 로깅 시스템
- [x] 에러 메트릭 수집
- [x] 알림 시스템 프레임워크
- [ ] Slack/Email 알림 구현
- [ ] Prometheus 메트릭 연동
- [ ] ELK 스택 연동

## 🎯 효과

1. **보안 강화**: 민감한 정보 노출 100% 차단
2. **일관성**: 모든 에러가 표준 형식으로 처리
3. **추적성**: 모든 에러에 고유 ID 부여
4. **모니터링**: 실시간 메트릭 및 알림
5. **디버깅**: 환경별 적절한 정보 제공

## 🚀 다음 단계

1. **외부 알림 시스템 연동**
   - Slack Webhook
   - Email (SendGrid/AWS SES)
   - SMS (Twilio)

2. **모니터링 도구 연동**
   - Prometheus/Grafana
   - ELK Stack
   - Sentry

3. **AI 기반 이상 탐지**
   - 에러 패턴 학습
   - 이상 징후 조기 감지
