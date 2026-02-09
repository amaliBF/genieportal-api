import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PortalService } from './portal.service';
import { AdminAuthGuard } from '../admin/guards/admin-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES - Portale/Bereiche
// ═══════════════════════════════════════════════════════════════════════════

@ApiTags('Portale (Public)')
@Controller('portals')
export class PublicPortalController {
  constructor(private portalService: PortalService) {}

  @Get()
  @ApiOperation({ summary: 'Verfuegbare Portale/Bereiche auflisten' })
  async listPortals() {
    return this.portalService.findAllPublic();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES - Portale
// ═══════════════════════════════════════════════════════════════════════════

@ApiTags('Admin - Portale')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin/portals')
export class PortalController {
  constructor(private portalService: PortalService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Portale abrufen' })
  async findAll() {
    return this.portalService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Portal-Details abrufen' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.portalService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Portal aktualisieren' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status?: string; description?: string },
  ) {
    return this.portalService.update(id, body);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD ROUTES - Aktive Portale (Authenticated)
// ═══════════════════════════════════════════════════════════════════════════

@ApiTags('Dashboard - Portale')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard/portals')
export class DashboardPortalController {
  constructor(private portalService: PortalService) {}

  @Get('active')
  @ApiOperation({ summary: 'Aktive LIVE-Portale fuer Portal-Auswahl' })
  async getActivePortals() {
    return this.portalService.findAllPublic();
  }
}
