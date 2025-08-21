import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { FingerprintService } from '../../common/services/fingerprint/fingerprint.service';
import { IpBlacklistService } from '../../common/services/ip-blacklist.service';
import { 
  BrowserData, 
  FingerprintValidationResponse, 
  Challenge, 
  SecurityReason,
  BrowserFingerprint
} from '../../types';

/**
 * Bot Detection Result Interface
 */
export interface BotDetectionResult {
  isBot: boolean;
  score: number;
  confidence: number;
  factors: string[];
  recommendation: string;
}

/**
 * Fingerprint Validation Request Interface
 */
export interface FingerprintValidationRequest {
  fingerprintData: BrowserData;
  fingerprintId?: string;
  ip: string;
  userAgent?: string;
}

/**
 * Security Business Service
 * 보안 관련 비즈니스 로직을 처리하는 서비스
 */
@Injectable()
export class SecurityBusinessService {
  private readonly logger = new Logger(SecurityBusinessService.name);

  constructor(
    private readonly fingerprintService: FingerprintService,
    private readonly ipBlacklistService: IpBlacklistService,
  ) {}

  /**
   * 핑거프린트 검증 및 봇 탐지
   */
  async validateFingerprint(request: FingerprintValidationRequest): Promise<FingerprintValidationResponse> {
    this.logger.log(`Validating fingerprint from IP: ${request.ip}`);

    try {
      // 1. 핑거프린트 생성
      const fingerprint = await this.generateSecureFingerprint(request.fingerprintData);

      // 2. 봇 탐지 실행
      const botDetection = await this.performBotDetection(fingerprint, request);

      // 3. 보안 위험 평가
      const securityAssessment = await this.assessSecurityRisk(request.ip, botDetection);

      // 4. 필요시 보안 조치 실행
      await this.executeSecurityMeasures(request.ip, botDetection, securityAssessment);

      // 5. 응답 생성
      const response = this.buildValidationResponse(fingerprint, botDetection, securityAssessment);

      this.logger.log(`Fingerprint validation completed for ${request.ip}: score=${botDetection.score}`);
      return response;

    } catch (error) {
      this.logger.error('Fingerprint validation failed', error);
      return this.buildErrorResponse();
    }
  }

  /**
   * 의심스러운 활동 모니터링
   */
  async monitorSuspiciousActivity(ip: string, activityType: string, metadata?: any): Promise<void> {
    this.logger.log(`Monitoring suspicious activity: ${activityType} from ${ip}`);

    try {
      // 비즈니스 로직: 활동 패턴 분석
      const suspicionLevel = await this.analyzeSuspicionLevel(ip, activityType, metadata);

      // 임계값 초과시 조치
      if (suspicionLevel > 70) {
        await this.handleHighSuspicion(ip, activityType, suspicionLevel);
      } else if (suspicionLevel > 40) {
        await this.handleModerateSuspicion(ip, activityType, suspicionLevel);
      }

      this.logger.log(`Suspicious activity monitored: ${ip} - level ${suspicionLevel}`);
    } catch (error) {
      this.logger.error('Failed to monitor suspicious activity', error);
    }
  }

  /**
   * 보안 위협 분석
   */
  async analyzeThreat(ip: string, indicators: string[]): Promise<{
    riskScore: number;
    threats: string[];
    recommendations: string[];
  }> {
    this.logger.log(`Analyzing threat for IP: ${ip}`);

    try {
      // 비즈니스 로직: 위협 지표 분석
      const riskScore = this.calculateRiskScore(indicators);
      const threats = this.identifyThreats(indicators);
      const recommendations = this.generateRecommendations(riskScore, threats);

      this.logger.log(`Threat analysis completed: ${ip} - risk score ${riskScore}`);
      
      return {
        riskScore,
        threats,
        recommendations
      };
    } catch (error) {
      this.logger.error('Failed to analyze threat', error);
      throw new BadRequestException('Failed to analyze threat');
    }
  }

  // ============================================
  // Private Business Logic Methods
  // ============================================

  /**
   * 보안 핑거프린트 생성
   */
  private async generateSecureFingerprint(data: BrowserData): Promise<BrowserFingerprint> {
    // 데이터 유효성 검사
    this.validateFingerprintData(data);

    // 핑거프린트 생성
    return await this.fingerprintService.generateFingerprint(data);
  }

  /**
   * 봇 탐지 수행
   */
  private async performBotDetection(
    fingerprint: BrowserFingerprint, 
    request: FingerprintValidationRequest
  ): Promise<BotDetectionResult> {
    // 기본 봇 점수 계산
    const baseDetection = this.fingerprintService.calculateBotScore(fingerprint);

    // 추가 컨텍스트 분석
    const contextualFactors = this.analyzeContextualFactors(request);
    
    // 종합 봇 점수 계산
    const finalScore = this.calculateFinalBotScore(baseDetection.score, contextualFactors);

    return {
      isBot: finalScore >= 70,
      score: finalScore,
      confidence: baseDetection.confidence,
      factors: [...baseDetection.factors, ...contextualFactors.factors],
      recommendation: this.getRecommendation(finalScore)
    };
  }

  /**
   * 보안 위험 평가
   */
  private async assessSecurityRisk(ip: string, botDetection: BotDetectionResult): Promise<{
    level: 'low' | 'medium' | 'high' | 'critical';
    shouldBlock: boolean;
    shouldChallenge: boolean;
  }> {
    const riskFactors = [];
    let riskScore = botDetection.score;

    // IP 기반 위험 평가
    const isBlacklisted = await this.ipBlacklistService.isBlocked(ip);
    if (isBlacklisted) {
      riskScore += 30;
      riskFactors.push('IP previously blacklisted');
    }

    // 위험 레벨 결정
    let level: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore >= 90) level = 'critical';
    else if (riskScore >= 70) level = 'high';
    else if (riskScore >= 40) level = 'medium';
    else level = 'low';

    return {
      level,
      shouldBlock: riskScore >= 80,
      shouldChallenge: riskScore >= 60 && riskScore < 80
    };
  }

  /**
   * 보안 조치 실행
   */
  private async executeSecurityMeasures(
    ip: string, 
    botDetection: BotDetectionResult,
    assessment: any
  ): Promise<void> {
    // 높은 봇 점수인 경우 IP 차단
    if (assessment.shouldBlock) {
      await this.blockSuspiciousIp(ip, botDetection);
    }

    // 로깅 및 모니터링
    this.logSecurityEvent(ip, botDetection, assessment);
  }

  /**
   * 의심스러운 IP 차단
   */
  private async blockSuspiciousIp(ip: string, botDetection: BotDetectionResult): Promise<void> {
    const reason: SecurityReason = 'BOT_DETECTED';
    const blockDuration = this.calculateBlockDuration(botDetection.score);

    await this.ipBlacklistService.blacklistIp(ip, reason, blockDuration);
    
    this.logger.warn(`IP ${ip} blocked due to bot detection (score: ${botDetection.score})`);
  }

  /**
   * 응답 생성
   */
  private buildValidationResponse(
    fingerprint: BrowserFingerprint,
    botDetection: BotDetectionResult,
    assessment: any
  ): FingerprintValidationResponse {
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
      challenge: assessment.shouldChallenge ? this.generateChallenge() : null,
    };
  }

  /**
   * 에러 응답 생성
   */
  private buildErrorResponse(): FingerprintValidationResponse {
    return {
      success: false,
      fingerprintId: 'error',
      trustScore: 0,
      botDetection: {
        isBot: true,
        score: 100,
        confidence: 0,
        factors: ['validation_error'],
      },
      recommendation: 'BLOCK',
      challenge: null,
    };
  }

  /**
   * 컨텍스트 요소 분석
   */
  private analyzeContextualFactors(request: FingerprintValidationRequest): {
    score: number;
    factors: string[];
  } {
    const factors = [];
    let score = 0;

    // User-Agent 분석
    if (!request.userAgent || request.userAgent.length < 10) {
      factors.push('suspicious_user_agent');
      score += 20;
    }

    // 기타 컨텍스트 분석...
    
    return { score, factors };
  }

  /**
   * 최종 봇 점수 계산
   */
  private calculateFinalBotScore(baseScore: number, contextualFactors: any): number {
    return Math.min(100, baseScore + contextualFactors.score);
  }

  /**
   * 추천 행동 결정
   */
  private getRecommendation(score: number): string {
    if (score >= 80) return 'BLOCK';
    if (score >= 60) return 'CHALLENGE';
    if (score >= 40) return 'MONITOR';
    return 'ALLOW';
  }

  /**
   * 차단 기간 계산
   */
  private calculateBlockDuration(score: number): number {
    if (score >= 90) return 24 * 3600; // 24시간
    if (score >= 80) return 6 * 3600;  // 6시간
    return 3600; // 1시간
  }

  /**
   * 챌린지 생성
   */
  private generateChallenge(): Challenge {
    return {
      type: 'captcha',
      difficulty: 1,
      data: {
        provider: 'recaptcha',
        siteKey: 'challenge-site-key'
      }
    };
  }

  /**
   * 핑거프린트 데이터 유효성 검사
   */
  private validateFingerprintData(data: BrowserData): void {
    if (!data || typeof data !== 'object') {
      throw new BadRequestException('Invalid fingerprint data');
    }
  }

  /**
   * 의심 수준 분석
   */
  private async analyzeSuspicionLevel(ip: string, activityType: string, metadata?: any): Promise<number> {
    let suspicion = 0;

    // 활동 유형별 기본 점수
    switch (activityType) {
      case 'rapid_requests':
        suspicion += 30;
        break;
      case 'pattern_match':
        suspicion += 50;
        break;
      case 'automation_detected':
        suspicion += 70;
        break;
    }

    // 메타데이터 기반 추가 분석
    if (metadata) {
      suspicion += this.analyzeMetadata(metadata);
    }

    return Math.min(100, suspicion);
  }

  /**
   * 높은 의심 수준 처리
   */
  private async handleHighSuspicion(ip: string, activityType: string, level: number): Promise<void> {
    this.logger.warn(`High suspicion detected: ${ip} - ${activityType} (${level})`);
    
    // 임시 차단 또는 추가 모니터링
    await this.ipBlacklistService.blacklistIp(
      ip, 
      'SUSPICIOUS_BEHAVIOR' as SecurityReason, 
      1800 // 30분
    );
  }

  /**
   * 중간 의심 수준 처리
   */
  private async handleModerateSuspicion(ip: string, activityType: string, level: number): Promise<void> {
    this.logger.log(`Moderate suspicion detected: ${ip} - ${activityType} (${level})`);
    // 모니터링 강화
  }

  /**
   * 위험 점수 계산
   */
  private calculateRiskScore(indicators: string[]): number {
    let score = 0;
    
    for (const indicator of indicators) {
      switch (indicator) {
        case 'bot_user_agent':
          score += 40;
          break;
        case 'headless_browser':
          score += 50;
          break;
        case 'automation_tools':
          score += 60;
          break;
        case 'proxy_detected':
          score += 30;
          break;
      }
    }

    return Math.min(100, score);
  }

  /**
   * 위협 식별
   */
  private identifyThreats(indicators: string[]): string[] {
    const threats = [];
    
    if (indicators.includes('bot_user_agent')) {
      threats.push('Automated tool detected');
    }
    if (indicators.includes('headless_browser')) {
      threats.push('Headless browser detected');
    }
    
    return threats;
  }

  /**
   * 권장사항 생성
   */
  private generateRecommendations(riskScore: number, threats: string[]): string[] {
    const recommendations = [];
    
    if (riskScore > 70) {
      recommendations.push('Consider blocking this IP');
      recommendations.push('Implement additional verification');
    }
    
    return recommendations;
  }

  /**
   * 메타데이터 분석
   */
  private analyzeMetadata(metadata: any): number {
    let score = 0;
    
    if (metadata.requestCount > 100) {
      score += 20;
    }
    
    return score;
  }

  /**
   * 보안 이벤트 로깅
   */
  private logSecurityEvent(ip: string, botDetection: BotDetectionResult, assessment: any): void {
    this.logger.log('Security event', {
      ip,
      botScore: botDetection.score,
      riskLevel: assessment.level,
      factors: botDetection.factors
    });
  }
}
