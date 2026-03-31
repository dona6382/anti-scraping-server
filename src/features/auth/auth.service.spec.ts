import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../../core/database/entities';

import { AuthService } from './auth.service';

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
    tokenVersion: 0,
    failedLoginAttempts: 0,
    lockedUntil: null,
  };

  beforeEach(async () => {
    mockUser.password = await bcrypt.hash('password123', 12);
    mockUser.tokenVersion = 0;

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
            verify: jest
              .fn()
              .mockReturnValue({ sub: 'user-uuid-1', username: 'testuser', tokenVersion: 0 }),
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
      expect(result.refresh_token).toBe('mock-jwt-token');
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

      await expect(service.login({ username: 'nobody', password: 'password123' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('잠긴 계정으로 로그인 시 UnauthorizedException', async () => {
      const lockedUser = {
        ...mockUser,
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000), // 15분 후
      };
      userRepository.findOne.mockResolvedValue(lockedUser);

      await expect(
        service.login({ username: 'testuser', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('5회 실패 후 계정 잠금', async () => {
      const userWith4Failures = {
        ...mockUser,
        failedLoginAttempts: 4,
        lockedUntil: null,
      };
      userRepository.findOne.mockResolvedValue(userWith4Failures);

      await expect(
        service.login({ username: 'testuser', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(userRepository.update).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.objectContaining({
          failedLoginAttempts: 5,
          lockedUntil: expect.any(Date),
        }),
      );
    });

    it('성공 로그인 시 failedLoginAttempts 리셋', async () => {
      const userWithFailures = {
        ...mockUser,
        failedLoginAttempts: 3,
        lockedUntil: null,
      };
      userRepository.findOne.mockResolvedValue(userWithFailures);

      const result = await service.login({ username: 'testuser', password: 'password123' });

      expect(result.access_token).toBe('mock-jwt-token');
      // First update call resets failed attempts, second updates lastLoginAt
      expect(userRepository.update).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      );
    });

    it('잠금 시간 만료 후 로그인 가능', async () => {
      const expiredLockUser = {
        ...mockUser,
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() - 1000), // 이미 만료
      };
      userRepository.findOne.mockResolvedValue(expiredLockUser);

      const result = await service.login({ username: 'testuser', password: 'password123' });

      expect(result.access_token).toBe('mock-jwt-token');
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

      await service.register({
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

  describe('refreshToken', () => {
    it('유효한 refresh token으로 새 access token 발급', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 'user-uuid-1',
        type: 'refresh',
        tokenVersion: 0,
      });
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.refreshToken({ refreshToken: 'valid-refresh-token' });

      expect(result.access_token).toBe('mock-jwt-token');
    });

    it('refresh 타입이 아닌 토큰으로 UnauthorizedException', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 'user-uuid-1',
        type: 'access',
        tokenVersion: 0,
      });

      await expect(
        service.refreshToken({ refreshToken: 'access-token-not-refresh' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('tokenVersion 불일치 시 UnauthorizedException', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 'user-uuid-1',
        type: 'refresh',
        tokenVersion: 0,
      });
      const userWithNewVersion = { ...mockUser, tokenVersion: 1 };
      userRepository.findOne.mockResolvedValue(userWithNewVersion);

      await expect(service.refreshToken({ refreshToken: 'old-refresh-token' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('비활성 사용자의 refresh token으로 UnauthorizedException', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 'user-uuid-1',
        type: 'refresh',
        tokenVersion: 0,
      });
      userRepository.findOne.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(service.refreshToken({ refreshToken: 'valid-refresh-token' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('만료된 refresh token으로 UnauthorizedException', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refreshToken({ refreshToken: 'expired-token' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('changePassword - token invalidation', () => {
    it('비밀번호 변경 시 tokenVersion 증가', async () => {
      userRepository.findOne.mockResolvedValue({ ...mockUser, tokenVersion: 0 });

      await service.changePassword('user-uuid-1', {
        currentPassword: 'password123',
        newPassword: 'NewP@ss123',
      });

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ tokenVersion: 1 }),
      );
    });

    it('비밀번호 변경 후 기존 refresh token 무효화', async () => {
      // Setup: user has tokenVersion 0
      userRepository.findOne.mockResolvedValue({ ...mockUser, tokenVersion: 0 });

      // Change password -> tokenVersion becomes 1
      await service.changePassword('user-uuid-1', {
        currentPassword: 'password123',
        newPassword: 'NewP@ss123',
      });

      // Now try refresh with old tokenVersion (0) - user now has tokenVersion 1
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 'user-uuid-1',
        type: 'refresh',
        tokenVersion: 0,
      });
      userRepository.findOne.mockResolvedValue({ ...mockUser, tokenVersion: 1 });

      await expect(service.refreshToken({ refreshToken: 'old-refresh-token' })).rejects.toThrow(
        UnauthorizedException,
      );
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
