import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { PublicCompaniesService } from './public-companies.service';

@ApiTags('Public Companies (Website)')
@Controller('public/companies')
export class PublicCompaniesController {
  constructor(private publicCompaniesService: PublicCompaniesService) {}

  // ─── 1. LIST / SEARCH ──────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Firmenverzeichnis mit Filtern' })
  @ApiQuery({ name: 'q', required: false, description: 'Suchbegriff (Name, Branche)' })
  @ApiQuery({ name: 'portal_id', required: false, type: Number })
  @ApiQuery({ name: 'city', required: false, description: 'Stadt filtern' })
  @ApiQuery({ name: 'industry', required: false, description: 'Branche filtern' })
  @ApiQuery({ name: 'has_jobs', required: false, type: Boolean })
  @ApiQuery({ name: 'verified', required: false, type: Boolean })
  @ApiQuery({ name: 'sort', required: false, enum: ['name', 'jobs', 'rating', 'newest'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async list(
    @Query('q') q?: string,
    @Query('portal_id') portalId?: string,
    @Query('city') city?: string,
    @Query('industry') industry?: string,
    @Query('has_jobs') hasJobs?: string,
    @Query('verified') verified?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.publicCompaniesService.list({
      q,
      portalId: portalId ? parseInt(portalId, 10) : undefined,
      city,
      industry,
      hasJobs: hasJobs === 'true',
      verified: verified === 'true' ? true : undefined,
      sort,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ─── 2. STATS ──────────────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Firmen-Statistiken (Anzahl, Top-Branchen, Top-Staedte)' })
  @ApiQuery({ name: 'portal_id', required: false, type: Number })
  async stats(@Query('portal_id') portalId?: string) {
    return this.publicCompaniesService.getStats(
      portalId ? parseInt(portalId, 10) : undefined,
    );
  }

  // ─── 3. DETAIL BY SLUG ─────────────────────────────────────────────────────

  @Get(':slug')
  @ApiOperation({ summary: 'Firmenprofil per Slug abrufen' })
  @ApiParam({ name: 'slug', description: 'Company Slug' })
  async detail(@Param('slug') slug: string) {
    return this.publicCompaniesService.getBySlug(slug);
  }

  // ─── 4. COMPANY JOBS ───────────────────────────────────────────────────────

  @Get(':slug/jobs')
  @ApiOperation({ summary: 'Offene Stellen eines Unternehmens' })
  @ApiParam({ name: 'slug', description: 'Company Slug' })
  @ApiQuery({ name: 'portal_id', required: false, type: Number })
  async jobs(
    @Param('slug') slug: string,
    @Query('portal_id') portalId?: string,
  ) {
    return this.publicCompaniesService.getCompanyJobs(
      slug,
      portalId ? parseInt(portalId, 10) : undefined,
    );
  }

  // ─── 5. COMPANY REVIEWS ────────────────────────────────────────────────────

  @Get(':slug/reviews')
  @ApiOperation({ summary: 'Bewertungen eines Unternehmens per Slug' })
  @ApiParam({ name: 'slug', description: 'Company Slug' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async reviews(
    @Param('slug') slug: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.publicCompaniesService.getCompanyReviews(
      slug,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }
}
