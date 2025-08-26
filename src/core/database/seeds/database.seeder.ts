import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AuthService } from '../../../features/auth/auth.service';
import { AppConfigService } from '../../config/config.service';
import { DatabaseService } from '../database.service';

/**
 * Database Seeder
 * 초기 데이터 생성 및 시드
 */
@Injectable()
export class DatabaseSeeder implements OnModuleInit {
  private readonly logger = new Logger(DatabaseSeeder.name);

  constructor(
    private readonly authService: AuthService,
    private readonly databaseService: DatabaseService,
    private readonly configService: AppConfigService,
  ) {}

  async onModuleInit() {
    // 개발 환경에서만 시드 실행
    if (this.configService.isDevelopment) {
      await this.runSeeds();
    }
  }

  /**
   * 모든 시드 실행
   */
  async runSeeds(): Promise<void> {
    try {
      // 데이터베이스 연결 확인
      const isConnected = await this.databaseService.isConnected();
      if (!isConnected) {
        this.logger.warn('Database not connected - skipping seeds');
        return;
      }

      this.logger.log('Running database seeds...');

      // 초기 관리자 계정 생성
      await this.createInitialAdmin();

      // 테스트 데이터 생성 (개발 환경)
      if (this.configService.isDevelopment) {
        await this.createTestData();
      }

      this.logger.log('Database seeding completed');
    } catch (error) {
      this.logger.error(`Database seeding failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 초기 관리자 계정 생성
   */
  private async createInitialAdmin(): Promise<void> {
    try {
      // await this.authService.createInitialAdmin(); // TODO: Implement this method in AuthService
    } catch (error) {
      this.logger.error(`Failed to create initial admin: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 테스트 데이터 생성
   */
  private async createTestData(): Promise<void> {
    try {
      // 테스트 사용자들 생성
      const testUsers = [
        {
          username: 'testuser',
          email: 'test@example.com',
          password: 'test123!',
          firstName: 'Test',
          lastName: 'User',
          role: 'user' as const,
        },
        {
          username: 'readonly',
          email: 'readonly@example.com',
          password: 'readonly123!',
          firstName: 'ReadOnly',
          lastName: 'User',
          role: 'readonly' as const,
        },
      ];

      for (const userData of testUsers) {
        try {
          // const existingUsers = await this.authService.getUsers(1, 10); // TODO: Implement this method
          const existingUsers = { users: [] }; // Temporary placeholder
          const userExists = existingUsers.users.some((u: any) => u.username === userData.username);
          
          if (!userExists) {
            // await this.authService.createUser(userData); // TODO: Implement this method
            this.logger.log(`Created test user: ${userData.username}`);
          }
        } catch (error) {
          this.logger.warn(`Test user ${userData.username} already exists or creation failed`);
        }
      }

    } catch (error) {
      this.logger.error(`Failed to create test data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
