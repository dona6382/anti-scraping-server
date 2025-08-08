import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

/**
 * Custom logger service with structured logging
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly context: string;
  private readonly isProduction = process.env.NODE_ENV === 'production';

  constructor(context?: string) {
    this.context = context || 'Application';
  }

  /**
   * Write a 'log' level log.
   */
  log(message: any, context?: string): void {
    if (!this.isProduction || this.shouldLog('log')) {
      this.printMessage('LOG', message, context);
    }
  }

  /**
   * Write an 'error' level log.
   */
  error(message: any, trace?: string, context?: string): void {
    this.printMessage('ERROR', message, context);
    if (trace && !this.isProduction) {
      console.error(trace);
    }
  }

  /**
   * Write a 'warn' level log.
   */
  warn(message: any, context?: string): void {
    this.printMessage('WARN', message, context);
  }

  /**
   * Write a 'debug' level log.
   */
  debug(message: any, context?: string): void {
    if (!this.isProduction || this.shouldLog('debug')) {
      this.printMessage('DEBUG', message, context);
    }
  }

  /**
   * Write a 'verbose' level log.
   */
  verbose(message: any, context?: string): void {
    if (!this.isProduction || this.shouldLog('verbose')) {
      this.printMessage('VERBOSE', message, context);
    }
  }

  /**
   * Print formatted message
   */
  private printMessage(level: string, message: any, context?: string): void {
    const timestamp = new Date().toISOString();
    const contextName = context || this.context;

    const formattedMessage =
      typeof message === 'object' ? JSON.stringify(message, null, 2) : message;

    const color = this.getColor(level);

    console.log(`${color}[${timestamp}] [${level}] [${contextName}] ${formattedMessage}\x1b[0m`);
  }

  /**
   * Get color for log level
   */
  private getColor(level: string): string {
    switch (level) {
      case 'ERROR':
        return '\x1b[31m'; // Red
      case 'WARN':
        return '\x1b[33m'; // Yellow
      case 'LOG':
        return '\x1b[32m'; // Green
      case 'DEBUG':
        return '\x1b[36m'; // Cyan
      case 'VERBOSE':
        return '\x1b[35m'; // Magenta
      default:
        return '\x1b[0m';
    }
  }

  /**
   * Check if should log based on level
   */
  private shouldLog(level: string): boolean {
    const logLevel = process.env.LOG_LEVEL || 'log';
    const levels = ['error', 'warn', 'log', 'debug', 'verbose'];
    const currentLevelIndex = levels.indexOf(logLevel);
    const targetLevelIndex = levels.indexOf(level);

    return targetLevelIndex <= currentLevelIndex;
  }
}
