import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseFloatPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// =============================================================================
// PUBLIC ROUTES
// =============================================================================

@ApiTags('Jobs (Public)')
@Controller('jobs')
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Get()
  @ApiOperation({ summary: 'Aktive Stellenanzeigen auflisten' })
  @ApiQuery({ name: 'professionId', required: false, description: 'Nach Beruf filtern' })
  @ApiQuery({ name: 'city', required: false, description: 'Nach Stadt filtern' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Seitennummer' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Eintraege pro Seite (max 100)' })
  async findAll(
    @Query('professionId') professionId?: string,
    @Query('city') city?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.jobsService.findPublicJobs({
      professionId,
      city,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Stellenanzeigen in der Naehe finden' })
  @ApiQuery({ name: 'lat', required: true, type: Number, description: 'Breitengrad' })
  @ApiQuery({ name: 'lng', required: true, type: Number, description: 'Laengengrad' })
  @ApiQuery({ name: 'radius', required: true, type: Number, description: 'Suchradius in km' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Seitennummer' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Eintraege pro Seite (max 100)' })
  async findNearby(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('radius', ParseFloatPipe) radius: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.jobsService.findNearby(
      lat,
      lng,
      radius,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einzelne Stellenanzeige abrufen' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  async findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }
}

// =============================================================================
// DASHBOARD ROUTES (Authenticated)
// =============================================================================

@ApiTags('Dashboard - Jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard/jobs')
export class JobsDashboardController {
  constructor(private jobsService: JobsService) {}

  @Get()
  @ApiOperation({ summary: 'Eigene Stellenanzeigen auflisten' })
  async findOwn(@CurrentUser('companyId') companyId: string) {
    return this.jobsService.findByCompany(companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Neue Stellenanzeige erstellen' })
  async create(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateJobDto,
  ) {
    return this.jobsService.create(companyId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einzelne eigene Stellenanzeige abrufen' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  async findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Stellenanzeige aktualisieren' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  async update(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
    @Body() dto: UpdateJobDto,
  ) {
    return this.jobsService.update(id, companyId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Stellenanzeige schliessen' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.jobsService.remove(id, companyId);
  }

  @Put(':id/publish')
  @ApiOperation({ summary: 'Stellenanzeige veroeffentlichen' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  async publish(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.jobsService.publish(id, companyId);
  }

  @Put(':id/pause')
  @ApiOperation({ summary: 'Stellenanzeige pausieren' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  async pause(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.jobsService.pause(id, companyId);
  }
}
