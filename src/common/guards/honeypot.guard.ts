import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { ConfigService } from '../services/config.service';
import { BaseGuard } from './base.guard';
import { IpBlacklistService } from '../services/ip-blacklist.service';
import { SecurityUtil, LogUtil } from '../utils/security.utils';
import { SECURITY_CONSTANTS, ERROR_MESSAGES } from '../constants/security.constants';
import { GuardType, BlockReason } from '../types/security.types';

/**
 * Honeypot Guard (리팩토링)
 */
@Injectable()
export class HoneypotGuard extends BaseGuard {
  protected readonly logger = new Logger(HoneypotGuard.name);
  protected readonly guardName = GuardType.HONEYPOT;

  private readonly honeypotFields: string[];
  private readonly timeThreshold: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly ipBlacklistService: IpBlacklistService,
  ) {
    super();

    // Load honeypot field names
    const configuredField = this.configService.get<string>(
      'app.honeypot.fieldName',
      'email_confirm',
    );
    this.honeypotFields = [
      configuredField,
      'email_confirm',
      'name_confirm',
      'phone_verify',
      'url_field',
      'website',
      'company_website',
      'fax',
    ];

    this.timeThreshold = SECURITY_CONSTANTS.HONEYPOT.TIME_THRESHOLD;

    this.logger.log(`Initialized with ${this.honeypotFields.length} honeypot fields`);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const method = this.getMethod(context);

    // Skip GET requests
    if (method === 'GET') {
      return true;
    }

    const ip = this.extractIp(context);
    const body = this.getBody(context);
    const path = this.getPath(context);

    // Check honeypot fields
    const triggeredField = this.checkHoneypotFields(body);
    if (triggeredField) {
      await this.handleBotDetection(ip, triggeredField, body[triggeredField], path);
      return false;
    }

    // Check timing honeypot
    if (this.isTimingHoneypotTriggered(body)) {
      await this.handleBotDetection(ip, 'timing', 'submission_too_fast', path);
      return false;
    }

    // Check JavaScript token (optional, warning only)
    if (this.shouldCheckJsToken(path) && !this.isValidJsToken(body)) {
      this.warn('Missing or invalid JS token', {
        ip: LogUtil.maskIp(ip),
        path,
      });
      // Don't block, just warn
    }

    // Store honeypot check result in metadata
    this.setRequestMetadata(context, 'honeypotPassed', true);

    return true;
  }

  /**
   * Check if any honeypot field is filled
   */
  private checkHoneypotFields(body: any): string | null {
    for (const fieldName of this.honeypotFields) {
      if (this.isFieldFilled(body, fieldName)) {
        return fieldName;
      }
    }
    return null;
  }

  /**
   * Check if a field is filled (not empty)
   */
  private isFieldFilled(body: any, fieldName: string): boolean {
    if (!(fieldName in body)) {
      return false;
    }

    const value = body[fieldName];

    // Check for any non-empty value
    if (value !== undefined && value !== null && value !== '') {
      // Also check for whitespace-only strings
      if (typeof value === 'string' && value.trim() !== '') {
        return true;
      }
      // Non-string non-empty values
      if (typeof value !== 'string') {
        return true;
      }
    }

    return false;
  }

  /**
   * Check timing-based honeypot
   */
  private isTimingHoneypotTriggered(body: any): boolean {
    if (!body._timestamp) {
      return false;
    }

    try {
      const submittedTime = parseInt(body._timestamp, 10);

      if (isNaN(submittedTime)) {
        return false;
      }

      const now = Date.now();
      const timeDiff = now - submittedTime;

      // Too fast (less than threshold)
      if (timeDiff > 0 && timeDiff < this.timeThreshold) {
        this.debug(`Form submitted too quickly: ${timeDiff}ms`);
        return true;
      }

      // Too old (more than 1 hour)
      if (timeDiff > SECURITY_CONSTANTS.HONEYPOT.TOKEN_EXPIRY) {
        this.debug(`Form token expired: ${timeDiff}ms`);
        return true;
      }

      // Future timestamp (clock issue or manipulation)
      if (timeDiff < 0) {
        this.debug(`Future timestamp detected: ${timeDiff}ms`);
        return true;
      }
    } catch (error) {
      this.debug('Failed to parse timestamp', { error: error.message });
    }

    return false;
  }

  /**
   * Check if JS token validation is required for this path
   */
  private shouldCheckJsToken(path: string): boolean {
    const jsRequiredPaths = ['/api/contact', '/api/register', '/api/comment', '/api/order'];
    return jsRequiredPaths.some((requiredPath) => path.includes(requiredPath));
  }

  /**
   * Validate JavaScript-generated token
   */
  private isValidJsToken(body: any): boolean {
    if (!body._jsToken) {
      return false;
    }

    return SecurityUtil.validateToken(body._jsToken, SECURITY_CONSTANTS.HONEYPOT.TOKEN_EXPIRY);
  }

  /**
   * Handle bot detection
   */
  private async handleBotDetection(
    ip: string,
    fieldName: string,
    value: any,
    path: string,
  ): Promise<void> {
    const valueStr =
      typeof value === 'string' ? value.substring(0, 50) : JSON.stringify(value).substring(0, 50);

    this.block(
      'Honeypot triggered',
      {
        ip,
        field: fieldName,
        value: valueStr,
        path,
      },
      ERROR_MESSAGES.BOT_DETECTED,
    );

    // Add IP to blacklist
    await this.ipBlacklistService.blacklistIp(
      ip,
      `${BlockReason.HONEYPOT}_${fieldName}`,
      SECURITY_CONSTANTS.IP_BLACKLIST.TEMPORARY_TTL,
    );
  }
}

/**
 * Honeypot field generator utility
 */
export class HoneypotFieldGenerator {
  /**
   * Generate HTML honeypot field
   */
  static generateHtmlField(fieldName: string = 'email_confirm'): string {
    const hidingMethods = [
      { style: 'display:none !important' },
      { style: 'position:absolute;left:-9999px' },
      { style: 'opacity:0;height:0;width:0;overflow:hidden' },
      { class: 'hidden', style: 'visibility:hidden' },
    ];

    const method = hidingMethods[Math.floor(Math.random() * hidingMethods.length)];
    const attributes = Object.entries(method)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');

    return `
      <!-- Honeypot field - do not fill -->
      <div ${attributes} aria-hidden="true">
        <label for="${fieldName}">Please leave this field empty</label>
        <input 
          type="text" 
          name="${fieldName}" 
          id="${fieldName}"
          tabindex="-1"
          autocomplete="off"
        />
      </div>
    `;
  }

  /**
   * Generate timestamp field
   */
  static generateTimestampField(): string {
    return `<input type="hidden" name="_timestamp" value="${Date.now()}" />`;
  }

  /**
   * Generate JavaScript token script
   */
  static generateJsTokenScript(): string {
    return `
      <script>
        (function() {
          window.addEventListener('DOMContentLoaded', function() {
            const forms = document.querySelectorAll('form');
            forms.forEach(function(form) {
              // Add timestamp
              const timestampField = document.createElement('input');
              timestampField.type = 'hidden';
              timestampField.name = '_timestamp';
              timestampField.value = Date.now();
              form.appendChild(timestampField);
              
              // Add JS token
              const tokenField = document.createElement('input');
              tokenField.type = 'hidden';
              tokenField.name = '_jsToken';
              tokenField.value = Date.now() + ':' + Math.random().toString(36).substring(2, 15);
              form.appendChild(tokenField);
            });
          });
        })();
      </script>
    `;
  }
}
