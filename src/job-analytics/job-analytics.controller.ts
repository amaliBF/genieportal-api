import {
  Controller, Get, Post, Param, Query, Body, UseGuards, Req, DefaultValuePipe, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JobAnalyticsService } from './job-analytics.service';

@ApiTags('Analytics')
@Controller('api')
export class JobAnalyticsController {
  constructor(private readonly jobAnalyticsService: JobAnalyticsService) {}

  @Post('public/jobs/:jobPostId/view')
  @ApiOperation({ summary: 'Stellen-Aufruf tracken (öffentlich)' })
  trackView(@Param('jobPostId') jobPostId: string, @Req() req: any, @Body() body: any) {
    const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    return this.jobAnalyticsService.trackView(jobPostId, {
      userId: body.userId,
      source: body.source,
      sessionId: body.sessionId,
      ip,
      userAgent: req.headers['user-agent'],
      referer: req.headers['referer'],
    });
  }

  @Post('public/jobs/:jobPostId/click')
  @ApiOperation({ summary: 'Stellen-Klick tracken (öffentlich)' })
  trackClick(@Param('jobPostId') jobPostId: string, @Body() body: any) {
    return this.jobAnalyticsService.trackClick(jobPostId, {
      userId: body.userId,
      clickType: body.clickType || 'APPLY_BUTTON',
      sessionId: body.sessionId,
    });
  }

  @Get('dashboard/analytics/jobs/:jobPostId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Analytics für eine Stelle' })
  @ApiQuery({ name: 'days', required: false })
  getJobAnalytics(
    @CurrentUser('companyId') companyId: string,
    @Param('jobPostId') jobPostId: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.jobAnalyticsService.getJobAnalytics(companyId, jobPostId, days);
  }

  @Get('dashboard/analytics/overview')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Firmen-Analytics Überblick' })
  @ApiQuery({ name: 'days', required: false })
  getCompanyAnalytics(
    @CurrentUser('companyId') companyId: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.jobAnalyticsService.getCompanyAnalytics(companyId, days);
  }
}
