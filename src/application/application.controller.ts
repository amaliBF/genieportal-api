import {
  Controller, Get, Post, Put, Param, Query, Body, UseGuards,
  UseInterceptors, UploadedFiles, Res,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApplicationService } from './application.service';
import { UpdateApplicationStatusDto, UpdateApplicationNotesDto, UpdateApplicationRatingDto } from './dto/update-application-status.dto';
import { UpdateFormConfigDto } from './dto/update-form-config.dto';

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (kein Auth)
// ═══════════════════════════════════════════════════════════════════════════════

@ApiTags('Public - Bewerbungen')
@SkipThrottle()
@Controller('public/jobs')
export class ApplicationPublicController {
  constructor(private applicationService: ApplicationService) {}

  @Get(':id/application-form')
  @ApiOperation({ summary: 'Bewerbungsformular-Config fuer eine Stelle' })
  async getFormConfig(@Param('id') id: string) {
    return this.applicationService.getFormConfig(id);
  }

  @Post(':id/apply')
  @ApiOperation({ summary: 'Bewerbung einreichen' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('documents', 5, { limits: { fileSize: 5 * 1024 * 1024 } }))
  async apply(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.applicationService.submitApplication(id, body, files || [], 'WEBSITE');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD ROUTES (Auth)
// ═══════════════════════════════════════════════════════════════════════════════

@ApiTags('Dashboard - Bewerbungen')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class ApplicationDashboardController {
  constructor(private applicationService: ApplicationService) {}

  @Get('applications')
  @ApiOperation({ summary: 'Alle Bewerbungen auflisten' })
  async list(
    @CurrentUser('companyId') companyId: string,
    @Query('status') status?: string,
    @Query('jobPostId') jobPostId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.applicationService.listApplications(companyId, {
      status, jobPostId, search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('applications/export')
  @ApiOperation({ summary: 'Bewerbungen als CSV exportieren' })
  async exportApplications(
    @CurrentUser('companyId') companyId: string,
    @Res() res: any,
  ) {
    const csv = await this.applicationService.exportApplications(companyId);
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=bewerbungen-export-${date}.csv`);
    res.send(csv);
  }

  @Get('applications/:id')
  @ApiOperation({ summary: 'Einzelne Bewerbung abrufen' })
  async get(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.applicationService.getApplication(companyId, id);
  }

  @Put('applications/:id/status')
  @ApiOperation({ summary: 'Bewerbungsstatus aendern' })
  async updateStatus(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.applicationService.updateStatus(companyId, id, dto.status);
  }

  @Put('applications/:id/notes')
  @ApiOperation({ summary: 'Interne Notizen aktualisieren' })
  async updateNotes(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationNotesDto,
  ) {
    return this.applicationService.updateNotes(companyId, id, dto.interneNotizen);
  }

  @Put('applications/:id/rating')
  @ApiOperation({ summary: 'Bewertung setzen' })
  async updateRating(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationRatingDto,
  ) {
    return this.applicationService.updateRating(companyId, id, dto.rating);
  }

  @Get('application-form-config')
  @ApiOperation({ summary: 'Formular-Config lesen' })
  async getFormConfig(@CurrentUser('companyId') companyId: string) {
    return this.applicationService.getFormConfigForCompany(companyId);
  }

  @Put('application-form-config')
  @ApiOperation({ summary: 'Formular-Config speichern' })
  async updateFormConfig(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: UpdateFormConfigDto,
  ) {
    return this.applicationService.updateFormConfig(companyId, dto);
  }
}
