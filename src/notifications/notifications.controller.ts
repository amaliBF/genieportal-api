import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// =============================================================================
// USER NOTIFICATIONS (Mobile App)
// =============================================================================

@ApiTags('Benachrichtigungen')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Benachrichtigungen auflisten' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Seitennummer (Standard: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Eintraege pro Seite (Standard: 20, max 100)' })
  @ApiResponse({ status: 200, description: 'Paginierte Liste der Benachrichtigungen' })
  async findAll(
    @CurrentUser('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getUserNotifications(
      userId,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Anzahl ungelesener Benachrichtigungen abrufen' })
  @ApiResponse({ status: 200, description: 'Anzahl ungelesener Benachrichtigungen' })
  async getUnreadCount(@CurrentUser('userId') userId: string) {
    return this.notificationsService.getUnreadCount(userId, 'user');
  }

  @Put('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Alle Benachrichtigungen als gelesen markieren' })
  @ApiResponse({ status: 200, description: 'Alle Benachrichtigungen als gelesen markiert' })
  async markAllAsRead(@CurrentUser('userId') userId: string) {
    return this.notificationsService.markAllAsRead(userId, 'user');
  }

  @Put(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Benachrichtigung als gelesen markieren' })
  @ApiParam({ name: 'id', description: 'Benachrichtigungs-ID' })
  @ApiResponse({ status: 200, description: 'Benachrichtigung als gelesen markiert' })
  @ApiResponse({ status: 404, description: 'Benachrichtigung nicht gefunden' })
  @ApiResponse({ status: 403, description: 'Zugriff verweigert' })
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.notificationsService.markAsRead(id, userId, 'user');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Benachrichtigung loeschen' })
  @ApiParam({ name: 'id', description: 'Benachrichtigungs-ID' })
  @ApiResponse({ status: 200, description: 'Benachrichtigung geloescht' })
  @ApiResponse({ status: 404, description: 'Benachrichtigung nicht gefunden' })
  @ApiResponse({ status: 403, description: 'Zugriff verweigert' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.notificationsService.deleteNotification(id, userId, 'user');
  }
}

// =============================================================================
// DASHBOARD NOTIFICATIONS (Company Users)
// =============================================================================

@ApiTags('Dashboard - Benachrichtigungen')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard/notifications')
export class DashboardNotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Benachrichtigungen auflisten (Dashboard)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Seitennummer (Standard: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Eintraege pro Seite (Standard: 20, max 100)' })
  @ApiResponse({ status: 200, description: 'Paginierte Liste der Benachrichtigungen' })
  async findAll(
    @CurrentUser('userId') companyUserId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getCompanyNotifications(
      companyUserId,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Anzahl ungelesener Benachrichtigungen abrufen (Dashboard)' })
  @ApiResponse({ status: 200, description: 'Anzahl ungelesener Benachrichtigungen' })
  async getUnreadCount(@CurrentUser('userId') companyUserId: string) {
    return this.notificationsService.getUnreadCount(companyUserId, 'company');
  }

  @Put('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Alle Benachrichtigungen als gelesen markieren (Dashboard)' })
  @ApiResponse({ status: 200, description: 'Alle Benachrichtigungen als gelesen markiert' })
  async markAllAsRead(@CurrentUser('userId') companyUserId: string) {
    return this.notificationsService.markAllAsRead(companyUserId, 'company');
  }

  @Put(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Benachrichtigung als gelesen markieren (Dashboard)' })
  @ApiParam({ name: 'id', description: 'Benachrichtigungs-ID' })
  @ApiResponse({ status: 200, description: 'Benachrichtigung als gelesen markiert' })
  @ApiResponse({ status: 404, description: 'Benachrichtigung nicht gefunden' })
  @ApiResponse({ status: 403, description: 'Zugriff verweigert' })
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser('userId') companyUserId: string,
  ) {
    return this.notificationsService.markAsRead(id, companyUserId, 'company');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Benachrichtigung loeschen (Dashboard)' })
  @ApiParam({ name: 'id', description: 'Benachrichtigungs-ID' })
  @ApiResponse({ status: 200, description: 'Benachrichtigung geloescht' })
  @ApiResponse({ status: 404, description: 'Benachrichtigung nicht gefunden' })
  @ApiResponse({ status: 403, description: 'Zugriff verweigert' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('userId') companyUserId: string,
  ) {
    return this.notificationsService.deleteNotification(id, companyUserId, 'company');
  }
}
