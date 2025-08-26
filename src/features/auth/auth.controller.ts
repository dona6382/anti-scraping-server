import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
  Logger,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { AuthService, LoginResponse } from './auth.service';
import { JwtAuthGuard, RolesGuard, AuthenticatedRequest } from './guards/auth.guards';
import { Public, Roles, CurrentUser } from './auth.decorators';
import { LoginDto, CreateUserDto, ChangePasswordDto, UpdateProfileDto } from './dto/auth.dto';
import { User } from '../../core/database/entities';
import { RequestUtils } from '../../shared/utils/request.utils';

/**
 * Auth Controller
 * 인증 및 사용자 관리
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * 사용자 로그인
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'User login',
    description: 'Authenticate user and return JWT tokens.'
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                username: { type: 'string' },
                email: { type: 'string' },
                role: { type: 'string' },
                fullName: { type: 'string' },
              }
            },
            tokens: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
              }
            },
            expiresIn: { type: 'number' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto, @Request() req: any) {
    const clientIp = RequestUtils.extractClientIp(req);
    
    this.logger.log(`Login attempt for user: ${loginDto.username} from IP: ${RequestUtils.maskIp(clientIp)}`);
    
    const result = await this.authService.login(
      loginDto.username, 
      loginDto.password, 
      clientIp
    );

    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 현재 사용자 프로필 조회
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get current user profile',
    description: 'Get authenticated user profile information.'
  })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() user: User) {
    const { password, ...userProfile } = user;
    
    return {
      success: true,
      data: userProfile,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 프로필 업데이트
   */
  @UseGuards(JwtAuthGuard)
  @Put('profile')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Update user profile',
    description: 'Update authenticated user profile information.'
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(@CurrentUser() user: User, @Body() updateDto: UpdateProfileDto) {
    const updatedUser = await this.authService.updateProfile(user.id, updateDto);
    const { password, ...userProfile } = updatedUser;
    
    this.logger.log(`Profile updated for user: ${user.username}`);
    
    return {
      success: true,
      data: userProfile,
      message: 'Profile updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 비밀번호 변경
   */
  @UseGuards(JwtAuthGuard)
  @Put('password')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Change password',
    description: 'Change authenticated user password.'
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  async changePassword(@CurrentUser() user: User, @Body() changePasswordDto: ChangePasswordDto) {
    await this.authService.changePassword(
      user.id, 
      changePasswordDto.currentPassword, 
      changePasswordDto.newPassword
    );
    
    this.logger.log(`Password changed for user: ${user.username}`);
    
    return {
      success: true,
      message: 'Password changed successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 사용자 생성 (관리자 전용)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('users')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Create new user (Admin only)',
    description: 'Create a new user account. Requires admin role.'
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async createUser(@Body() createUserDto: CreateUserDto, @CurrentUser() currentUser: User) {
    const newUser = await this.authService.createUser(createUserDto);
    const { password, ...userWithoutPassword } = newUser;
    
    this.logger.log(`New user created: ${newUser.username} by admin: ${currentUser.username}`);
    
    return {
      success: true,
      data: userWithoutPassword,
      message: 'User created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 사용자 목록 조회 (관리자 전용)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('users')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get users list (Admin only)',
    description: 'Get paginated list of all users. Requires admin role.'
  })
  @ApiResponse({ status: 200, description: 'Users list retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async getUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const result = await this.authService.getUsers(page, limit);
    
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 토큰 검증 (개발용)
   */
  @UseGuards(JwtAuthGuard)
  @Get('verify')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Verify token',
    description: 'Verify if the current JWT token is valid.'
  })
  @ApiResponse({ status: 200, description: 'Token is valid' })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  async verifyToken(@CurrentUser() user: User) {
    return {
      success: true,
      data: {
        valid: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        }
      },
      timestamp: new Date().toISOString(),
    };
  }
}
