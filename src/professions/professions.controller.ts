import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ProfessionsService } from './professions.service';

@ApiTags('Professions')
@Controller('professions')
export class ProfessionsController {
  constructor(private professionsService: ProfessionsService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Ausbildungsberufe auflisten' })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Nach Kategorie filtern (z.B. Handwerk, IT, Kaufmännisch)',
  })
  async findAll(@Query('category') category?: string) {
    return this.professionsService.findAll(category);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Alle Berufskategorien abrufen' })
  async getCategories() {
    return this.professionsService.getCategories();
  }

  @Get('search')
  @ApiOperation({ summary: 'Berufe suchen' })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Suchbegriff (Name des Berufs)',
  })
  async search(@Query('q') query: string) {
    return this.professionsService.search(query || '');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einzelnen Beruf abrufen' })
  @ApiParam({ name: 'id', description: 'Berufs-ID (UUID)' })
  async findOne(@Param('id') id: string) {
    return this.professionsService.findOne(id);
  }

  @Get(':id/videos')
  @ApiOperation({ summary: 'Videos zu einem Beruf abrufen' })
  @ApiParam({ name: 'id', description: 'Berufs-ID (UUID)' })
  async getVideos(@Param('id') id: string) {
    return this.professionsService.getVideosByProfession(id);
  }

  @Get(':id/jobs')
  @ApiOperation({ summary: 'Stellenanzeigen zu einem Beruf abrufen' })
  @ApiParam({ name: 'id', description: 'Berufs-ID (UUID)' })
  async getJobs(@Param('id') id: string) {
    return this.professionsService.getJobsByProfession(id);
  }
}
