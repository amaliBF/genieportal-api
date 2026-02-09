import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TalentPoolService } from './talent-pool.service';

@ApiTags('Dashboard - Talent-Pool')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('api/dashboard/talent-pool')
export class TalentPoolController {
  constructor(private readonly talentPoolService: TalentPoolService) {}

  @Post(':userId')
  @ApiOperation({ summary: 'Kandidat zum Talent-Pool hinzufügen' })
  add(@CurrentUser('companyId') companyId: string, @Param('userId') userId: string, @Body() body: any) {
    return this.talentPoolService.addToPool(companyId, userId, body);
  }

  @Get()
  @ApiOperation({ summary: 'Talent-Pool abrufen' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  getPool(
    @CurrentUser('companyId') companyId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.talentPoolService.getPool(companyId, page, limit, search);
  }

  @Put(':talentId')
  @ApiOperation({ summary: 'Talent-Pool Eintrag bearbeiten' })
  update(@CurrentUser('companyId') companyId: string, @Param('talentId') talentId: string, @Body() body: any) {
    return this.talentPoolService.updateTalent(companyId, talentId, body);
  }

  @Delete(':talentId')
  @ApiOperation({ summary: 'Aus Talent-Pool entfernen' })
  remove(@CurrentUser('companyId') companyId: string, @Param('talentId') talentId: string) {
    return this.talentPoolService.removeFromPool(companyId, talentId);
  }
}
