import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UploadService } from '../upload/upload.service';
import { PrismaService } from '../prisma/prisma.service';

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════════════════

@ApiTags('Companies (Public)')
@Controller('companies')
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Öffentliches Firmenprofil abrufen' })
  @ApiParam({ name: 'id', description: 'Company ID' })
  async getPublicProfile(@Param('id') id: string) {
    return this.companiesService.getPublicProfile(id);
  }

  @Get(':id/videos')
  @ApiOperation({ summary: 'Videos eines Unternehmens abrufen' })
  @ApiParam({ name: 'id', description: 'Company ID' })
  async getCompanyVideos(@Param('id') id: string) {
    return this.companiesService.getCompanyVideos(id);
  }

  @Get(':id/jobs')
  @ApiOperation({ summary: 'Stellenanzeigen eines Unternehmens abrufen' })
  @ApiParam({ name: 'id', description: 'Company ID' })
  async getCompanyJobs(@Param('id') id: string) {
    return this.companiesService.getCompanyJobs(id);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD ROUTES (Authenticated)
// ═══════════════════════════════════════════════════════════════════════════

@ApiTags('Dashboard - Company')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard/company')
export class CompanyDashboardController {
  constructor(
    private companiesService: CompaniesService,
    private uploadService: UploadService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Eigenes Firmenprofil abrufen' })
  async getOwnProfile(@CurrentUser('userId') companyUserId: string) {
    return this.companiesService.getOwnProfile(companyUserId);
  }

  @Put()
  @ApiOperation({ summary: 'Firmenprofil aktualisieren' })
  async updateProfile(
    @CurrentUser('userId') companyUserId: string,
    @CurrentUser('companyId') companyId: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.updateProfile(companyId, companyUserId, dto);
  }

  @Put('logo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Firmenlogo hochladen' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async uploadLogo(
    @CurrentUser('companyId') companyId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    this.uploadService.validateImage(file);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (company?.logoUrl) {
      await this.uploadService.deleteFile(company.logoUrl);
    }
    const logoUrl = await this.uploadService.saveFile(file, 'logos', companyId);
    await this.prisma.company.update({
      where: { id: companyId },
      data: { logoUrl },
    });
    return { logoUrl };
  }
}
