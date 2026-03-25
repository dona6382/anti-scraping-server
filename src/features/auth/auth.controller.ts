import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';
import { AuthDto, RegisterDto, ChangePasswordDto, RefreshTokenDto } from './dto/auth.dto';
import { JwtAuthGuard, AuthenticatedRequest } from './guards/auth.guards';
import { SkipIpBlacklist } from '../../common/guards/ip-blacklist.guard';
import { SkipUserAgent } from '../../common/guards/user-agent.guard';
import { SkipHeadlessBrowser } from '../../common/guards/headless-browser.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @SkipIpBlacklist()
  @SkipUserAgent()
  @SkipHeadlessBrowser()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async login(@Body() authDto: AuthDto, @Req() req: AuthenticatedRequest) {
    return this.authService.login(authDto, req.ip);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @SkipIpBlacklist()
  @SkipUserAgent()
  @SkipHeadlessBrowser()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @SkipIpBlacklist()
  @SkipUserAgent()
  @SkipHeadlessBrowser()
  @Throttle({ default: { ttl: 300000, limit: 3 } })
  @ApiOperation({ summary: 'User registration' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.authService.changePassword(req.user.id, changePasswordDto);
  }
}
