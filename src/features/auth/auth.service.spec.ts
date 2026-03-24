import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { User } from '../../core/database/entities';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let jwtService: JwtService;

  const mockUser: Partial<User> = {
    id: 'user-uuid-1',
    username: 'testuser',
    email: 'test@example.com',
    password: '', // set in beforeEach
    role: 'user',
    isActive: true,
  };

  beforeEach(async () => {
    mockUser.password = await bcrypt.hash('password123', 12);

    userRepository = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn((data) => ({ ...data, id: 'new-uuid' })),
      save: jest.fn((data) => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn().mockReturnValue({ sub: 'user-uuid-1', username: 'testuser' }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('login', () => {
    it('올바른 자격증명으로 JWT 토큰 반환', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.login({ username: 'testuser', password: 'password123' });

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user.username).toBe('testuser');
    });

    it('잘못된 비밀번호로 UnauthorizedException', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.login({ username: 'testuser', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('존재하지 않는 사용자로 UnauthorizedException', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.login({ username: 'nobody', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('로그인 시 lastLoginAt 업데이트', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await service.login({ username: 'testuser', password: 'password123' }, '192.168.1.1');

      expect(userRepository.update).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.objectContaining({ lastLoginIp: '192.168.1.1' }),
      );
    });
  });

  describe('register', () => {
    it('새 사용자 등록 성공', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'securepassword',
      });

      expect(userRepository.create).toHaveBeenCalled();
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('중복 사용자 시 ConflictException', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.register({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('changePassword', () => {
    it('올바른 현재 비밀번호로 변경 성공', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.changePassword('user-uuid-1', {
        currentPassword: 'password123',
        newPassword: 'newpassword456',
      });

      expect(result.status).toBe('success');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('잘못된 현재 비밀번호로 BadRequestException', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.changePassword('user-uuid-1', {
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword456',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('존재하지 않는 사용자로 UnauthorizedException', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.changePassword('nonexistent', {
          currentPassword: 'password123',
          newPassword: 'newpassword456',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateToken', () => {
    it('유효한 토큰으로 사용자 반환', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.validateToken('valid-token');
      expect(result.username).toBe('testuser');
    });

    it('유효하지 않은 토큰으로 UnauthorizedException', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(service.validateToken('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('토큰의 사용자가 DB에 없으면 UnauthorizedException', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.validateToken('valid-token')).rejects.toThrow(UnauthorizedException);
    });
  });
});
