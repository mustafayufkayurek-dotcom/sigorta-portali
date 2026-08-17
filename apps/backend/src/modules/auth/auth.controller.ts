import { Controller, Post, Body, Get, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { RegisterDto, RefreshTokenDto } from '@sigorta/shared';
import { JwtService } from '@nestjs/jwt';
import { TokenBlacklistService } from './token-blacklist.service';
import {
  clearAuthCookies,
  extractAccessToken,
  extractRefreshToken,
  setAuthCookies,
} from '@/common/auth/auth-cookies';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}

class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @IsNotEmpty()
  newPassword!: string;
}

class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  oldPassword!: string;

  @IsString()
  @IsNotEmpty()
  newPassword!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
    private tokenBlacklistService: TokenBlacklistService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 300000 } })
  @Post('login')
  @ApiOperation({ summary: 'Kullanıcı girişi' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto);
    if (result?.tokens?.accessToken && result?.tokens?.refreshToken) {
      setAuthCookies(request, response, result.tokens);
    }
    return {
      success: true,
      data: result,
    };
  }

  @Post('register')
  @RequirePermissions('user.create')
  @ApiOperation({ summary: 'Yeni kullanıcı kaydı' })
  async register(@Body() registerDto: RegisterDto) {
    const result = await this.authService.register(registerDto);
    return {
      success: true,
      data: result,
    };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 300000 } })
  @Post('refresh')
  @ApiOperation({ summary: 'Token yenileme' })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = extractRefreshToken(request, refreshTokenDto?.refreshToken);
    if (!refreshToken) {
      throw new UnauthorizedException('Token bulunamadı');
    }
    const tokens = await this.authService.refresh(refreshToken);
    setAuthCookies(request, response, tokens);
    return {
      success: true,
      data: tokens,
    };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 300000 } })
  @Post('forgot-password')
  @ApiOperation({ summary: 'Şifre sıfırlama talebi' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const result = await this.authService.forgotPassword(dto.email);
    return {
      success: true,
      data: result,
      message: 'Eğer bu e-posta sistemde kayıtlıysa şifre sıfırlama bağlantısı gönderilecektir.',
    };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 300000 } })
  @Post('reset-password')
  @ApiOperation({ summary: 'Şifre sıfırla' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return {
      success: true,
      message: 'Şifreniz başarıyla güncellendi',
    };
  }

  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({ summary: 'Çıkış yap' })
  async logout(
    @CurrentUser() user: any,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: { refreshToken?: string },
  ) {
    const token = extractAccessToken(request) || '';
    if (token) {
      const decoded = this.jwtService.decode(token) as { exp?: number } | null;
      const now = Math.floor(Date.now() / 1000);
      const ttl = decoded?.exp ? decoded.exp - now : 0;
      if (ttl > 0) {
        await this.tokenBlacklistService.blacklist(token, ttl);
      }
    }
    const refreshToken = extractRefreshToken(request, body?.refreshToken);
    if (refreshToken) {
      await this.authService.logout(user.id, refreshToken);
    }
    clearAuthCookies(request, response);
    return {
      success: true,
      message: 'Çıkış yapıldı',
    };
  }

  @ApiBearerAuth()
  @Post('change-password')
  @ApiOperation({ summary: 'Oturum açıkken şifre değiştir' })
  async changePassword(
    @CurrentUser() user: any,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user.id, dto.oldPassword, dto.newPassword);
    const userData = await this.authService.getMe(user.id);
    return {
      success: true,
      message: 'Şifreniz başarıyla güncellendi',
      data: userData,
    };
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Mevcut kullanıcı bilgisi' })
  async getMe(@CurrentUser() user: any) {
    const userData = await this.authService.getMe(user.id);
    return {
      success: true,
      data: userData,
    };
  }
}
