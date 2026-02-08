import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminAuthService } from './admin-auth.service';
import { AdminService } from './admin.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AdminUser } from './decorators/admin-user.decorator';
import { AdminLoginDto, AdminRefreshTokenDto } from './dto/admin-login.dto';
import {
  UpdateUserStatusDto,
  UpdateCompanyStatusDto,
  UpdateVideoStatusDto,
  CreateAdminDto,
} from './dto/update-status.dto';
import { SecurityLogService } from '../common/security/security-log.service';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(
    private adminAuthService: AdminAuthService,
    private adminService: AdminService,
    private securityLog: SecurityLogService,
  ) {}

  // ─── AUTH ─────────────────────────────────────────────────────────────────

  @Post('login')
  @Throttle({
    short: { limit: 2, ttl: 1000 },
    medium: { limit: 5, ttl: 60000 },
    long: { limit: 10, ttl: 900000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin Login' })
  async login(@Body() dto: AdminLoginDto, @Req() req: any) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';

    if (this.securityLog.isBlocked(ip, dto.email)) {
      throw new ForbiddenException(
        'Zu viele fehlgeschlagene Anmeldeversuche. Bitte warten Sie.',
      );
    }

    try {
      const result = await this.adminAuthService.login(dto.email, dto.password);
      this.securityLog.logAdminLoginSuccess(ip, result.admin.id, dto.email);
      return result;
    } catch (error) {
      this.securityLog.logAdminLoginFailed(ip, dto.email);
      throw error;
    }
  }

  @Post('refresh')
  @Throttle({
    short: { limit: 5, ttl: 1000 },
    medium: { limit: 15, ttl: 60000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin Token erneuern' })
  async refresh(@Body() dto: AdminRefreshTokenDto) {
    return this.adminAuthService.refreshTokens(dto.refreshToken);
  }

  // ─── DASHBOARD ────────────────────────────────────────────────────────────

  @Get('dashboard')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin Dashboard Übersicht' })
  async getDashboard() {
    return this.adminService.getDashboard();
  }

  // ─── USERS ────────────────────────────────────────────────────────────────

  @Get('users')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Benutzer auflisten' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  async getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getUsers(page, limit, search, status);
  }

  @Get('users/:id')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Benutzer Detail' })
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Put('users/:id/status')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Benutzer-Status ändern' })
  async updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(id, dto.status);
  }

  // ─── COMPANIES ────────────────────────────────────────────────────────────

  @Get('companies')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unternehmen auflisten' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  async getCompanies(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getCompanies(page, limit, search, status);
  }

  @Get('companies/:id')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unternehmen Detail' })
  async getCompanyDetail(@Param('id') id: string) {
    return this.adminService.getCompanyDetail(id);
  }

  @Put('companies/:id/status')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unternehmen-Status ändern' })
  async updateCompanyStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyStatusDto,
  ) {
    return this.adminService.updateCompanyStatus(id, dto.status);
  }

  @Put('companies/:id/verify')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unternehmen verifizieren' })
  async verifyCompany(@Param('id') id: string) {
    return this.adminService.verifyCompany(id);
  }

  // ─── VIDEOS ───────────────────────────────────────────────────────────────

  @Get('videos')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Videos auflisten (Moderation)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async getVideos(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    return this.adminService.getVideos(page, limit, status);
  }

  @Put('videos/:id/status')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Video-Status ändern (Moderation)' })
  async updateVideoStatus(
    @Param('id') id: string,
    @Body() dto: UpdateVideoStatusDto,
  ) {
    return this.adminService.updateVideoStatus(id, dto.status, dto.moderationNote);
  }

  // ─── EVENTS ───────────────────────────────────────────────────────────────

  @Get('events')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Letzte Events / Aktivitäten' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRecentEvents(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getRecentEvents(page, limit);
  }

  // ─── FINANCE ──────────────────────────────────────────────────────────────

  @Get('finance/overview')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Finanz-Uebersicht (MRR, Umsatz, Abos)' })
  async getFinanceOverview() {
    return this.adminService.getFinanceOverview();
  }

  @Get('finance/payments')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Zahlungen auflisten' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'provider', required: false, type: String })
  async getPayments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('provider') provider?: string,
  ) {
    return this.adminService.getPayments(page, limit, status, provider);
  }

  @Get('finance/subscriptions')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Abonnements auflisten' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'plan', required: false, type: String })
  async getSubscriptions(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('plan') plan?: string,
  ) {
    return this.adminService.getSubscriptions(page, limit, status, plan);
  }

  // ─── ADMIN MANAGEMENT ────────────────────────────────────────────────────

  @Get('admins')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin-Benutzer auflisten' })
  async getAdminUsers() {
    return this.adminService.getAdminUsers();
  }

  @Post('admins')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Neuen Admin erstellen (nur Superadmin)' })
  async createAdmin(
    @Body() dto: CreateAdminDto,
    @AdminUser('role') adminRole: string,
  ) {
    return this.adminAuthService.createAdmin(
      dto.email,
      dto.password,
      dto.name,
      dto.role,
      adminRole,
    );
  }

  @Put('admins/:id')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin-Benutzer bearbeiten' })
  async updateAdminUser(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateAdminUser(id, body);
  }
}
