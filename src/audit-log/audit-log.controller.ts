import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { AuditLogService } from './audit-log.service';
import { AdminAuthGuard } from '../admin/guards/admin-auth.guard';

@ApiTags('Admin - Audit Log')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin/audit-logs')
export class AuditLogController {
  constructor(private auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'Audit-Log abrufen' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'adminUserId', required: false })
  @ApiQuery({ name: 'portalId', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'action', required: false })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('adminUserId') adminUserId?: string,
    @Query('portalId') portalId?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
  ) {
    return this.auditLogService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      adminUserId,
      portalId: portalId ? parseInt(portalId, 10) : undefined,
      entityType,
      action,
    });
  }
}
