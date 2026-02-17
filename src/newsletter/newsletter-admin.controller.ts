import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/guards/admin-auth.guard';
import { NewsletterAdminService } from './newsletter-admin.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/create-campaign.dto';

@ApiTags('Admin - Newsletter')
@Controller('admin/newsletter')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class NewsletterAdminController {
  constructor(private readonly newsletterAdmin: NewsletterAdminService) {}

  // ─── SUBSCRIBERS ────────────────────────────────────────────────────────────

  @Get('subscribers')
  @ApiOperation({ summary: 'Newsletter-Abonnenten auflisten' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'domain', required: false, type: String })
  @ApiQuery({ name: 'isVerified', required: false, type: String })
  getSubscribers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('domain') domain?: string,
    @Query('isVerified') isVerified?: string,
  ) {
    return this.newsletterAdmin.getSubscribers(
      page,
      limit,
      search,
      domain,
      isVerified,
    );
  }

  @Get('subscribers/stats')
  @ApiOperation({ summary: 'Newsletter-Statistiken' })
  getSubscriberStats() {
    return this.newsletterAdmin.getSubscriberStats();
  }

  // ─── CAMPAIGNS ──────────────────────────────────────────────────────────────

  @Get('campaigns')
  @ApiOperation({ summary: 'Newsletter-Kampagnen auflisten' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getCampaigns(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.newsletterAdmin.getCampaigns(page, limit);
  }

  @Post('campaigns')
  @ApiOperation({ summary: 'Neue Newsletter-Kampagne erstellen' })
  createCampaign(@Body() dto: CreateCampaignDto) {
    return this.newsletterAdmin.createCampaign(dto);
  }

  @Get('campaigns/:id')
  @ApiOperation({ summary: 'Newsletter-Kampagne Detail' })
  getCampaign(@Param('id') id: string) {
    return this.newsletterAdmin.getCampaign(id);
  }

  @Put('campaigns/:id')
  @ApiOperation({ summary: 'Newsletter-Kampagne bearbeiten' })
  updateCampaign(@Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.newsletterAdmin.updateCampaign(id, dto);
  }

  @Post('campaigns/:id/send')
  @ApiOperation({ summary: 'Newsletter-Kampagne versenden' })
  sendCampaign(@Param('id') id: string) {
    return this.newsletterAdmin.sendCampaign(id);
  }
}
