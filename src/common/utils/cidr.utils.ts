/**
 * CIDR Utility Class
 * IPv4 CIDR 범위 계산을 위한 유틸리티 (외부 의존성 없이 순수 수학 연산)
 */
export class CidrUtils {
  /**
   * IP가 CIDR 범위에 포함되는지 확인
   */
  static isInRange(ip: string, cidr: string): boolean {
    const [rangeIp, prefixStr] = cidr.split('/');
    if (!rangeIp || !prefixStr) {
      return false;
    }
    const prefix = parseInt(prefixStr, 10);
    if (isNaN(prefix) || prefix < 0 || prefix > 32) {
      return false;
    }

    const ipNum = this.ipToNumber(ip);
    const rangeNum = this.ipToNumber(rangeIp);
    if (ipNum === null || rangeNum === null) {
      return false;
    }

    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipNum & mask) === (rangeNum & mask);
  }

  /**
   * IP가 여러 CIDR 범위 중 하나에 포함되는지 확인
   */
  static isInAnyRange(ip: string, cidrs: string[]): boolean {
    return cidrs.some((cidr) => this.isInRange(ip, cidr));
  }

  /**
   * CIDR 포맷 유효성 검사
   */
  static isValidCidr(cidr: string): boolean {
    const parts = cidr.split('/');
    if (parts.length !== 2) {
      return false;
    }
    const prefix = parseInt(parts[1], 10);
    if (isNaN(prefix) || prefix < 16 || prefix > 32) {
      return false;
    } // min /16
    const octets = parts[0].split('.');
    if (octets.length !== 4) {
      return false;
    }
    return octets.every((o) => {
      const n = parseInt(o, 10);
      return !isNaN(n) && n >= 0 && n <= 255;
    });
  }

  /**
   * IPv4 주소를 32비트 정수로 변환
   */
  private static ipToNumber(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) {
      return null;
    }
    let num = 0;
    for (const part of parts) {
      const octet = parseInt(part, 10);
      if (isNaN(octet) || octet < 0 || octet > 255) {
        return null;
      }
      num = (num << 8) + octet;
    }
    return num >>> 0;
  }
}
