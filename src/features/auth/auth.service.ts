import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { ResponseBuilder } from '../../common/utils/response.builder';
import { User } from '../../core/database/entities';

import { AuthDto, RegisterDto, ChangePasswordDto, RefreshTokenDto } from './dto/auth.dto';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async login(authDto: AuthDto, clientIp?: string) {
    const user = await this.validateUser(authDto.username, authDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update login tracking
    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
      ...(clientIp && { lastLoginIp: clientIp }),
    });

    const basePayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };
    const accessToken = this.jwtService.sign(basePayload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh', tokenVersion: user.tokenVersion },
      { expiresIn: '7d' },
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.userRepository.findOne({
      where: [{ username: registerDto.username }, { email: registerDto.email }],
    });

    if (existingUser) {
      // 어떤 필드가 중복인지 노출하지 않음 (사용자 열거 방지)
      throw new ConflictException('Registration failed. Please try different credentials.');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 12);
    const user = this.userRepository.create({
      username: registerDto.username,
      email: registerDto.email,
      password: hashedPassword,
      role: 'user',
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);
    return {
      id: savedUser.id,
      username: savedUser.username,
      email: savedUser.email,
      role: savedUser.role,
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const decoded = this.jwtService.verify(dto.refreshToken) as {
        sub: string;
        type?: string;
        tokenVersion?: number;
      };

      if (decoded.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.userRepository.findOne({ where: { id: decoded.sub } });
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or deactivated');
      }

      if (decoded.tokenVersion !== user.tokenVersion) {
        throw new UnauthorizedException('Token has been revoked');
      }

      const payload = {
        sub: user.id,
        username: user.username,
        role: user.role,
        tokenVersion: user.tokenVersion,
      };
      return {
        access_token: this.jwtService.sign(payload, { expiresIn: '15m' }),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isCurrentValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.password = await bcrypt.hash(dto.newPassword, 12);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await this.userRepository.save(user);

    return ResponseBuilder.success(null, 'Password changed successfully');
  }

  private async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { username },
    });

    if (!user || !user.isActive) {
      return null;
    }

    // Check if account is locked (동일 메시지로 사용자명 열거 방지)
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (await bcrypt.compare(password, user.password)) {
      // Reset failed attempts on successful login
      if (user.failedLoginAttempts > 0 || user.lockedUntil) {
        await this.userRepository.update(user.id, {
          failedLoginAttempts: 0,
          lockedUntil: null,
        });
      }
      return user;
    }

    // Increment failed attempts
    const failedAttempts = (user.failedLoginAttempts || 0) + 1;
    const updateData: Partial<User> = { failedLoginAttempts: failedAttempts };

    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
      this.logger.warn(
        `Account locked for user: ${username} after ${failedAttempts} failed attempts`,
      );
    }

    await this.userRepository.update(user.id, updateData);

    return null;
  }

  async validateToken(token: string): Promise<User> {
    try {
      const decoded = this.jwtService.verify(token) as {
        sub: string;
        type?: string;
        tokenVersion?: number;
      };
      if (!decoded?.sub) {
        throw new UnauthorizedException('Invalid token payload');
      }
      // Refresh Token을 Access Token으로 사용 방지 (7일 vs 15분)
      if (decoded.type === 'refresh') {
        throw new UnauthorizedException('Refresh tokens cannot be used for authentication');
      }

      const user = await this.userRepository.findOne({
        where: { id: decoded.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or deactivated');
      }

      if (decoded.tokenVersion === undefined || decoded.tokenVersion !== user.tokenVersion) {
        throw new UnauthorizedException('Token has been revoked');
      }

      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
