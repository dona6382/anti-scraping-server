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
  ApiQuery,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { PublicService } from './public.service';
import { UserAgentGuard } from '../../shared/guards';

/**
 * Public API Controller
 * 공개 API 엔드포인트 관리 (기본적인 보안만 적용)
 */
@ApiTags('Public APIs')
@Controller('api/public')
@UseGuards(UserAgentGuard) // 기본 User-Agent 검증
export class PublicController {
  private readonly logger = new Logger(PublicController.name);

  constructor(private readonly publicService: PublicService) {}

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
  @ApiResponse({ status: 200, description: 'Public data retrieved successfully' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  async getPublicData() {
    this.logger.log('Public data requested');
    return await this.publicService.getPublicData();
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
  @ApiResponse({ status: 200, description: 'Search completed successfully' })
  @ApiTooManyRequestsResponse({ description: 'Search rate limit exceeded' })
  async searchPublicData(
    @Param('query') query: string,
    @Query('limit') limit?: number
  ) {
    this.logger.log(`Public search query: ${query}`);
    const searchLimit = Math.min(Math.max(limit || 10, 1), 50);
    return await this.publicService.searchData(query, searchLimit);
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
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getPublicStats() {
    this.logger.log('Public stats requested');
    return await this.publicService.getPublicStats();
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
  @ApiResponse({ status: 200, description: 'Categories retrieved successfully' })
  async getCategories() {
    this.logger.log('Categories requested');
    return await this.publicService.getCategories();
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
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async getPublicHealth() {
    return await this.publicService.getHealthStatus();
  }
}
