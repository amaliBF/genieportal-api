import {
  Controller,
  Get,
  Param,
  Query,
  Header,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Response } from 'express';
import { PublicJobsService } from './public-jobs.service';

@ApiTags('Public Jobs (Website)')
@Controller('public/jobs')
export class PublicJobsController {
  constructor(private publicJobsService: PublicJobsService) {}

  // ─── 1. SEARCH ────────────────────────────────────────────────────────────

  @Get('search')
  @ApiOperation({ summary: 'Stellen suchen mit Filtern, Geo & Facetten' })
  @ApiQuery({ name: 'q', required: false, description: 'Suchbegriff' })
  @ApiQuery({ name: 'portal_id', required: false, type: Number })
  @ApiQuery({ name: 'lat', required: false, type: Number })
  @ApiQuery({ name: 'lng', required: false, type: Number })
  @ApiQuery({ name: 'radius_km', required: false, type: Number })
  @ApiQuery({ name: 'berufsfeld', required: false })
  @ApiQuery({ name: 'stadt', required: false })
  @ApiQuery({ name: 'has_video', required: false, type: Boolean })
  @ApiQuery({ name: 'sort', required: false, enum: ['relevance', 'date', 'distance', 'salary'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async search(
    @Query('q') q?: string,
    @Query('portal_id') portalId?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radius_km') radiusKm?: string,
    @Query('berufsfeld') berufsfeld?: string,
    @Query('stadt') stadt?: string,
    @Query('has_video') hasVideo?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.publicJobsService.search({
      q,
      portalId: portalId ? parseInt(portalId, 10) : undefined,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
      radiusKm: radiusKm ? parseFloat(radiusKm) : undefined,
      berufsfeld,
      stadt,
      hasVideo: hasVideo === 'true',
      sort,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ─── 2. AUTOCOMPLETE ──────────────────────────────────────────────────────

  @Get('autocomplete')
  @ApiOperation({ summary: 'Suchvorschlaege waehrend Tippen' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'portal_id', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async autocomplete(
    @Query('q') q: string,
    @Query('portal_id') portalId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.publicJobsService.autocomplete(
      q,
      portalId ? parseInt(portalId, 10) : undefined,
      limit ? parseInt(limit, 10) : 5,
    );
  }

  // ─── 3. STATS ─────────────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Statistiken fuer Homepage (Counts, Top Cities/Professions)' })
  @ApiQuery({ name: 'portal_id', required: false, type: Number })
  async stats(@Query('portal_id') portalId?: string) {
    return this.publicJobsService.getStats(
      portalId ? parseInt(portalId, 10) : undefined,
    );
  }

  // ─── 4. LATEST ────────────────────────────────────────────────────────────

  @Get('latest')
  @ApiOperation({ summary: 'Neueste Stellen fuer Homepage-Carousel' })
  @ApiQuery({ name: 'portal_id', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async latest(
    @Query('portal_id') portalId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.publicJobsService.getLatest(
      portalId ? parseInt(portalId, 10) : undefined,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  // ─── 5. SITEMAP DATA ─────────────────────────────────────────────────────

  @Get('sitemap')
  @ApiOperation({ summary: 'Sitemap-Daten fuer dynamische Sitemap-Generierung' })
  @ApiQuery({ name: 'portal_id', required: false, type: Number })
  async sitemap(@Query('portal_id') portalId?: string) {
    return this.publicJobsService.getSitemapData(
      portalId ? parseInt(portalId, 10) : undefined,
    );
  }

  // ─── 6. BY CITY ───────────────────────────────────────────────────────────

  @Get('by-city/:city')
  @ApiOperation({ summary: 'Alle Stellen in einer Stadt' })
  @ApiParam({ name: 'city', description: 'Stadt-Slug (z.B. muenchen)' })
  @ApiQuery({ name: 'portal_id', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async byCity(
    @Param('city') city: string,
    @Query('portal_id') portalId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.publicJobsService.byCity(
      city,
      portalId ? parseInt(portalId, 10) : undefined,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  // ─── 7. BY PROFESSION ─────────────────────────────────────────────────────

  @Get('by-profession/:profession')
  @ApiOperation({ summary: 'Alle Stellen fuer einen Beruf' })
  @ApiParam({ name: 'profession', description: 'Berufs-Slug (z.B. elektroniker)' })
  @ApiQuery({ name: 'portal_id', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async byProfession(
    @Param('profession') profession: string,
    @Query('portal_id') portalId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.publicJobsService.byProfession(
      profession,
      portalId ? parseInt(portalId, 10) : undefined,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  // ─── 8. JOB DETAIL ────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Vollstaendige Stellendetails fuer SEO-Seite' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  async detail(@Param('id') id: string) {
    return this.publicJobsService.getDetail(id);
  }

  // ─── 9. SCHEMA.ORG JSON-LD ────────────────────────────────────────────────

  @Get(':id/schema')
  @ApiOperation({ summary: 'Google for Jobs Schema.org JSON-LD' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  async schema(@Param('id') id: string) {
    return this.publicJobsService.getSchema(id);
  }
}
