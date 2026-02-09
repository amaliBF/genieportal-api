import {
  Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiCompany } from './decorators/api-company.decorator';
import { PublicApiService } from './public-api.service';
import { CreateApiJobDto } from './dto/create-api-job.dto';
import { UpdateApplicationStatusDto } from '../application/dto/update-application-status.dto';

@ApiTags('API (API-Key Auth)')
@ApiBearerAuth()
@SkipThrottle()
@UseGuards(ApiKeyGuard)
@Controller('api')
export class PublicApiController {
  constructor(private publicApiService: PublicApiService) {}

  // ─── Jobs ─────────────────────────────────────────────────────────────────

  @Get('jobs')
  @ApiOperation({ summary: 'Stellen auflisten' })
  async listJobs(
    @ApiCompany('companyId') companyId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.publicApiService.listJobs(
      companyId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status,
    );
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Einzelne Stelle' })
  async getJob(@ApiCompany('companyId') companyId: string, @Param('id') id: string) {
    return this.publicApiService.getJob(companyId, id);
  }

  @Post('jobs')
  @ApiOperation({ summary: 'Stelle erstellen' })
  async createJob(@ApiCompany('companyId') companyId: string, @Body() dto: CreateApiJobDto) {
    return this.publicApiService.createJob(companyId, dto);
  }

  @Put('jobs/:id')
  @ApiOperation({ summary: 'Stelle aktualisieren' })
  async updateJob(
    @ApiCompany('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: CreateApiJobDto,
  ) {
    return this.publicApiService.updateJob(companyId, id, dto);
  }

  @Delete('jobs/:id')
  @ApiOperation({ summary: 'Stelle loeschen' })
  async deleteJob(@ApiCompany('companyId') companyId: string, @Param('id') id: string) {
    return this.publicApiService.deleteJob(companyId, id);
  }

  // ─── Applications ─────────────────────────────────────────────────────────

  @Get('applications')
  @ApiOperation({ summary: 'Bewerbungen auflisten' })
  async listApplications(
    @ApiCompany('companyId') companyId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.publicApiService.listApplications(
      companyId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('applications/:id')
  @ApiOperation({ summary: 'Einzelne Bewerbung' })
  async getApplication(@ApiCompany('companyId') companyId: string, @Param('id') id: string) {
    return this.publicApiService.getApplication(companyId, id);
  }

  @Put('applications/:id/status')
  @ApiOperation({ summary: 'Bewerbungsstatus aendern' })
  async updateApplicationStatus(
    @ApiCompany('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.publicApiService.updateApplicationStatus(companyId, id, dto.status);
  }

  // ─── Company ──────────────────────────────────────────────────────────────

  @Get('company')
  @ApiOperation({ summary: 'Firmenprofil' })
  async getCompany(@ApiCompany('companyId') companyId: string) {
    return this.publicApiService.getCompany(companyId);
  }

  // ─── Webhooks ────────────────────────────────────────────────────────────

  @Get('webhooks')
  @ApiOperation({ summary: 'Webhooks auflisten' })
  async listWebhooks(@ApiCompany('companyId') companyId: string) {
    return this.publicApiService.listWebhooks(companyId);
  }

  @Post('webhooks')
  @ApiOperation({ summary: 'Webhook erstellen' })
  async createWebhook(
    @ApiCompany('companyId') companyId: string,
    @Body() body: { url: string; events: string[] },
  ) {
    return this.publicApiService.createWebhook(companyId, body);
  }

  @Put('webhooks/:id')
  @ApiOperation({ summary: 'Webhook aktualisieren' })
  async updateWebhook(
    @ApiCompany('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: { url?: string; events?: string[]; isActive?: boolean },
  ) {
    return this.publicApiService.updateWebhook(companyId, id, body);
  }

  @Delete('webhooks/:id')
  @ApiOperation({ summary: 'Webhook loeschen' })
  async deleteWebhook(@ApiCompany('companyId') companyId: string, @Param('id') id: string) {
    return this.publicApiService.deleteWebhook(companyId, id);
  }
}
