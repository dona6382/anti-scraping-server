import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { SkipChallenge } from '../../common/guards/challenge.guard';
import { SkipUserAgent } from '../../common/guards/user-agent.guard';
import { SkipHeadlessBrowser } from '../../common/guards/headless-browser.guard';
import { ChallengeService, COOKIE_TTL } from '../../common/services/challenge.service';
import { ExtendedRequest } from '../../core/types';
import { RequestUtils } from '../../common/utils/request.utils';
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
export class ChallengeController {
  private readonly logger = new Logger(ChallengeController.name);

  constructor(private readonly challengeService: ChallengeService) {}

  @Post('verify')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Verify browser challenge' })
  async verify(
    @Body() dto: VerifyChallengeDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ip = RequestUtils.extractClientIp(req as ExtendedRequest);

    const valid = await this.challengeService.verifyChallenge(
      dto.token,
      dto.nonce,
      ip,
    );
    if (!valid) {
      this.logger.warn(`Challenge verification failed for IP: ${RequestUtils.hashIp(ip, 'log')}`);
      throw new ForbiddenException('Challenge failed');
    }

    // 핑거프린트 저장 (추적용)
    await this.challengeService.storeFingerprint(dto.fingerprint, ip);

    // 서명된 쿠키 설정 + 리다이렉트 (fetch 대신 form submit으로 쿠키 확실히 설정)
    const cookieValue = this.challengeService.generateCookie(
      ip,
      dto.fingerprint,
    );
    res.cookie('__challenge', cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_TTL * 1000,
      path: '/',
    });

    // returnUrl에서 원래 URL 추출 (open redirect 방지: 같은 origin의 path만 허용)
    let redirectPath = '/';
    if (dto.returnUrl) {
      try {
        const url = new URL(dto.returnUrl);
        redirectPath = url.pathname + url.search;
      } catch {
        redirectPath = '/';
      }
    }

    // Set-Cookie가 확실히 적용되도록 HTML 페이지로 응답 (303 redirect는 일부 브라우저에서 Set-Cookie 무시)
    this.logger.log(`Challenge verified, setting cookie and redirecting to ${redirectPath}`);
    const safeRedirect = JSON.stringify(redirectPath).replace(/</g, '\\u003c');
    res.setHeader('Content-Type', 'text/html');
    return res.send(`<!DOCTYPE html><html><head></head><body><script>window.location.href=${safeRedirect}</script><noscript><a href="${encodeURI(redirectPath)}">Click here to continue</a></noscript></body></html>`);
  }
}
