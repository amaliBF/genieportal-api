import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { SsoService } from './sso.service';
import { SsoJwtGuard } from './sso-jwt.guard';
import { SsoRegisterDto } from './dto/sso-register.dto';
import { SsoLoginDto } from './dto/sso-login.dto';
import {
  SsoForgotPasswordDto,
  SsoResetPasswordDto,
} from './dto/sso-reset-password.dto';
import { SsoUpdateProfileDto } from './dto/sso-update-profile.dto';

@Controller('sso')
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  // ─── REGISTER ───────────────────────────────────────────────────────────────

  @Post('register')
  @Throttle({ short: { limit: 5, ttl: 900000 } })
  async register(
    @Body() dto: SsoRegisterDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.ssoService.register(dto);
    this.setCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  // ─── LOGIN ──────────────────────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 900000 } })
  async login(
    @Body() dto: SsoLoginDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.ssoService.login(dto);
    this.setCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  // ─── LOGOUT ─────────────────────────────────────────────────────────────────

  @Post('logout')
  @UseGuards(SsoJwtGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const refreshToken = req.cookies?.genie_refresh_token;
    await this.ssoService.logout(req.user.userId, refreshToken);
    this.clearCookies(res);
    return { message: 'Erfolgreich abgemeldet.' };
  }

  // ─── REFRESH ────────────────────────────────────────────────────────────────

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const refreshToken = req.cookies?.genie_refresh_token;
    const result = await this.ssoService.refresh(refreshToken);
    this.setCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  // ─── FORGOT PASSWORD ───────────────────────────────────────────────────────

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 3, ttl: 900000 } })
  async forgotPassword(@Body() dto: SsoForgotPasswordDto) {
    await this.ssoService.forgotPassword(dto.email);
    return {
      message:
        'Falls ein Konto mit dieser E-Mail existiert, wurde eine E-Mail zum Zurücksetzen gesendet.',
    };
  }

  // ─── RESET PASSWORD ────────────────────────────────────────────────────────

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: SsoResetPasswordDto) {
    await this.ssoService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Passwort erfolgreich geändert.' };
  }

  // ─── VERIFY EMAIL ──────────────────────────────────────────────────────────

  @Get('verify-email/:token')
  async verifyEmail(
    @Param('token') token: string,
    @Res() res: any,
  ) {
    const result = await this.ssoService.verifyEmail(token);
    const domain = result.domain || 'genieportal.de';
    const redirectUrl = `https://${domain}?verified=1`;
    return res.redirect(redirectUrl);
  }

  // ─── GET ME ─────────────────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(SsoJwtGuard)
  async getMe(@Req() req: any) {
    return this.ssoService.getMe(req.user.userId);
  }

  // ─── UPDATE PROFILE ─────────────────────────────────────────────────────────

  @Patch('me')
  @UseGuards(SsoJwtGuard)
  async updateProfile(@Req() req: any, @Body() dto: SsoUpdateProfileDto) {
    return this.ssoService.updateProfile(req.user.userId, dto);
  }

  // ─── DELETE ACCOUNT ─────────────────────────────────────────────────────────

  @Delete('me')
  @UseGuards(SsoJwtGuard)
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    await this.ssoService.deleteAccount(req.user.userId);
    this.clearCookies(res);
    return { message: 'Konto erfolgreich gelöscht.' };
  }

  // ─── COOKIE HELPERS ─────────────────────────────────────────────────────────

  private setCookies(res: any, accessToken: string, refreshToken: string) {
    const cookieBase = {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      path: '/',
    };

    res.cookie('genie_access_token', accessToken, {
      ...cookieBase,
      maxAge: 15 * 60 * 1000, // 15 min
    });

    res.cookie('genie_refresh_token', refreshToken, {
      ...cookieBase,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Non-httpOnly cookie for frontend to check login state
    res.cookie('genie_logged_in', '1', {
      httpOnly: false,
      secure: true,
      sameSite: 'none' as const,
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  private clearCookies(res: any) {
    const clearOpts = {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      path: '/',
    };

    res.clearCookie('genie_access_token', clearOpts);
    res.clearCookie('genie_refresh_token', clearOpts);
    res.clearCookie('genie_logged_in', {
      ...clearOpts,
      httpOnly: false,
    });
  }
}
