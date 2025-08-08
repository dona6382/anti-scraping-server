/**
 * Request 컨텍스트 정보를 담는 Value Object
 */
export class RequestContext {
  constructor(
    public readonly ip: string,
    public readonly userAgent: string,
    public readonly path: string,
    public readonly method: string,
    public readonly headers: Record<string, any>,
    public readonly body?: any,
  ) {}

  static fromExpressRequest(request: any): RequestContext {
    return new RequestContext(
      this.extractIp(request),
      request.headers?.['user-agent'] || '',
      request.path || request.url || '',
      request.method || 'GET',
      request.headers || {},
      request.body,
    );
  }

  private static extractIp(request: any): string {
    const forwarded = request.headers?.['x-forwarded-for'];
    if (forwarded) {
      const ips = forwarded.split(',').map((ip: string) => ip.trim());
      return this.normalizeIp(ips[0]);
    }

    const directIp =
      request.headers?.['x-real-ip'] ||
      request.headers?.['x-client-ip'] ||
      request.ip ||
      request.socket?.remoteAddress ||
      '';

    return this.normalizeIp(directIp);
  }

  private static normalizeIp(ip: string): string {
    if (!ip) return '';
    if (ip.includes('::ffff:')) {
      return ip.replace('::ffff:', '');
    }
    if (ip === '::1') {
      return '127.0.0.1';
    }
    return ip;
  }

  hasProxyHeaders(): boolean {
    const proxyHeaders = ['x-forwarded-for', 'via', 'forwarded'];
    return proxyHeaders.some((header) => this.headers[header] !== undefined);
  }

  isPrivateIp(): boolean {
    const privateRanges = [/^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./];
    return privateRanges.some((range) => range.test(this.ip));
  }

  getMaskedIp(): string {
    if (!this.ip) return 'unknown';
    const parts = this.ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }
    return `${this.ip.split(':')[0]}:xxxx`;
  }
}

/**
 * 보안 검증 결과
 */
export class SecurityCheckResult {
  constructor(
    public readonly passed: boolean,
    public readonly reason?: string,
    public readonly details?: Record<string, any>,
  ) {}

  static pass(): SecurityCheckResult {
    return new SecurityCheckResult(true);
  }

  static fail(reason: string, details?: Record<string, any>): SecurityCheckResult {
    return new SecurityCheckResult(false, reason, details);
  }
}
