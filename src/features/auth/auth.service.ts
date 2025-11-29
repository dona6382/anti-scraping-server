import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
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
    private readonly configService: ConfigService,
  ) {}

  async login(authDto: AuthDto) {
    const user = await this.validateUser(authDto.username, authDto.password);
    if (!user) {
      throw new Error('Invalid credentials');
    }

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
      throw new Error('User already exists');
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

  async changePassword(changePasswordDto: ChangePasswordDto) {
    // Implementation needed
    return { success: true };
  }

  private async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { username },
    });

    if (user && await bcrypt.compare(password, user.password)) {
      return user;
    }
    return null;
  }

  /**
   * Validate JWT token and return user
   */
  async validateToken(token: string): Promise<any> {
    try {
      const decoded = this.jwtService.verify(token);
      const user = await this.userRepository.findOne({
        where: { id: decoded.sub },
      });
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Create initial admin user
   */
  async createInitialAdmin(): Promise<void> {
    const adminExists = await this.userRepository.findOne({
      where: { role: 'admin' },
    });

    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
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

  /**
   * Get users with pagination
   */
  async getUsers(page: number, limit: number): Promise<{ users: any[], total: number }> {
    const [users, total] = await this.userRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      select: ['id', 'username', 'email', 'role', 'isActive', 'createdAt'],
    });

    return {
      users,
      total,
    };
  }

  /**
   * Create a new user
   */
  async createUser(userData: any): Promise<any> {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    const user = this.userRepository.create({
      ...userData,
      password: hashedPassword,
      isActive: true,
      isEmailVerified: false,
    });
    const savedUser = await this.userRepository.save(user);
    const { password, ...result } = savedUser as any;
    return result;
  }
}
