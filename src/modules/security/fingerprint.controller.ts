import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Headers,
  Ip,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FingerprintService, BrowserData, BotDetectionResult } from '../../common/services/fingerprint/fingerprint.service';
import { IpBlacklistService } from '../../common/services/ip-blacklist.service';

/**
 * Fingerprint Controller
 * 브라우저 핑거프린트 검증 및 봇 탐지
 */
@Controller('api/fingerprint')
export class FingerprintController {
  private readonly logger = new Logger(FingerprintController.name);

  constructor(
    private readonly fingerprintService: FingerprintService,
    private readonly ipBlacklistService: IpBlacklistService,
  ) {}

  /**
   * 핑거프린트 검증
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validateFingerprint(
    @Body() fingerprintData: BrowserData,
    @Headers('x-fingerprint-id') fingerprintId: string,
    @Ip() ip: string,
  ): Promise<FingerprintValidationResponse> {
    this.logger.log(`Validating fingerprint from IP: ${ip}, ID: ${fingerprintId}`);

    try {
      // 핑거프린트 생성 및 검증
      const fingerprint = await this.fingerprintService.generateFingerprint(fingerprintData);

      // 봇 탐지
      const botDetection = this.fingerprintService.calculateBotScore(fingerprint);

      // 높은 봇 점수인 경우 IP 차단 고려
      if (botDetection.score >= 80) {
        await this.handleSuspiciousFingerprint(ip, fingerprintId, botDetection);
      }

      // 결과 반환
      return {
        success: !botDetection.isBot,
        fingerprintId: fingerprint.id,
        trustScore: fingerprint.trustScore,
        botDetection: {
          isBot: botDetection.isBot,
          score: botDetection.score,
          confidence: botDetection.confidence,
          factors: botDetection.factors,
        },
        recommendation: botDetection.recommendation,
        challenge: this.shouldIssueChallenge(botDetection) ?
          this.generateChallenge() : undefined,
      };
    } catch (error) {
      this.logger.error(`Fingerprint validation error: ${error.message}`, error.stack);

      return {
        success: false,
        error: 'Validation failed',
        recommendation: 'MONITOR',
      };
    }
  }

  /**
   * 핑거프린트 상태 조회
   */
  @Get('status/:fingerprintId')
  async getFingerprintStatus(
    @Param('fingerprintId') fingerprintId: string,
  ): Promise<FingerprintStatusResponse> {
    // 실제로는 DB에서 조회
    return {
      fingerprintId,
      firstSeen: new Date(),
      lastSeen: new Date(),
      trustScore: 75,
      requestCount: 42,
      blocked: false,
      suspicious: false,
    };
  }

  /**
   * 핑거프린트 통계
   */
  @Get('stats')
  async getFingerprintStats(): Promise<FingerprintStatsResponse> {
    return {
      totalFingerprints: 1234,
      uniqueFingerprints: 987,
      botsDetected: 156,
      challengesIssued: 89,
      blockedFingerprints: 34,
      averageTrustScore: 72.5,
      topBotIndicators: [
        { indicator: 'Canvas too simple', count: 45 },
        { indicator: 'WebGL not available', count: 38 },
        { indicator: 'Too few fonts', count: 29 },
        { indicator: 'Headless browser detected', count: 27 },
        { indicator: 'WebDriver detected', count: 21 },
      ],
    };
  }

  // ===== Private Helper Methods =====

  /**
   * 의심스러운 핑거프린트 처리
   */
  private async handleSuspiciousFingerprint(
    ip: string,
    fingerprintId: string,
    botDetection: BotDetectionResult,
  ): Promise<void> {
    this.logger.warn(
      `Suspicious fingerprint detected - IP: ${ip}, ID: ${fingerprintId}, Score: ${botDetection.score}`,
    );

    // IP 블랙리스트에 추가 고려
    if (botDetection.score >= 90) {
      await this.ipBlacklistService.blockIp(
        ip,
        `Bot detected with fingerprint: ${fingerprintId}, Score: ${botDetection.score}`,
        3600, // 1시간 차단
      );
    }

    // 이벤트 로깅 (실제로는 이벤트 서비스 사용)
    this.logSecurityEvent({
      type: 'SUSPICIOUS_FINGERPRINT',
      ip,
      fingerprintId,
      botScore: botDetection.score,
      factors: botDetection.factors,
      timestamp: new Date(),
    });
  }

  /**
   * Challenge 발급 여부 결정
   */
  private shouldIssueChallenge(botDetection: BotDetectionResult): boolean {
    return botDetection.score >= 40 && botDetection.score < 80;
  }

  /**
   * Challenge 생성
   */
  private generateChallenge(): Challenge {
    const challengeId = Math.random().toString(36).substring(2, 15);
    const puzzle = {
      type: 'math',
      question: this.generateMathPuzzle(),
      id: challengeId,
      expiresAt: new Date(Date.now() + 60000), // 1분 후 만료
    };

    // 실제로는 캐시나 DB에 저장
    return puzzle;
  }

  /**
   * 수학 퍼즐 생성
   */
  private generateMathPuzzle(): string {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    const operations = ['+', '-', '*'];
    const op = operations[Math.floor(Math.random() * operations.length)];

    return `What is ${a} ${op} ${b}?`;
  }

  /**
   * 보안 이벤트 로깅
   */
  private logSecurityEvent(event: any): void {
    // 실제로는 이벤트 서비스나 로깅 시스템으로 전송
    this.logger.warn(`Security Event: ${JSON.stringify(event)}`);
  }
}

// ===== Type Definitions =====

interface FingerprintValidationResponse {
  success: boolean;
  fingerprintId?: string;
  trustScore?: number;
  botDetection?: {
    isBot: boolean;
    score: number;
    confidence: number;
    factors: string[];
  };
  recommendation: string;
  challenge?: Challenge;
  error?: string;
}

interface FingerprintStatusResponse {
  fingerprintId: string;
  firstSeen: Date;
  lastSeen: Date;
  trustScore: number;
  requestCount: number;
  blocked: boolean;
  suspicious: boolean;
}

interface FingerprintStatsResponse {
  totalFingerprints: number;
  uniqueFingerprints: number;
  botsDetected: number;
  challengesIssued: number;
  blockedFingerprints: number;
  averageTrustScore: number;
  topBotIndicators: Array<{
    indicator: string;
    count: number;
  }>;
}

interface Challenge {
  type: string;
  question: string;
  id: string;
  expiresAt: Date;
}
