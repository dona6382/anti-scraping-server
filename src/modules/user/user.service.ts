import { 
  Injectable, 
  Logger, 
  NotFoundException, 
  BadRequestException,
  ForbiddenException,
  Inject 
} from '@nestjs/common';
import { 
  UserProfileDto, 
  UpdateUserDto, 
  DeleteUserDto, 
  UserResponseDto,
  UserValidationResult 
} from './dto/user.dto';
import { ICacheService } from '../../common/services/base-cache.service';
import { SecurityException } from '../../common/filters/global-exception.filter';

/**
 * User Service
 * 사용자 관련 비즈니스 로직을 처리
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly CACHE_TTL = 600; // 10 minutes
  private readonly DELETE_CONFIRMATION = 'DELETE MY ACCOUNT';

  constructor(
    @Inject('ICacheService') private readonly cache: ICacheService,
  ) {}

  /**
   * 사용자 프로필 조회
   */
  async getUserProfile(userId: string): Promise<UserProfileDto> {
    // 입력 검증
    if (!this.isValidUserId(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    // 캐시 확인
    const cacheKey = `user:profile:${userId}`;
    const cached = await this.cache.get<UserProfileDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for user profile: ${userId}`);
      return cached;
    }

    // 실제로는 DB에서 조회
    const profile = await this.fetchUserFromDatabase(userId);
    
    // 캐시 저장
    await this.cache.set(cacheKey, profile, this.CACHE_TTL);
    
    this.logger.log(`Retrieved user profile: ${userId}`);
    return profile;
  }

  /**
   * 사용자 정보 수정
   */
  async updateUser(userId: string, updateData: UpdateUserDto): Promise<UserResponseDto> {
    // 권한 검증 (실제로는 JWT 토큰 등으로 확인)
    await this.validateUserPermission(userId);

    // 입력 검증
    if (updateData.email && !this.isValidEmail(updateData.email)) {
      throw new BadRequestException('Invalid email format');
    }

    // 중복 체크 (username, email)
    if (updateData.username) {
      const exists = await this.checkUsernameExists(updateData.username);
      if (exists) {
        throw new BadRequestException('Username already taken');
      }
    }

    // 업데이트 수행 (실제로는 DB 업데이트)
    const updatedProfile = await this.performUpdate(userId, updateData);
    
    // 캐시 무효화
    await this.invalidateUserCache(userId);
    
    this.logger.log(`User ${userId} updated successfully`);
    
    return {
      status: 'success',
      message: 'User updated successfully',
      data: updatedProfile,
      updatedAt: new Date(),
    };
  }

  /**
   * 사용자 계정 삭제
   */
  async deleteUser(userId: string, confirmData: DeleteUserDto): Promise<UserResponseDto> {
    // 삭제 확인 문구 검증
    if (confirmData.confirmPhrase !== this.DELETE_CONFIRMATION) {
      throw new BadRequestException('Invalid confirmation phrase');
    }

    // 비밀번호 검증 (실제로는 해시 비교)
    const isValidPassword = await this.validatePassword(userId, confirmData.password);
    if (!isValidPassword) {
      throw new ForbiddenException('Invalid password');
    }

    // 삭제 전 데이터 백업 (감사 목적)
    await this.backupUserData(userId);
    
    // 관련 데이터 정리
    await this.cleanupUserData(userId);
    
    // 캐시 무효화
    await this.invalidateUserCache(userId);
    
    // 보안 이벤트 기록
    this.logger.error(`User account deleted: ${userId}`);
    
    return {
      status: 'success',
      message: 'User account deleted successfully',
      deletedAt: new Date(),
    };
  }

  /**
   * 사용자 검증
   */
  async validateUser(userId: string): Promise<UserValidationResult> {
    try {
      const user = await this.getUserProfile(userId);
      
      if (!user) {
        return {
          isValid: false,
          errors: ['User not found'],
        };
      }

      // 추가 검증 로직
      const errors: string[] = [];
      
      // 계정 상태 확인
      if (await this.isAccountSuspended(userId)) {
        errors.push('Account is suspended');
      }
      
      // 이메일 인증 확인
      if (!await this.isEmailVerified(userId)) {
        errors.push('Email not verified');
      }

      return {
        isValid: errors.length === 0,
        userId,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      this.logger.error(`User validation failed for ${userId}:`, error);
      return {
        isValid: false,
        errors: ['Validation failed'],
      };
    }
  }

  /**
   * 사용자 존재 여부 확인
   */
  async userExists(userId: string): Promise<boolean> {
    const cacheKey = `user:exists:${userId}`;
    
    // 캐시 확인
    const cached = await this.cache.get<boolean>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // DB 조회 시뮬레이션
    const exists = userId.startsWith('user_') || !isNaN(Number(userId));
    
    // 캐시 저장
    await this.cache.set(cacheKey, exists, 300); // 5분
    
    return exists;
  }

  // ===== Private Helper Methods =====

  /**
   * DB에서 사용자 조회 (시뮬레이션)
   */
  private async fetchUserFromDatabase(userId: string): Promise<UserProfileDto> {
    // 실제로는 DB 조회
    if (!await this.userExists(userId)) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return {
      id: userId,
      username: `user_${userId}`,
      email: `user${userId}@example.com`,
      joinDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      lastActive: new Date(),
      bio: `Bio for user ${userId}`,
    };
  }

  /**
   * 사용자 권한 검증
   */
  private async validateUserPermission(userId: string): Promise<void> {
    // 실제로는 JWT 토큰, 세션 등으로 확인
    // 여기서는 시뮬레이션
    const hasPermission = true;
    
    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  /**
   * 사용자 업데이트 수행
   */
  private async performUpdate(userId: string, updateData: UpdateUserDto): Promise<Partial<UserProfileDto>> {
    // 실제로는 DB UPDATE
    const currentProfile = await this.getUserProfile(userId);
    
    return {
      ...currentProfile,
      ...updateData,
    };
  }

  /**
   * 사용자 캐시 무효화
   */
  private async invalidateUserCache(userId: string): Promise<void> {
    const keys = [
      `user:profile:${userId}`,
      `user:exists:${userId}`,
    ];
    
    await this.cache.deleteMany(keys);
    this.logger.debug(`Cache invalidated for user: ${userId}`);
  }

  /**
   * 사용자 데이터 백업
   */
  private async backupUserData(userId: string): Promise<void> {
    const userData = await this.getUserProfile(userId);
    // 실제로는 별도 스토리지에 저장
    this.logger.log(`User data backed up: ${userId}`);
  }

  /**
   * 사용자 관련 데이터 정리
   */
  private async cleanupUserData(userId: string): Promise<void> {
    // 주문, 결제 등 관련 데이터 처리
    this.logger.log(`User data cleaned up: ${userId}`);
  }

  /**
   * 유효한 사용자 ID 형식 확인
   */
  private isValidUserId(userId: string): boolean {
    // UUID 또는 특정 형식 확인
    return /^[a-zA-Z0-9_-]+$/.test(userId);
  }

  /**
   * 이메일 형식 검증
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 사용자명 중복 확인
   */
  private async checkUsernameExists(username: string): Promise<boolean> {
    // 실제로는 DB 조회
    return false; // 시뮬레이션
  }

  /**
   * 비밀번호 검증
   */
  private async validatePassword(userId: string, password: string): Promise<boolean> {
    // 실제로는 bcrypt 등으로 해시 비교
    return password.length >= 8; // 시뮬레이션
  }

  /**
   * 계정 정지 여부 확인
   */
  private async isAccountSuspended(userId: string): Promise<boolean> {
    // 실제로는 DB 조회
    return false;
  }

  /**
   * 이메일 인증 여부 확인
   */
  private async isEmailVerified(userId: string): Promise<boolean> {
    // 실제로는 DB 조회
    return true;
  }
}
