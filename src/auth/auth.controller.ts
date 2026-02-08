import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { AccountType } from './dto/signup.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SecurityLogService } from '../common/security/security-log.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private securityLog: SecurityLogService,
  ) {}

  @Post('signup')
  @Throttle({
    short: { limit: 3, ttl: 1000 },
    medium: { limit: 5, ttl: 60000 },
    long: { limit: 10, ttl: 900000 },
  })
  @ApiOperation({ summary: 'Registrierung (User oder Company)' })
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  @Throttle({
    short: { limit: 3, ttl: 1000 },
    medium: { limit: 10, ttl: 60000 },
    long: { limit: 20, ttl: 900000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login' })
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';

    // Check if IP/email is blocked due to too many failed attempts
    if (this.securityLog.isBlocked(ip, dto.email)) {
      throw new ForbiddenException(
        'Zu viele fehlgeschlagene Anmeldeversuche. Bitte warten Sie 15 Minuten.',
      );
    }

    try {
      const result = await this.authService.login(dto);
      this.securityLog.recordSuccessfulLogin(
        ip,
        dto.email,
        result.user.id,
        dto.accountType || 'user',
      );
      return result;
    } catch (error) {
      this.securityLog.recordFailedLogin(ip, dto.email);
      throw error;
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout' })
  async logout(
    @CurrentUser('userId') userId: string,
    @CurrentUser('type') type: string,
  ) {
    return this.authService.logout(userId, type);
  }

  @Post('refresh')
  @Throttle({
    short: { limit: 5, ttl: 1000 },
    medium: { limit: 20, ttl: 60000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Token erneuern' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('forgot-password')
  @Throttle({
    short: { limit: 1, ttl: 1000 },
    medium: { limit: 3, ttl: 60000 },
    long: { limit: 5, ttl: 900000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Passwort vergessen' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email, dto.accountType ?? AccountType.USER);
  }

  @Post('reset-password')
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 5, ttl: 60000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Passwort zurücksetzen' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Post('verify-email')
  @Throttle({
    short: { limit: 3, ttl: 1000 },
    medium: { limit: 10, ttl: 60000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'E-Mail verifizieren' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @Throttle({
    short: { limit: 1, ttl: 1000 },
    medium: { limit: 3, ttl: 3600000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verifizierungs-E-Mail erneut senden (max 3/Stunde)' })
  async resendVerification(@Body('email') email: string) {
    return this.authService.resendVerification(email);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @SkipThrottle()
  @ApiOperation({ summary: 'Aktueller Benutzer' })
  async getMe(
    @CurrentUser('userId') userId: string,
    @CurrentUser('type') type: string,
  ) {
    return this.authService.getMe(userId, type);
  }
}
