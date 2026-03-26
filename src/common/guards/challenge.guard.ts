import {
  Injectable,
  ExecutionContext,
  SetMetadata,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'crypto';
import { BaseSecurityGuard } from './base-security.guard';
import { ChallengeService } from '../services/challenge.service';
import { ExtendedRequest } from '../../core/types';

/**
 * Challenge 체크를 건너뛰는 데코레이터
 */
export const SKIP_CHALLENGE_KEY = 'skipChallenge';
export const SkipChallenge = () => SetMetadata(SKIP_CHALLENGE_KEY, true);

/**
 * Challenge Guard
 * JS Challenge + Browser Fingerprint 기반 봇 차단 가드
 *
 * 동작:
 * - SkipChallenge 데코레이터가 있으면 건너뜀
 * - x-api-key 헤더가 있으면 건너뜀
 * - __challenge 쿠키가 유효하면 통과
 * - 그 외: CHALLENGE_REQUIRED 예외를 던져 HTML 챌린지 페이지 응답
 */
@Injectable()
export class ChallengeGuard extends BaseSecurityGuard {
  constructor(
    private readonly challengeService: ChallengeService,
    private readonly reflector: Reflector,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // @SkipChallenge() 데코레이터가 있으면 건너뜀
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CHALLENGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest<ExtendedRequest>();

    // API key bypass (검증된 키만 허용, timing-safe)
    const validApiKey = process.env.API_KEY;
    const requestApiKey = request.headers['x-api-key'];
    if (validApiKey && typeof requestApiKey === 'string' && requestApiKey.length === validApiKey.length
        && timingSafeEqual(Buffer.from(requestApiKey), Buffer.from(validApiKey))) {
      return true;
    }

    const ip = this.getClientIp(request);

    // __challenge 쿠키 검증
    const cookieHeader = request.headers.cookie;
    const cookieStr = Array.isArray(cookieHeader)
      ? cookieHeader[0]
      : cookieHeader;

    if (cookieStr) {
      const challengeCookie = cookieStr
        .split(';')
        .map((c: string) => c.trim())
        .find((c: string) => c.startsWith('__challenge='));

      if (challengeCookie) {
        const rawValue = challengeCookie.split('=').slice(1).join('=');
        const cookieValue = decodeURIComponent(rawValue);
        if (this.challengeService.verifyCookie(cookieValue, ip)) {
          return true;
        }
      }
    }

    // 유효한 쿠키 없음 — 챌린지 발급
    try {
      const challengeToken = await this.challengeService.generateToken(ip);
      const difficulty = await this.challengeService.getDifficulty(ip);

      this.logSecurityViolation(request, 'Challenge required - no valid cookie');

      // CHALLENGE_REQUIRED 타입의 HttpException을 던짐
      // UnifiedExceptionFilter가 이를 감지하여 HTML 응답을 전송
      throw new HttpException(
        {
          type: 'CHALLENGE_REQUIRED',
          html: this.challengeService.getChallengeHtml(
            challengeToken,
            difficulty,
          ),
        },
        HttpStatus.FORBIDDEN,
      );
    } catch (error) {
      // HttpException은 그대로 전달
      if (error instanceof HttpException) {
        throw error;
      }

      // 예상치 못한 에러 — fail-open
      this.logger.error('Unexpected error in challenge guard:', error);
      return true;
    }
  }
}
