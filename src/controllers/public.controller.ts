import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Logger,
  Param,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiForbiddenResponse,
  ApiTooManyRequestsResponse,
  ApiBadRequestResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

// Services
import { BusinessService } from '../services/business.service';

// Guards
import { UserAgentGuard } from '../common/guards/user-agent.guard';
import { IpBlacklistGuard } from '../common/guards/ip-blacklist.guard';
import { HeadlessBrowserGuard } from '../common/guards/headless-browser.guard';

// DTOs
import {
  BaseResponseDto,
  SearchResponseDto,
  SampleItem,
} from '../common/dto';

/**
 * Public API Controller
 * 공개 API 엔드포인트 관리 (기본적인 보안만 적용)
 */
@ApiTags('Public APIs')
@Controller('api/public')
export class PublicController {
  private readonly logger = new Logger(PublicController.name);

  constructor(private readonly businessService: BusinessService) {}

  /**
   * 공개 데이터 조회
   */
  @Get('data')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 50 } }) // 1분에 50회
  @ApiOperation({ 
    summary: 'Get public data',
    description: 'Retrieve public data with basic rate limiting. No authentication required.'
  })
  @ApiResponse({
    status: 200,
    description: 'Public data retrieved successfully',
    type: BaseResponseDto<{ message: string; timestamp: string; items: SampleItem[] }>
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  getPublicData(): BaseResponseDto<{ message: string; timestamp: string; items: SampleItem[] }> {
    this.logger.log('Public data requested');

    const data = this.businessService.generatePublicData();
    return new BaseResponseDto(data);
  }

  /**
   * 공개 검색 API
   */
  @Get('search/:query')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 30000, limit: 30 } }) // 30초에 30회
  @ApiOperation({ 
    summary: 'Public search',
    description: 'Search public data with basic protection against automated tools.'
  })
  @ApiParam({ 
    name: 'query', 
    description: 'Search query string',
    example: 'typescript'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of results (1-50)',
    example: 10
  })
  @ApiResponse({
    status: 200,
    description: 'Search completed successfully',
    type: SearchResponseDto
  })
  @ApiTooManyRequestsResponse({ description: 'Search rate limit exceeded' })
  async searchPublicData(
    @Param('query') query: string,
    @Query('limit') limit?: number
  ): Promise<SearchResponseDto> {
    this.logger.log(`Public search query: ${query}`);

    const searchLimit = Math.min(Math.max(limit || 10, 1), 50); // 1-50 범위로 제한
    return await this.businessService.processSearch(query, searchLimit);
  }

  /**
   * 공개 통계 정보
   */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 300000, limit: 10 } }) // 5분에 10회
  @ApiOperation({ 
    summary: 'Get public statistics',
    description: 'Retrieve public statistics and metrics.'
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    type: BaseResponseDto
  })
  getPublicStats(): BaseResponseDto<{
    totalRequests: number;
    activeUsers: number;
    systemStatus: string;
    lastUpdated: string;
  }> {
    this.logger.log('Public stats requested');

    // 공개 통계 생성 (실제로는 데이터베이스나 캐시에서 조회)
    const stats = {
      totalRequests: Math.floor(Math.random() * 10000) + 1000,
      activeUsers: Math.floor(Math.random() * 500) + 50,
      systemStatus: 'operational',
      lastUpdated: new Date().toISOString(),
    };

    return new BaseResponseDto(stats);
  }

  /**
   * 공개 카테고리 목록
   */
  @Get('categories')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 600000, limit: 20 } }) // 10분에 20회
  @ApiOperation({ 
    summary: 'Get available categories',
    description: 'Retrieve list of available data categories.'
  })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully'
  })
  getCategories(): BaseResponseDto<Array<{
    id: number;
    name: string;
    description: string;
    itemCount: number;
  }>> {
    this.logger.log('Categories requested');

    const categories = [
      {
        id: 1,
        name: 'Technology',
        description: 'Technology related content',
        itemCount: 150
      },
      {
        id: 2,
        name: 'Science',
        description: 'Scientific articles and research',
        itemCount: 89
      },
      {
        id: 3,
        name: 'Business',
        description: 'Business and economy news',
        itemCount: 234
      }
    ];

    return new BaseResponseDto(categories);
  }

  /**
   * 공개 헬스 체크
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Public health check',
    description: 'Check if the public API is operational.'
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy'
  })
  getPublicHealth(): BaseResponseDto<{
    status: string;
    timestamp: string;
    version: string;
  }> {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };

    return new BaseResponseDto(health);
  }
}
