import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../../core/database/entities';
import { AuthDto, RegisterDto, ChangePasswordDto } from './dto/auth.dto';

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

    const payload = { username: user.username, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
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
      where: [
        { username: registerDto.username },
        { email: registerDto.email },
      ],
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 12);
    const user = this.userRepository.create({
      username: registerDto.username,
      email: registerDto.email,
      password: hashedPassword,
      role: 'user',
      isActive: true,
      isEmailVerified: false,
    });

    const savedUser = await this.userRepository.save(user);
    const { password, ...result } = savedUser as any;
    return result;
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
    await this.userRepository.save(user);

    return { success: true, message: 'Password changed successfully' };
  }

  private async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { username },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      return user;
    }
    return null;
  }

  async validateToken(token: string): Promise<User> {
    try {
      const decoded = this.jwtService.verify(token);
      const user = await this.userRepository.findOne({
        where: { id: decoded.sub },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Create initial admin user (환경변수에서 비밀번호 가져옴)
   */
  async createInitialAdmin(): Promise<void> {
    const adminExists = await this.userRepository.findOne({
      where: { role: 'admin' },
    });

    if (!adminExists) {
      const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
      if (!adminPassword) {
        this.logger.warn('INITIAL_ADMIN_PASSWORD not set - skipping admin creation');
        return;
      }

      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      const admin = this.userRepository.create({
        username: 'admin',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        isEmailVerified: true,
      });
      await this.userRepository.save(admin);
      this.logger.log('Initial admin user created');
    }
  }

  async getUsers(page: number, limit: number) {
    const [users, total] = await this.userRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      select: ['id', 'username', 'email', 'role', 'isActive', 'createdAt'],
    });

    return { users, total };
  }
}
