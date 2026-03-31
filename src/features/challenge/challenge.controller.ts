import { Controller, Post, Body, Req, Res, ForbiddenException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';

import { SkipBehavioral } from '../../common/guards/behavioral.guard';
import { SkipChallenge } from '../../common/guards/challenge.guard';
import { SkipHeadlessBrowser } from '../../common/guards/headless-browser.guard';
import { SkipUserAgent } from '../../common/guards/user-agent.guard';
import { ChallengeService, COOKIE_TTL } from '../../common/services/challenge.service';
import { PuzzleCaptchaService } from '../../common/services/puzzle-captcha.service';
import { RequestUtils } from '../../common/utils/request.utils';
import { ExtendedRequest } from '../../core/types';

import { VerifyChallengeDto } from './dto/verify-challenge.dto';

/**
 * Challenge Controller
 * 브라우저 챌린지 검증 엔드포인트
 */
@ApiTags('Challenge')
@Controller('challenge')
@SkipChallenge()
@SkipUserAgent()
@SkipHeadlessBrowser()
@SkipBehavioral()
export class ChallengeController {
  private readonly logger = new Logger(ChallengeController.name);

  constructor(
    private readonly challengeService: ChallengeService,
    private readonly puzzleCaptchaService: PuzzleCaptchaService,
  ) {}

  @Post('verify')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Verify browser challenge' })
  async verify(@Body() dto: VerifyChallengeDto, @Req() req: Request, @Res() res: Response) {
    const ip = RequestUtils.extractClientIp(req as ExtendedRequest);

    const valid = await this.challengeService.verifyChallenge(dto.token, dto.nonce, ip);
    if (!valid) {
      this.logger.warn(`Challenge verification failed for IP: ${RequestUtils.hashIp(ip, 'log')}`);
      throw new ForbiddenException('Challenge failed');
    }

    // Puzzle CAPTCHA verification — THRESHOLD=0이므로 항상 필수
    // puzzleId/puzzleAnswer 생략 시 CAPTCHA bypass 방지
    const needsPuzzle = await this.puzzleCaptchaService.shouldShowPuzzle(ip);
    if (needsPuzzle) {
      if (!dto.puzzleId || !dto.puzzleAnswer) {
        this.logger.warn(`CAPTCHA fields missing from IP: ${RequestUtils.hashIp(ip, 'log')}`);
        throw new ForbiddenException('CAPTCHA verification required');
      }
      const puzzleValid = await this.puzzleCaptchaService.verifyPuzzle(
        dto.puzzleId,
        dto.puzzleAnswer,
        ip,
      );
      if (!puzzleValid) {
        this.logger.warn(
          `Puzzle CAPTCHA verification failed for IP: ${RequestUtils.hashIp(ip, 'log')}`,
        );
        throw new ForbiddenException('Puzzle CAPTCHA failed');
      }
    }

    // PoW 풀이 속도 체크 — 토큰 발급~검증 시간이 100ms 미만이면 봇 의심 → threat score 반영
    try {
      const decoded = Buffer.from(dto.token, 'base64').toString();
      const tokenTimestamp = parseInt(decoded.split('|')[0], 10);
      const solveTime = Date.now() - tokenTimestamp;
      if (solveTime < 100) {
        this.logger.warn(
          `Suspiciously fast PoW solve: ${solveTime}ms from IP: ${RequestUtils.hashIp(ip, 'log')}`,
        );
        // 위협 점수에 반영 (GPU 봇 탐지)
        await this.challengeService.recordFastSolve(ip);
      }
    } catch {
      // token decode failure — non-critical
    }

    // 핑거프린트 저장 (추적용)
    await this.challengeService.storeFingerprint(dto.fingerprint, ip);

    // 서명된 쿠키 설정 + 리다이렉트 (fetch 대신 form submit으로 쿠키 확실히 설정)
    const cookieValue = this.challengeService.generateCookie(ip, dto.fingerprint);
    res.cookie('__challenge', cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_TTL * 1000,
      path: '/',
    });

    // returnUrl에서 원래 URL 추출 (open redirect 방지: 상대 경로만 허용, javascript: 등 차단)
    let redirectPath = '/';
    if (dto.returnUrl) {
      try {
        const url = new URL(dto.returnUrl, 'http://localhost');
        // 상대 경로만 허용 (javascript:, data: 등 차단)
        if (url.pathname.startsWith('/')) {
          redirectPath = url.pathname + url.search;
        }
      } catch {
        redirectPath = '/';
      }
    }

    // Set-Cookie가 확실히 적용되도록 HTML 페이지로 응답 (303 redirect는 일부 브라우저에서 Set-Cookie 무시)
    this.logger.log(`Challenge verified, setting cookie and redirecting to ${redirectPath}`);
    const safeRedirect = JSON.stringify(redirectPath).replace(/</g, '\\u003c');
    // noscript href도 encodeURIComponent로 속성 인젝션 방지
    const safeHref = encodeURIComponent(redirectPath);
    res.setHeader('Content-Type', 'text/html');
    return res.send(
      `<!DOCTYPE html><html><head></head><body><script>window.location.href=${safeRedirect}</script><noscript><a href="${safeHref}">Click here to continue</a></noscript></body></html>`,
    );
  }
}
