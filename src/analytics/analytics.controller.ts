import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Dashboard - Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard/analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Dashboard-Uebersicht mit Kennzahlen abrufen' })
  async getOverview(@CurrentUser('companyId') companyId: string) {
    return this.analyticsService.getOverview(companyId);
  }

  @Get('views')
  @ApiOperation({ summary: 'Tagesgenaue Aufrufe der letzten N Tage abrufen' })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Anzahl der Tage (Standard: 30)',
  })
  async getViewsAnalytics(
    @CurrentUser('companyId') companyId: string,
    @Query('days') days?: string,
  ) {
    const parsedDays = days ? parseInt(days, 10) : 30;
    const safeDays = parsedDays > 0 && parsedDays <= 365 ? parsedDays : 30;
    return this.analyticsService.getViewsAnalytics(companyId, safeDays);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Performance-Daten pro Stellenanzeige abrufen' })
  async getJobsAnalytics(@CurrentUser('companyId') companyId: string) {
    return this.analyticsService.getJobsAnalytics(companyId);
  }

  @Get('videos')
  @ApiOperation({ summary: 'Performance-Daten pro Video abrufen' })
  async getVideosAnalytics(@CurrentUser('companyId') companyId: string) {
    return this.analyticsService.getVideosAnalytics(companyId);
  }
}
