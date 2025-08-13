import {
  Controller,
  Get,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

// Services
import { AppService } from './app.service';

/**
 * App Controller (Simplified)
 * 기본적인 애플리케이션 엔드포인트만 포함
 * 모든 기능별 API는 각각의 전용 컨트롤러로 분리됨
 */
@ApiTags('Application')
@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  /**
   * 루트 엔드포인트 - 헬스 체크
   */
  @Get()
  @SkipThrottle()
  @ApiOperation({ 
    summary: 'Application health check',
    description: `
    Basic health check endpoint for the Anti-Scraping Server.
    
    **API Structure:**
    - /api/public/* - Public APIs with basic protection
    - /api/protected/* - Protected APIs with enhanced security  
    - /api/secure/* - Secure APIs with maximum protection
    - /admin/* - Administrative functions
    - /test/* - Security testing endpoints
    
    **Documentation:** Visit /api-docs for complete API documentation
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Server is running and healthy'
  })
  getHello(): string {
    this.logger.log('Root endpoint accessed');
    return this.appService.getHello();
  }

  /**
   * API 구조 정보
   */
  @Get('api')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get API structure information',
    description: 'Retrieve information about available API endpoints and their security levels.'
  })
  @ApiResponse({
    status: 200,
    description: 'API structure information retrieved'
  })
  getApiInfo(): {
    message: string;
    version: string;
    endpoints: Array<{
      path: string;
      description: string;
      securityLevel: string;
      documentation: string;
    }>;
    documentation: string;
  } {
    this.logger.log('API info requested');

    return {
      message: 'Anti-Scraping Server API',
      version: '1.0.0',
      endpoints: [
        {
          path: '/api/public/*',
          description: 'Public APIs with basic rate limiting',
          securityLevel: 'Basic',
          documentation: '/api-docs#/Public%20APIs'
        },
        {
          path: '/api/protected/*', 
          description: 'Protected APIs with enhanced security',
          securityLevel: 'Enhanced',
          documentation: '/api-docs#/Protected%20APIs'
        },
        {
          path: '/api/secure/*',
          description: 'Secure APIs with maximum protection',
          securityLevel: 'Maximum',
          documentation: '/api-docs#/Secure%20APIs'
        },
        {
          path: '/admin/*',
          description: 'Administrative functions',
          securityLevel: 'Admin',
          documentation: '/api-docs#/Admin'
        },
        {
          path: '/test/*',
          description: 'Security testing endpoints',
          securityLevel: 'Testing',
          documentation: '/api-docs#/Security%20Testing'
        }
      ],
      documentation: '/api-docs'
    };
  }
}
