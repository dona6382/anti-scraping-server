import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainException } from '../../core/domain/exceptions/domain.exceptions';

/**
 * Global Exception Filter
 * 모든 예외를 처리하고 일관된 응답 형식을 제공
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details: any = undefined;

    // Handle Domain Exceptions
    if (exception instanceof DomainException) {
      status = exception.statusCode;
      message = exception.message;
      code = exception.code;
      details = exception.context;
      
      this.logger.warn(`Domain exception: ${code} - ${message}`, details);
    }
    // Handle HTTP Exceptions
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();
      
      if (typeof errorResponse === 'string') {
        message = errorResponse;
      } else if (typeof errorResponse === 'object' && errorResponse !== null) {
        message = (errorResponse as any).message || message;
        code = (errorResponse as any).error || code;
        details = (errorResponse as any).details;
      }
      
      this.logger.warn(`HTTP exception: ${status} - ${message}`);
    }
    // Handle unknown errors
    else if (exception instanceof Error) {
      message = exception.message;
      
      // Log full error in development
      if (process.env.NODE_ENV !== 'production') {
        details = {
          stack: exception.stack,
        };
      }
      
      this.logger.error('Unhandled exception:', exception);
    }

    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production' && status === HttpStatus.INTERNAL_SERVER_ERROR) {
      message = 'An error occurred processing your request';
      details = undefined;
    }

    // Send error response
    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        ...(details && { details }),
      },
      // Add request ID if available
      ...(request.id && { requestId: request.id }),
    });
  }
}
