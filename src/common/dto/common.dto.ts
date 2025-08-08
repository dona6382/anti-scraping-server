/**
 * Common DTOs without class-validator
 * class-validator가 설치되지 않은 경우를 위한 기본 DTO
 */

export class ContactDto {
  name: string;
  email: string;
  message: string;
  email_confirm?: string;
  _timestamp?: string;
  _jsToken?: string;
  recaptchaToken?: string;
}

export class BlacklistIpDto {
  ip: string;
  reason?: string;
  ttl?: number;
}

export class SearchDto {
  query: string;
}

// Manual validation helpers
export class DtoValidator {
  static validateContact(dto: ContactDto): string[] {
    const errors: string[] = [];
    
    if (!dto.name || dto.name.length < 2 || dto.name.length > 100) {
      errors.push('Name must be between 2 and 100 characters');
    }
    
    if (!dto.email || !this.isValidEmail(dto.email)) {
      errors.push('Invalid email address');
    }
    
    if (!dto.message || dto.message.length < 10 || dto.message.length > 1000) {
      errors.push('Message must be between 10 and 1000 characters');
    }
    
    // Honeypot check
    if (dto.email_confirm && dto.email_confirm.length > 0) {
      errors.push('Bot detected');
    }
    
    return errors;
  }
  
  static validateBlacklistIp(dto: BlacklistIpDto): string[] {
    const errors: string[] = [];
    
    if (!dto.ip || !this.isValidIp(dto.ip)) {
      errors.push('Invalid IP address');
    }
    
    if (dto.reason && dto.reason.length > 500) {
      errors.push('Reason must be less than 500 characters');
    }
    
    if (dto.ttl !== undefined && (dto.ttl < 0 || dto.ttl > 31536000)) {
      errors.push('TTL must be between 0 and 31536000 seconds');
    }
    
    return errors;
  }
  
  static validateSearch(dto: SearchDto): string[] {
    const errors: string[] = [];
    
    if (!dto.query || dto.query.length < 1 || dto.query.length > 100) {
      errors.push('Query must be between 1 and 100 characters');
    }
    
    if (dto.query && !/^[a-zA-Z0-9\s\-_]+$/.test(dto.query)) {
      errors.push('Query can only contain letters, numbers, spaces, hyphens, and underscores');
    }
    
    return errors;
  }
  
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }
  
  private static isValidIp(ip: string): boolean {
    // IPv4
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(ip)) {
      const parts = ip.split('.');
      return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
      });
    }
    
    // IPv6 (simplified)
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    return ipv6Regex.test(ip);
  }
}
