import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { DiscoveryService } from './discovery.service';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class OptionalJwtGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    return user || null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DISCOVERY CONTROLLER - Browse & Search (Public)
// ═══════════════════════════════════════════════════════════════════════════

@ApiTags('Discovery')
@Controller('discover')
export class DiscoveryController {
  constructor(private discoveryService: DiscoveryService) {}

  // ─── GLOBAL SEARCH ──────────────────────────────────────────────────────────

  @Get('search')
  @ApiOperation({
    summary: 'Globale Suche ueber Unternehmen, Jobs, Berufe und Videos',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Suchbegriff',
    example: 'Elektroniker',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Seitennummer (Standard: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Eintraege pro Seite (Standard: 10, Max: 50)',
    example: 10,
  })
  async searchGlobal(
    @Query('q') q: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.discoveryService.searchGlobal(
      q || '',
      parseInt(page ?? '1', 10) || 1,
      parseInt(limit ?? '10', 10) || 10,
    );
  }

  // ─── BROWSE COMPANIES ───────────────────────────────────────────────────────

  @Get('companies')
  @ApiOperation({ summary: 'Unternehmen durchsuchen mit Filtern' })
  @ApiQuery({
    name: 'city',
    required: false,
    description: 'Nach Stadt filtern',
    example: 'Berlin',
  })
  @ApiQuery({
    name: 'industry',
    required: false,
    description: 'Nach Branche filtern',
    example: 'Handwerk',
  })
  @ApiQuery({
    name: 'verified',
    required: false,
    type: Boolean,
    description: 'Nur verifizierte Unternehmen anzeigen',
  })
  @ApiQuery({
    name: 'portalId',
    required: false,
    type: Number,
    description: 'Nach Portal/Bereich filtern',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Seitennummer (Standard: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Eintraege pro Seite (Standard: 10, Max: 50)',
    example: 10,
  })
  async discoverCompanies(
    @Query('city') city?: string,
    @Query('industry') industry?: string,
    @Query('verified') verified?: string,
    @Query('portalId') portalId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.discoveryService.discoverCompanies({
      city: city || undefined,
      industry: industry || undefined,
      verified:
        verified === 'true' ? true : verified === 'false' ? false : undefined,
      portalId: portalId ? parseInt(portalId, 10) || undefined : undefined,
      page: parseInt(page ?? '1', 10) || 1,
      limit: parseInt(limit ?? '10', 10) || 10,
    });
  }

  // ─── BROWSE PROFESSIONS ─────────────────────────────────────────────────────

  @Get('professions')
  @ApiOperation({ summary: 'Ausbildungsberufe durchsuchen mit Filtern' })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Nach Kategorie filtern (z.B. Handwerk, IT, Kaufmaennisch)',
    example: 'Handwerk',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Seitennummer (Standard: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Eintraege pro Seite (Standard: 10, Max: 50)',
    example: 10,
  })
  async discoverProfessions(
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.discoveryService.discoverProfessions({
      category: category || undefined,
      page: parseInt(page ?? '1', 10) || 1,
      limit: parseInt(limit ?? '10', 10) || 10,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FEED JOBS CONTROLLER - Job Feed & Recommendations
// ═══════════════════════════════════════════════════════════════════════════

@ApiTags('Feed')
@Controller('feed')
export class FeedJobsController {
  constructor(private discoveryService: DiscoveryService) {}

  // ─── JOB FEED (PUBLIC) ──────────────────────────────────────────────────────

  @Get('jobs')
  @ApiOperation({ summary: 'Job-Feed abrufen (paginiert, mit optionalen Filtern)' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Seitennummer (Standard: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Eintraege pro Seite (Standard: 10, Max: 50)',
    example: 10,
  })
  @ApiQuery({
    name: 'city',
    required: false,
    description: 'Nach Stadt filtern',
    example: 'Muenchen',
  })
  @ApiQuery({
    name: 'professionId',
    required: false,
    description: 'Nach Berufs-ID filtern (UUID)',
  })
  @ApiQuery({
    name: 'minSalary',
    required: false,
    type: Number,
    description: 'Mindestgehalt 1. Ausbildungsjahr in EUR',
    example: 800,
  })
  @ApiQuery({
    name: 'portalId',
    required: false,
    type: Number,
    description: 'Nach Portal/Bereich filtern',
  })
  async getJobFeed(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('city') city?: string,
    @Query('professionId') professionId?: string,
    @Query('minSalary') minSalary?: string,
    @Query('portalId') portalId?: string,
  ) {
    return this.discoveryService.getJobFeed(
      parseInt(page ?? '1', 10) || 1,
      parseInt(limit ?? '10', 10) || 10,
      {
        city: city || undefined,
        professionId: professionId || undefined,
        minSalary: minSalary ? parseInt(minSalary, 10) || undefined : undefined,
        portalId: portalId ? parseInt(portalId, 10) || undefined : undefined,
      },
    );
  }

  // ─── PERSONALIZED RECOMMENDATIONS (AUTHENTICATED) ──────────────────────────

  @Get('recommendations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Personalisierte Empfehlungen basierend auf Nutzerprofil (Berufe, Interessen, Standort)',
  })
  async getRecommendations(@CurrentUser('userId') userId: string) {
    return this.discoveryService.getRecommendations(userId);
  }

  // ─── APP VIDEO FEED ──────────────────────────────────────────────────────────

  @Get('app')
  @UseGuards(OptionalJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'App Video-Feed abrufen (Video-first mit Jobs und Unternehmen)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'portalId', required: false, type: Number, description: 'Nach Bereich filtern (1-5)' })
  @ApiQuery({ name: 'lat', required: false, type: Number, description: 'Breitengrad' })
  @ApiQuery({ name: 'lng', required: false, type: Number, description: 'Laengengrad' })
  @ApiQuery({ name: 'radiusKm', required: false, type: Number, description: 'Suchradius in km' })
  async getAppFeed(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('portalId') portalId?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.sub || undefined;
    return this.discoveryService.getAppVideoFeed(
      parseInt(page ?? '1', 10) || 1,
      parseInt(limit ?? '10', 10) || 10,
      {
        portalId: portalId ? parseInt(portalId, 10) || undefined : undefined,
        lat: lat ? parseFloat(lat) || undefined : undefined,
        lng: lng ? parseFloat(lng) || undefined : undefined,
        radiusKm: radiusKm ? parseFloat(radiusKm) || undefined : undefined,
      },
      userId,
    );
  }
}
