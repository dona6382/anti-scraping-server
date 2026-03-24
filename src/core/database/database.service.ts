import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppConfigService } from '../config/config.service';

/**
 * Database Service
 * 데이터베이스 연결 관리 및 헬스체크
 */
@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: AppConfigService,
  ) {}

  /**
   * 데이터베이스 연결 상태 확인
   */
  async isConnected(): Promise<boolean> {
    try {
      if (!this.dataSource.isInitialized) {
        return false;
      }
      
      // Simple query to test connection
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error(`Database connection check failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 데이터베이스 통계 정보
   */
  async getStats(): Promise<{
    isConnected: boolean;
    database: string;
    host: string;
    port: number;
    connectionCount?: number;
    version?: string;
  }> {
    const dbConfig = this.configService.databaseConfig;
    const isConnected = await this.isConnected();
    
    let version: string | undefined;
    let connectionCount: number | undefined;
    
    if (isConnected) {
      try {
        // Get PostgreSQL version
        const versionResult = await this.dataSource.query('SELECT version()');
        version = versionResult[0]?.version?.split(' ').slice(0, 2).join(' ');
        
        // Get active connections
        const connectionResult = await this.dataSource.query(
          'SELECT count(*) as count FROM pg_stat_activity WHERE state = $1',
          ['active']
        );
        connectionCount = parseInt(connectionResult[0]?.count || '0');
      } catch (error) {
        this.logger.warn(`Failed to get database stats: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return {
      isConnected,
      database: dbConfig.database,
      host: dbConfig.host,
      port: dbConfig.port,
      connectionCount,
      version,
    };
  }

  /**
   * 데이터베이스 초기화 및 시드 데이터
   */
  async initializeDatabase(): Promise<void> {
    if (!await this.isConnected()) {
      this.logger.error('Cannot initialize database - not connected');
      return;
    }

    try {
      // Create initial admin user if not exists
      await this.createInitialData();
      this.logger.log('Database initialization completed');
    } catch (error) {
      this.logger.error(`Database initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 초기 데이터 생성
   */
  private async createInitialData(): Promise<void> {
    this.logger.log('Database initialized');
  }

  /**
   * 헬스체크용 간단한 쿼리
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    details?: Record<string, unknown>;
  }> {
    const startTime = Date.now();
    
    try {
      await this.dataSource.query('SELECT NOW() as current_time');
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime,
        details: {
          database: this.configService.databaseConfig.database,
          host: this.configService.databaseConfig.host,
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : String(error),
        }
      };
    }
  }

  /**
   * 데이터베이스 정리 (개발용)
   */
  async cleanup(): Promise<void> {
    if (!this.configService.isDevelopment) {
      this.logger.warn('Database cleanup is only available in development mode');
      return;
    }

    try {
      // Clear cache
      await this.dataSource.queryResultCache?.clear();
      this.logger.log('Database cache cleared');
    } catch (error) {
      this.logger.error(`Database cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
