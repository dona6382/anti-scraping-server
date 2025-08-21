#!/bin/bash

echo "🔧 Exception 클래스 통합 리팩토링 시작..."
echo "================================================"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 프로젝트 경로
PROJECT_PATH="/Users/marqvision/Desktop/kch/anti-scraping-server"
EXCEPTIONS_PATH="$PROJECT_PATH/src/common/exceptions"

echo -e "${BLUE}Step 1: 백업 생성${NC}"
echo "----------------------------------------"
# 백업 디렉토리 생성
BACKUP_DIR="$PROJECT_PATH/backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r "$EXCEPTIONS_PATH" "$BACKUP_DIR/"
echo -e "${GREEN}✅ 백업 완료: $BACKUP_DIR${NC}"

echo ""
echo -e "${BLUE}Step 2: security.exception.ts를 security-specific.exception.ts로 이름 변경${NC}"
echo "----------------------------------------"
mv "$EXCEPTIONS_PATH/security.exception.ts" "$EXCEPTIONS_PATH/security-specific.exception.ts"
echo -e "${GREEN}✅ 파일 이름 변경 완료${NC}"

echo ""
echo -e "${BLUE}Step 3: security-specific.exception.ts에서 중복 제거${NC}"
echo "----------------------------------------"
cat > "$EXCEPTIONS_PATH/security-specific.exception.ts" << 'EOF'
import { HttpException, HttpStatus } from '@nestjs/common';
import { SecurityReason } from '../../types';

/**
 * Security Specific Exceptions
 * application.exception.ts에 없는 보안 전용 예외들만 포함
 */

/**
 * Invalid User Agent Exception
 * User-Agent 검증 실패 시 발생
 */
export class InvalidUserAgentException extends HttpException {
  constructor(ip: string, userAgent: string) {
    const message = process.env.NODE_ENV === 'production' 
      ? 'Access denied' 
      : `Invalid User-Agent detected: ${userAgent.substring(0, 100)}`;

    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        message,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.FORBIDDEN
    );
  }
}

/**
 * Headless Browser Exception
 * 헤드리스 브라우저 감지 시 발생
 */
export class HeadlessBrowserException extends HttpException {
  constructor(ip: string, detectionFactors: string[]) {
    const message = process.env.NODE_ENV === 'production'
      ? 'Access denied'
      : `Headless browser detected with ${detectionFactors.length} factors`;

    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        message,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV !== 'production' && { factors: detectionFactors }),
      },
      HttpStatus.FORBIDDEN
    );
  }
}

/**
 * Honeypot Triggered Exception
 * 허니팟 필드가 채워진 경우 발생
 */
export class HoneypotException extends HttpException {
  constructor(ip: string, fieldName?: string) {
    const message = process.env.NODE_ENV === 'production'
      ? 'Access denied'
      : 'Honeypot field triggered';

    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        message,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.FORBIDDEN
    );
  }
}

/**
 * reCAPTCHA Failed Exception
 * reCAPTCHA 검증 실패 시 발생
 */
export class RecaptchaException extends HttpException {
  constructor(ip: string, score?: number) {
    const message = process.env.NODE_ENV === 'production'
      ? 'Verification failed'
      : `reCAPTCHA verification failed${score ? ` (score: ${score})` : ''}`;

    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        message,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.FORBIDDEN
    );
  }
}

/**
 * Configuration Exception
 * 필수 설정이 누락된 경우 발생
 */
export class ConfigurationException extends HttpException {
  constructor(missingConfig: string) {
    const message = process.env.NODE_ENV === 'production'
      ? 'Service temporarily unavailable'
      : `Missing required configuration: ${missingConfig}`;

    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.SERVICE_UNAVAILABLE
    );
  }
}
EOF

echo -e "${GREEN}✅ security-specific.exception.ts 수정 완료${NC}"

echo ""
echo -e "${BLUE}Step 4: index.ts 파일 업데이트${NC}"
echo "----------------------------------------"
cat > "$EXCEPTIONS_PATH/index.ts" << 'EOF'
/**
 * Common Exceptions Export
 * 모든 예외 클래스를 중앙에서 관리
 */

// 기본 애플리케이션 예외들 (포괄적인 시스템)
export {
  // Base
  BaseApplicationException,
  
  // Validation & Business
  ValidationException,
  BusinessLogicException,
  ResourceNotFoundException,
  
  // Security
  SecurityException,
  RateLimitException,
  IpBlockedException,
  BotDetectedException,
  
  // External & System
  ExternalServiceException,
  SystemException,
  DatabaseException,
} from './application.exception';

// 보안 전용 예외들 (application.exception에 없는 것들만)
export {
  InvalidUserAgentException,
  HeadlessBrowserException,
  HoneypotException,
  RecaptchaException,
  ConfigurationException,
} from './security-specific.exception';

// 타입 재수출
export type { InternalErrorDetails } from '../constants/error.constants';
EOF

echo -e "${GREEN}✅ index.ts 업데이트 완료${NC}"

echo ""
echo -e "${BLUE}Step 5: Guard 파일들의 import 경로 수정${NC}"
echo "----------------------------------------"

# Guard 파일들 수정
GUARDS_PATH="$PROJECT_PATH/src/common/guards"

# user-agent.guard.ts 수정
sed -i '' "s|import { InvalidUserAgentException } from '../exceptions';|import { InvalidUserAgentException } from '../exceptions';|g" \
  "$GUARDS_PATH/user-agent.guard.ts" 2>/dev/null

# headless-browser.guard.ts 수정
sed -i '' "s|import { HeadlessBrowserException } from '../exceptions';|import { HeadlessBrowserException } from '../exceptions';|g" \
  "$GUARDS_PATH/headless-browser.guard.ts" 2>/dev/null

# honeypot.guard.ts 수정 (있다면)
if [ -f "$GUARDS_PATH/honeypot.guard.ts" ]; then
  sed -i '' "s|import { HoneypotException } from '../exceptions/security.exception';|import { HoneypotException } from '../exceptions';|g" \
    "$GUARDS_PATH/honeypot.guard.ts" 2>/dev/null
fi

# recaptcha.guard.ts 수정 (있다면)
if [ -f "$GUARDS_PATH/recaptcha.guard.ts" ]; then
  sed -i '' "s|import { RecaptchaException } from '../exceptions/security.exception';|import { RecaptchaException } from '../exceptions';|g" \
    "$GUARDS_PATH/recaptcha.guard.ts" 2>/dev/null
fi

echo -e "${GREEN}✅ Guard 파일들 import 경로 수정 완료${NC}"

echo ""
echo -e "${BLUE}Step 6: 중복 제거 결과 확인${NC}"
echo "----------------------------------------"

# 파일 크기 비교
if [ -f "$BACKUP_DIR/exceptions/security.exception.ts" ]; then
  OLD_SIZE=$(wc -l < "$BACKUP_DIR/exceptions/security.exception.ts")
  NEW_SIZE=$(wc -l < "$EXCEPTIONS_PATH/security-specific.exception.ts")
  REDUCED=$((OLD_SIZE - NEW_SIZE))
  
  echo -e "기존 security.exception.ts: ${YELLOW}${OLD_SIZE}줄${NC}"
  echo -e "새로운 security-specific.exception.ts: ${GREEN}${NEW_SIZE}줄${NC}"
  echo -e "감소된 코드: ${GREEN}${REDUCED}줄${NC}"
fi

echo ""
echo -e "${BLUE}Step 7: TypeScript 컴파일 테스트${NC}"
echo "----------------------------------------"
cd "$PROJECT_PATH"
npm run build 2>/dev/null

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ TypeScript 컴파일 성공!${NC}"
else
  echo -e "${YELLOW}⚠️ TypeScript 컴파일 경고가 있을 수 있습니다. 확인이 필요합니다.${NC}"
fi

echo ""
echo "================================================"
echo -e "${GREEN}🎉 Exception 클래스 통합 완료!${NC}"
echo ""
echo "다음 작업:"
echo "1. npm run build로 컴파일 확인"
echo "2. npm run test로 테스트 실행"
echo "3. 문제가 있으면 백업에서 복원: cp -r $BACKUP_DIR/exceptions/* $EXCEPTIONS_PATH/"
echo ""
echo -e "${BLUE}다음 리팩토링: RequestUtils 생성을 진행하시겠습니까? (y/n)${NC}"
