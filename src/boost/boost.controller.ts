import {
  Controller, Get, Post, Delete, Param, Query, Body, UseGuards, DefaultValuePipe, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BoostService } from './boost.service';

@ApiTags('Dashboard - Boost')
@Controller('api')
export class BoostController {
  constructor(private readonly boostService: BoostService) {}

  @Get('public/jobs/boosted')
  @ApiOperation({ summary: 'Gesponserte Stellen (öffentlich)' })
  getBoostedJobs(@Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number) {
    return this.boostService.getBoostedJobs(limit);
  }

  @Post('dashboard/jobs/:jobPostId/boost')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Stelle boosten' })
  createBoost(
    @CurrentUser('companyId') companyId: string,
    @Param('jobPostId') jobPostId: string,
    @Body('type') type: string,
    @Body('weeks') weeks: number,
  ) {
    return this.boostService.createBoost(companyId, jobPostId, type || 'BOOST', weeks || 1);
  }

  @Get('dashboard/boosts/active')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Aktive Boosts' })
  getActiveBoosts(@CurrentUser('companyId') companyId: string) {
    return this.boostService.getActiveBoosts(companyId);
  }

  @Get('dashboard/boosts/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Boost-Verlauf' })
  getBoostHistory(
    @CurrentUser('companyId') companyId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.boostService.getBoostHistory(companyId, page, limit);
  }

  @Delete('dashboard/boosts/:boostId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Boost stornieren' })
  cancelBoost(@CurrentUser('companyId') companyId: string, @Param('boostId') boostId: string) {
    return this.boostService.cancelBoost(companyId, boostId);
  }
}
