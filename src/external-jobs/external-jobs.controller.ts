import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExternalJobsService } from './external-jobs.service';

@ApiTags('Admin - External Jobs')
@Controller('admin/external-jobs')
export class ExternalJobsController {
  constructor(private readonly externalJobsService: ExternalJobsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'External jobs statistics' })
  async getStats() {
    return this.externalJobsService.getStats();
  }

  @Post('trigger-import')
  @ApiOperation({ summary: 'Manually trigger external job import' })
  async triggerImport() {
    return this.externalJobsService.triggerImport();
  }
}
