import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { ErrorCategory, ErrorSeverity } from '../constants/error.constants';

/**
 * Error Logging Service
 * 에러를 안전하게 로깅하고 모니터링
 */
@Injectable()
export class ErrorLoggingService {
  private readonly logger = new Logger(ErrorLoggingService.name);
  private readonly logDir: string;
  private readonly isProduction: boolean;
  private readonly errorMetrics = new Map<string, number>();
  
  // 민감한 패턴들
  private readonly sensitivePatterns = [
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // 신용카드
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // 이메일
    /Bearer\s+[A-Za-z0-9\-._~\+\/]+=*/g, // Bearer 토큰
    /api[_-]?key["\s]*[:=]["\s]*["']?[A-Za-z0-9\-._~\+\/]+/gi, // API 키
    /password["\s]*[:=]["\s]*["']?[^"',}\s]+/gi, // 비밀번호
  ];

  constructor(private readonly configService: ConfigService) {
    this.logDir = this.configService.get('LOG_DIR', './logs');
    this.isProduction = this.configService.get('NODE_ENV') === 'production';
    
    // 로그 디렉토리 생성
    this.ensureLogDirectory();
    
    // 메트릭 수집 시작
    this.startMetricsCollection();
  }

  /**
   * 에러 로깅
   */
  async logError(
    error: Error,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context?: Record<string, any>
  ): Promise<void> {
    const sanitizedContext = this.sanitizeContext(context);
    const errorId = this.generateErrorId();
    
    const logEntry = {
      id: errorId,
      timestamp: new Date().toISOString(),
      category,
      severity,
      message: this.sanitizeMessage(error.message),
      stack: this.isProduction ? undefined : this.sanitizeStack(error.stack),
      context: sanitizedContext,
    };

    // 파일에 로깅
    await this.writeToFile(logEntry);
    
    // 메트릭 업데이트
    this.updateMetrics(category, severity);
    
    // 심각한 에러는 알림
    if (severity === ErrorSeverity.CRITICAL) {
      await this.sendAlert(errorId, logEntry);
    }
  }

  /**
   * 보안 이벤트 로깅
   */
  async logSecurityEvent(
    event: string,
    details: Record<string, any>,
    threatLevel: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<void> {
    const sanitizedDetails = this.sanitizeContext(details);
    
    const securityLog = {
      timestamp: new Date().toISOString(),
      event,
      threatLevel,
      details: sanitizedDetails,
      // IP는 해시화
      clientIp: details.ip ? this.hashValue(details.ip) : undefined,
      // User-Agent는 단순화
      userAgent: details.userAgent ? this.simplifyUserAgent(details.userAgent) : undefined,
    };

    // 보안 로그 파일에 기록
    await this.writeSecurityLog(securityLog);
    
    // 높은 위협 수준은 즉시 알림
    if (threatLevel === 'critical' || threatLevel === 'high') {
      await this.sendSecurityAlert(securityLog);
    }
  }

  /**
   * 컨텍스트 정제
   */
  private sanitizeContext(context?: Record<string, any>): Record<string, any> | undefined {
    if (!context) return undefined;
    
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(context)) {
      // 민감한 키 확인
      if (this.isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeContext(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * 문자열 정제
   */
  private sanitizeString(value: string): string {
    let sanitized = value;
    
    // 민감한 패턴 제거
    for (const pattern of this.sensitivePatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    
    return sanitized;
  }

  /**
   * 메시지 정제
   */
  private sanitizeMessage(message: string): string {
    // 파일 경로 제거
    let sanitized = message.replace(/([A-Z]:)?[/\\][\w/\\.-]+/g, '[PATH]');
    
    // 스택 트레이스 제거
    sanitized = sanitized.replace(/\s+at\s+.+\(.+:\d+:\d+\)/g, '');
    
    // SQL 쿼리 제거
    sanitized = sanitized.replace(/SELECT\s+.+\s+FROM\s+.+/gi, '[SQL_QUERY]');
    
    return this.sanitizeString(sanitized);
  }

  /**
   * 스택 트레이스 정제
   */
  private sanitizeStack(stack?: string): string | undefined {
    if (!stack) return undefined;
    
    return stack
      .split('\n')
      .map(line => {
        // 절대 경로를 상대 경로로
        line = line.replace(/([A-Z]:)?[/\\][\w/\\.-]+\/node_modules/g, 'node_modules');
        line = line.replace(/([A-Z]:)?[/\\][\w/\\.-]+\/src/g, 'src');
        return line;
      })
      .slice(0, 10) // 상위 10개 라인만
      .join('\n');
  }

  /**
   * 민감한 키 확인
   */
  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'password', 'pwd', 'pass',
      'token', 'secret', 'key',
      'creditcard', 'card', 'ccv',
      'ssn', 'social',
      'email', 'phone',
      'apikey', 'api_key',
      'authorization', 'auth',
    ];
    
    const lowerKey = key.toLowerCase();
    return sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
  }

  /**
   * 값 해시화
   */
  private hashValue(value: string): string {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(value + (process.env.HASH_SALT || 'default'))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * User-Agent 단순화
   */
  private simplifyUserAgent(userAgent: string): string {
    // 브라우저 이름과 주요 버전만 추출
    const match = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/(\d+)/);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
    
    // 봇 확인
    if (/bot|crawl|spider/i.test(userAgent)) {
      return 'Bot/Unknown';
    }
    
    return 'Unknown';
  }

  /**
   * 에러 ID 생성
   */
  private generateErrorId(): string {
    return `ERR-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  }

  /**
   * 로그 디렉토리 확인/생성
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * 파일에 로그 작성
   */
  private async writeToFile(logEntry: any): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const filename = path.join(this.logDir, `errors-${date}.json`);
    
    try {
      const line = JSON.stringify(logEntry) + '\n';
      await fs.promises.appendFile(filename, line, 'utf8');
    } catch (error) {
      this.logger.error('Failed to write log to file', error);
    }
  }

  /**
   * 보안 로그 작성
   */
  private async writeSecurityLog(logEntry: any): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const filename = path.join(this.logDir, `security-${date}.json`);
    
    try {
      const line = JSON.stringify(logEntry) + '\n';
      await fs.promises.appendFile(filename, line, 'utf8');
    } catch (error) {
      this.logger.error('Failed to write security log', error);
    }
  }

  /**
   * 메트릭 업데이트
   */
  private updateMetrics(category: ErrorCategory, severity: ErrorSeverity): void {
    const key = `${category}:${severity}`;
    const current = this.errorMetrics.get(key) || 0;
    this.errorMetrics.set(key, current + 1);
  }

  /**
   * 메트릭 수집 시작
   */
  private startMetricsCollection(): void {
    // 5분마다 메트릭 리셋
    setInterval(() => {
      if (this.errorMetrics.size > 0) {
        this.logger.log('Error metrics', Object.fromEntries(this.errorMetrics));
        this.errorMetrics.clear();
      }
    }, 5 * 60 * 1000);
  }

  /**
   * 알림 전송
   */
  private async sendAlert(errorId: string, logEntry: any): Promise<void> {
    // TODO: Slack, Email, SMS 등 알림 구현
    this.logger.error(`🚨 CRITICAL ERROR [${errorId}]`, {
      category: logEntry.category,
      message: logEntry.message,
    });
  }

  /**
   * 보안 알림 전송
   */
  private async sendSecurityAlert(securityLog: any): Promise<void> {
    // TODO: 보안팀 알림 구현
    this.logger.warn(`🔒 SECURITY ALERT`, {
      event: securityLog.event,
      threatLevel: securityLog.threatLevel,
    });
  }

  /**
   * 메트릭 조회
   */
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.errorMetrics);
  }

  /**
   * 에러 통계 조회
   */
  async getErrorStatistics(hours: number = 24): Promise<any> {
    // TODO: 시간별 에러 통계 구현
    return {
      totalErrors: Array.from(this.errorMetrics.values()).reduce((a, b) => a + b, 0),
      byCategory: Object.fromEntries(this.errorMetrics),
      timeRange: `Last ${hours} hours`,
    };
  }
}
