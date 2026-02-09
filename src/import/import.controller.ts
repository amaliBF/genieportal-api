import {
  Controller, Get, Post, Param, Query, Body, UseGuards,
  UseInterceptors, UploadedFile, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ImportService } from './import.service';
import { ConfirmImportDto } from './dto/confirm-import.dto';

@ApiTags('Dashboard - Import/Export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard/jobs')
export class ImportController {
  constructor(private importService: ImportService) {}

  @Post('import')
  @ApiOperation({ summary: 'CSV hochladen und Vorschau erhalten' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadCSV(
    @CurrentUser('companyId') companyId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new Error('Keine Datei hochgeladen');
    return this.importService.parseCSV(companyId, file);
  }

  @Post('import/process')
  @ApiOperation({ summary: 'CSV hochladen und direkt importieren' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadAndImport(
    @CurrentUser('companyId') companyId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ConfirmImportDto,
  ) {
    if (!file) throw new Error('Keine Datei hochgeladen');
    return this.importService.uploadAndImport(
      companyId, file, dto.columnMapping, dto.mode, dto.publishImmediately, dto.showOnWebsite,
    );
  }

  @Get('import/:id')
  @ApiOperation({ summary: 'Import-Status abfragen' })
  async getImportStatus(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.importService.getImportStatus(companyId, id);
  }

  @Get('imports')
  @ApiOperation({ summary: 'Import-Historie' })
  async getImportHistory(@CurrentUser('companyId') companyId: string) {
    return this.importService.getImportHistory(companyId);
  }

  @Get('export')
  @ApiOperation({ summary: 'Stellen exportieren (CSV/JSON)' })
  async exportJobs(
    @CurrentUser('companyId') companyId: string,
    @Query('format') format: string = 'csv',
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Res() res?: any,
  ) {
    const statusFilter = status ? status.split(',') : undefined;
    const result = await this.importService.exportJobs(companyId, format, statusFilter, dateFrom, dateTo);

    if (format === 'json') {
      res.json(result);
      return;
    }

    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=stellen-export-${date}.csv`);
    res.send(result);
  }

  @Get('export/template')
  @ApiOperation({ summary: 'CSV-Template herunterladen' })
  async getTemplate(@Res() res: any) {
    const csv = this.importService.getTemplate();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=stellen-import-vorlage.csv');
    res.send(csv);
  }
}
