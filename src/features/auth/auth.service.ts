import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../../core/database/entities';
import { AppConfigService } from '../../core/config/config.service';
import { RequestUtils } from '../../shared/utils/request.utils';

/**
 * JWT Payload Interface
 */
export interface JwtPayload {
  sub: string; // user id
  username: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Login Response Interface
 */
export interface LoginResponse {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    fullName: string;
  };
  tokens: {
    accessToken: string;
    refreshToken?: string;
  };
  expiresIn: number;
}

/**
 * Auth Service
 * JWT 기반 인증 시스템
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: AppConfigService,
  ) {}

  /**
   * 사용자 로그인
   */
  async login(username: string, password: string, clientIp?: string): Promise<LoginResponse> {
    // 사용자 조회
    const user = await this.userRepository.findOne({
      where: [
        { username },
        { email: username }, // username으로 email도 허용
      ]
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    // 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 로그인 정보 업데이트
    await this.updateLoginInfo(user, clientIp);

    // JWT 토큰 생성
    const tokens = await this.generateTokens(user);

    this.logger.log(`User ${user.username} logged in from ${clientIp || 'unknown IP'}`);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
      tokens,
      expiresIn: 3600, // 1 hour
    };
  }

  /**
   * JWT 토큰 검증
   */
  async validateToken(token: string): Promise<User | null> {
    try {
      const payload = this.jwtService.verify(token) as JwtPayload;
      
      const user = await this.userRepository.findOne({
        where: { id: payload.sub }
      });

      if (!user || !user.isActive) {
        return null;
      }

      return user;
    } catch (error) {
      this.logger.warn(`Token validation failed: ${error.message}`);
      return null;
    }
  }

  /**
   * 사용자 생성 (관리자용)
   */
  async createUser(userData: {
    username: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    role?: 'admin' | 'user' | 'readonly';
  }): Promise<User> {
    // 중복 확인
    const existingUser = await this.userRepository.findOne({
      where: [
        { username: userData.username },
        { email: userData.email },
      ]
    });

    if (existingUser) {
      throw new Error('Username or email already exists');
    }

    // 비밀번호 해싱
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

    // 사용자 생성
    const user = this.userRepository.create({
      ...userData,
      password: hashedPassword,
      role: userData.role || 'user',
    });

    const savedUser = await this.userRepository.save(user);
    this.logger.log(`New user created: ${savedUser.username}`);

    return savedUser;
  }

  /**
   * 비밀번호 변경
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // 현재 비밀번호 확인
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // 새 비밀번호 해싱
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // 비밀번호 업데이트
    await this.userRepository.update(userId, {
      password: hashedNewPassword,
    });

    this.logger.log(`Password changed for user: ${user.username}`);
  }

  /**
   * 사용자 프로필 업데이트
   */
  async updateProfile(userId: string, updates: {
    firstName?: string;
    lastName?: string;
    preferences?: any;
  }): Promise<User> {
    await this.userRepository.update(userId, updates);
    
    const updatedUser = await this.userRepository.findOne({ where: { id: userId } });
    if (!updatedUser) {
      throw new Error('User not found after update');
    }

    return updatedUser;
  }

  /**
   * JWT 토큰 생성
   */
  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken?: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '1h',
    });

    // TODO: Implement refresh token logic if needed
    // const refreshToken = this.jwtService.sign(payload, {
    //   expiresIn: '7d',
    // });

    return {
      accessToken,
      // refreshToken,
    };
  }

  /**
   * 로그인 정보 업데이트
   */
  private async updateLoginInfo(user: User, clientIp?: string): Promise<void> {
    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
      lastLoginIp: clientIp,
    });
  }

  /**
   * 초기 관리자 계정 생성
   */
  async createInitialAdmin(): Promise<void> {
    const adminExists = await this.userRepository.findOne({
      where: { role: 'admin' }
    });

    if (adminExists) {
      this.logger.log('Admin user already exists');
      return;
    }

    try {
      await this.createUser({
        username: 'admin',
        email: 'admin@anti-scraping-server.local',
        password: 'admin123!@#', // Should be changed immediately
        firstName: 'System',
        lastName: 'Administrator',
        role: 'admin',
      });

      this.logger.warn('Initial admin created - username: admin, password: admin123!@# (CHANGE IMMEDIATELY!)');
    } catch (error) {
      this.logger.error(`Failed to create initial admin: ${error.message}`);
    }
  }

  /**
   * 사용자 목록 조회 (관리자용)
   */
  async getUsers(page: number = 1, limit: number = 10): Promise<{
    users: User[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [users, total] = await this.userRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      select: ['id', 'username', 'email', 'firstName', 'lastName', 'role', 'isActive', 'createdAt', 'lastLoginAt'],
    });

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
