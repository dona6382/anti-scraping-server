/**
 * IP Address Value Object
 * IP 주소를 표현하는 불변 값 객체
 */
export class IpAddress {
  private readonly value: string;

  constructor(value: string) {
    if (!IpAddress.isValid(value)) {
      throw new Error(`Invalid IP address: ${value}`);
    }
    this.value = IpAddress.normalize(value);
  }

  /**
   * IP 주소 문자열 반환
   */
  toString(): string {
    return this.value;
  }

  /**
   * IPv4 여부 확인
   */
  isIPv4(): boolean {
    return IpAddress.isIPv4(this.value);
  }

  /**
   * IPv6 여부 확인
   */
  isIPv6(): boolean {
    return IpAddress.isIPv6(this.value);
  }

  /**
   * 프라이빗 IP 여부 확인
   */
  isPrivate(): boolean {
    const privateRanges = [
      /^127\./,                          // Loopback
      /^10\./,                           // Class A private
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // Class B private
      /^192\.168\./,                     // Class C private
      /^169\.254\./,                     // Link-local
      /^::1$/,                           // IPv6 loopback
      /^fe80:/i,                         // IPv6 link-local
      /^fc00:/i,                         // IPv6 unique local
    ];

    return privateRanges.some(range => range.test(this.value));
  }

  /**
   * 같은 서브넷인지 확인
   */
  isSameSubnet(other: IpAddress, maskBits: number = 24): boolean {
    if (this.isIPv4() !== other.isIPv4()) {
      return false;
    }

    if (this.isIPv4()) {
      const thisParts = this.value.split('.').map(Number);
      const otherParts = other.value.split('.').map(Number);
      
      const bytesToCheck = Math.floor(maskBits / 8);
      for (let i = 0; i < bytesToCheck; i++) {
        if (thisParts[i] !== otherParts[i]) {
          return false;
        }
      }
      
      if (maskBits % 8 !== 0) {
        const remainingBits = maskBits % 8;
        const mask = (0xFF << (8 - remainingBits)) & 0xFF;
        if ((thisParts[bytesToCheck] & mask) !== (otherParts[bytesToCheck] & mask)) {
          return false;
        }
      }
      
      return true;
    }

    // Simplified IPv6 comparison
    return this.value.startsWith(other.value.substring(0, maskBits / 4));
  }

  /**
   * 마스킹된 IP 반환
   */
  getMasked(): string {
    if (this.isIPv4()) {
      const parts = this.value.split('.');
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    } else {
      const parts = this.value.split(':');
      return `${parts.slice(0, 4).join(':')}:xxxx:xxxx:xxxx:xxxx`;
    }
  }

  /**
   * 두 IP가 같은지 비교
   */
  equals(other: IpAddress): boolean {
    return this.value === other.value;
  }

  /**
   * IP 유효성 검증
   */
  static isValid(ip: string): boolean {
    if (!ip) return false;
    return IpAddress.isIPv4(ip) || IpAddress.isIPv6(ip);
  }

  /**
   * IPv4 검증
   */
  private static isIPv4(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(ip)) return false;

    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  /**
   * IPv6 검증
   */
  private static isIPv6(ip: string): boolean {
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    return ipv6Regex.test(ip);
  }

  /**
   * IP 정규화
   */
  private static normalize(ip: string): string {
    // Remove IPv6 prefix for IPv4
    if (ip.includes('::ffff:')) {
      return ip.replace('::ffff:', '');
    }
    // Convert IPv6 loopback to IPv4
    if (ip === '::1') {
      return '127.0.0.1';
    }
    return ip.toLowerCase();
  }

  /**
   * 요청에서 IP 추출
   */
  static fromRequest(request: any): IpAddress {
    const forwarded = request.headers?.['x-forwarded-for'];
    if (forwarded) {
      const ips = forwarded.split(',').map((ip: string) => ip.trim());
      return new IpAddress(ips[0]);
    }

    const ip = 
      request.headers?.['x-real-ip'] ||
      request.headers?.['x-client-ip'] ||
      request.ip ||
      request.socket?.remoteAddress ||
      '127.0.0.1';

    return new IpAddress(ip);
  }
}
