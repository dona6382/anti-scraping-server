import { Injectable, ExecutionContext, SetMetadata, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ExtendedRequest } from '../../core/types';
import { SecurityEventService } from '../services/security-event.service';
import { ThreatScoreService } from '../services/threat-score.service';

import { BaseSecurityGuard } from './base-security.guard';

const SKIP_TLS_KEY = 'skipTlsFingerprint';
export const SkipTlsFingerprint = () => SetMetadata(SKIP_TLS_KEY, true);

/**
 * 알려진 브라우저의 TLS 핑거프린트 (TLS version + cipher)
 * Nginx가 X-TLS-Fingerprint 헤더로 전달
 */
const KNOWN_BROWSER_FINGERPRINTS = new Set([
  // Chrome / Edge (TLS 1.3)
  'TLSv1.3:TLS_AES_256_GCM_SHA384',
  'TLSv1.3:TLS_AES_128_GCM_SHA256',
  'TLSv1.3:TLS_CHACHA20_POLY1305_SHA256',
  'TLSv1.3:AEAD-AES256-GCM-SHA384',
  'TLSv1.3:AEAD-AES128-GCM-SHA256',
  // Firefox (TLS 1.3)
  'TLSv1.3:TLS_AES_128_GCM_SHA256',
  // Safari (TLS 1.2/1.3)
  'TLSv1.2:ECDHE-RSA-AES256-GCM-SHA384',
  'TLSv1.2:ECDHE-RSA-AES128-GCM-SHA256',
]);

/**
 * 봇/스크래퍼가 주로 사용하는 TLS 핑거프린트
 */
const SUSPICIOUS_FINGERPRINTS = [
  // Node.js (axios, fetch) 기본 cipher
  'TLSv1.2:ECDHE-RSA-AES128-SHA256',
  'TLSv1.2:AES128-GCM-SHA256',
  'TLSv1.2:AES256-SHA',
  // Python requests
  'TLSv1.2:AES128-SHA',
  // Go net/http
  'TLSv1.2:ECDHE-RSA-AES128-SHA',
];

/**
 * TLS Fingerprint Guard
 * Nginx가 전달하는 X-TLS-Fingerprint 헤더를 분석하여
 * 브라우저 vs HTTP 클라이언트를 구별한다.
 *
 * Nginx 없이 직접 NestJS에 접속하면 헤더가 없으므로 skip (fail-open).
 */
@Injectable()
export class TlsFingerprintGuard extends BaseSecurityGuard {
  protected override readonly logger = new Logger(TlsFingerprintGuard.name);

  constructor(
    private readonly securityEventService: SecurityEventService,
    private readonly threatScoreService: ThreatScoreService,
    private readonly reflector: Reflector,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TLS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest<ExtendedRequest>();

    try {
      const tlsFingerprint = request.headers['x-tls-fingerprint'] as string;

      // Nginx를 거치지 않은 직접 접속 → 헤더 없음 → pass (fail-open)
      if (!tlsFingerprint) {
        return true;
      }

      const tlsVersion = request.headers['x-tls-version'] as string;
      const tlsCipher = request.headers['x-tls-cipher'] as string;

      // 알려진 브라우저 핑거프린트 → 통과
      if (KNOWN_BROWSER_FINGERPRINTS.has(tlsFingerprint)) {
        return true;
      }

      // 의심스러운 핑거프린트 확인
      const isSuspicious = SUSPICIOUS_FINGERPRINTS.some(
        (fp) => tlsFingerprint.includes(fp) || (tlsCipher && fp.includes(tlsCipher)),
      );

      if (isSuspicious) {
        const ip = this.getClientIp(request);

        this.logSecurityViolation(request, `Suspicious TLS fingerprint: ${tlsFingerprint}`);

        this.securityEventService.log({
          eventType: 'SUSPICIOUS_ACTIVITY',
          severity: 'MEDIUM',
          ip,
          userAgent: request.headers['user-agent'] as string,
          endpoint: request.url,
          method: request.method,
          description: `Suspicious TLS fingerprint detected: ${tlsVersion}/${tlsCipher}`,
          eventData: {
            tlsVersion,
            tlsCipher,
            tlsFingerprint,
          },
        });

        this.threatScoreService
          .recordViolation(ip, 'SUSPICIOUS_ACTIVITY', 'MEDIUM')
          .catch((err) => this.logger.error('Failed to record TLS threat violation', err?.message));

        // 차단하지 않고 위협 점수만 올림 (다른 Guard와 조합)
        // 단독으로 차단하면 TLS 설정이 다른 정상 클라이언트도 차단될 수 있음
        return true;
      }

      // 알려지지 않은 핑거프린트 → 로그만 (차단 안 함)
      this.logger.debug(`Unknown TLS fingerprint: ${tlsFingerprint}`);
      return true;
    } catch (error) {
      this.logger.error('TLS fingerprint check failed', error);
      return true; // fail-open
    }
  }
}
