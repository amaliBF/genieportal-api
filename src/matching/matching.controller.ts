import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { MatchingService } from './matching.service';
import { LikeCompanyDto } from './dto/like-company.dto';
import { LikeJobDto } from './dto/like-job.dto';
import { CompanyLikeUserDto } from './dto/company-like-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// ═══════════════════════════════════════════════════════════════════════════
// USER LIKES CONTROLLER (Mobile App)
// ═══════════════════════════════════════════════════════════════════════════

@ApiTags('Likes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('likes')
export class UserLikesController {
  constructor(private matchingService: MatchingService) {}

  @Post('company/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unternehmen liken' })
  @ApiParam({ name: 'id', description: 'Company ID' })
  @ApiResponse({ status: 200, description: 'Like erfolgreich' })
  @ApiResponse({ status: 409, description: 'Bereits geliked' })
  async likeCompany(
    @CurrentUser('userId') userId: string,
    @Param('id') companyId: string,
    @Body() dto: LikeCompanyDto,
  ) {
    return this.matchingService.userLikeCompany(userId, companyId, dto.source);
  }

  @Delete('company/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Like für Unternehmen entfernen' })
  @ApiParam({ name: 'id', description: 'Company ID' })
  @ApiResponse({ status: 200, description: 'Like entfernt' })
  @ApiResponse({ status: 404, description: 'Like nicht gefunden' })
  async unlikeCompany(
    @CurrentUser('userId') userId: string,
    @Param('id') companyId: string,
  ) {
    await this.matchingService.userUnlikeCompany(userId, companyId);
    return { unliked: true };
  }

  @Post('job/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stellenanzeige liken' })
  @ApiParam({ name: 'id', description: 'JobPost ID' })
  @ApiResponse({ status: 200, description: 'Like erfolgreich' })
  @ApiResponse({ status: 409, description: 'Bereits geliked' })
  async likeJob(
    @CurrentUser('userId') userId: string,
    @Param('id') jobPostId: string,
    @Body() dto: LikeJobDto,
  ) {
    return this.matchingService.userLikeJob(userId, jobPostId, dto.source);
  }

  @Delete('job/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Like für Stellenanzeige entfernen' })
  @ApiParam({ name: 'id', description: 'JobPost ID' })
  @ApiResponse({ status: 200, description: 'Like entfernt' })
  @ApiResponse({ status: 404, description: 'Like nicht gefunden' })
  async unlikeJob(
    @CurrentUser('userId') userId: string,
    @Param('id') jobPostId: string,
  ) {
    await this.matchingService.userUnlikeJob(userId, jobPostId);
    return { unliked: true };
  }

  @Post('video/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Video liken' })
  @ApiParam({ name: 'id', description: 'Video ID' })
  @ApiResponse({ status: 200, description: 'Like erfolgreich' })
  @ApiResponse({ status: 409, description: 'Bereits geliked' })
  async likeVideo(
    @CurrentUser('userId') userId: string,
    @Param('id') videoId: string,
  ) {
    return this.matchingService.userLikeVideo(userId, videoId);
  }

  @Get()
  @ApiOperation({ summary: 'Eigene gelikete Stellen auflisten' })
  @ApiResponse({ status: 200, description: 'Liste der geliketen Stellen mit Match-Status' })
  async getLikedJobs(@CurrentUser('userId') userId: string) {
    return this.matchingService.getUserLikedJobs(userId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// USER MATCHES CONTROLLER (Mobile App)
// ═══════════════════════════════════════════════════════════════════════════

@ApiTags('Matches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('matches')
export class UserMatchesController {
  constructor(private matchingService: MatchingService) {}

  @Get()
  @ApiOperation({ summary: 'Eigene Matches auflisten' })
  @ApiResponse({ status: 200, description: 'Liste der aktiven Matches' })
  async getMatches(@CurrentUser('userId') userId: string) {
    return this.matchingService.getUserMatches(userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Match entfernen / ablehnen' })
  @ApiParam({ name: 'id', description: 'Match ID' })
  @ApiResponse({ status: 200, description: 'Match entfernt' })
  @ApiResponse({ status: 404, description: 'Match nicht gefunden' })
  @ApiResponse({ status: 403, description: 'Kein Zugriff' })
  async deleteMatch(
    @CurrentUser('userId') userId: string,
    @Param('id') matchId: string,
  ) {
    await this.matchingService.deleteMatch(matchId, userId);
    return { deleted: true };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Match-Details abrufen (mit Job, Firma, Chat)' })
  @ApiParam({ name: 'id', description: 'Match ID' })
  @ApiResponse({ status: 200, description: 'Match-Details' })
  @ApiResponse({ status: 404, description: 'Match nicht gefunden' })
  @ApiResponse({ status: 403, description: 'Kein Zugriff' })
  async getMatchDetail(
    @CurrentUser('userId') userId: string,
    @Param('id') matchId: string,
  ) {
    return this.matchingService.getMatchDetail(matchId, userId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD CANDIDATES CONTROLLER (Company Dashboard)
// ═══════════════════════════════════════════════════════════════════════════

@ApiTags('Dashboard - Kandidaten')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard/candidates')
export class DashboardCandidatesController {
  constructor(private matchingService: MatchingService) {}

  @Get()
  @ApiOperation({ summary: 'Kandidaten auflisten (Nutzer die das Unternehmen geliked haben)' })
  @ApiResponse({ status: 200, description: 'Liste der Kandidaten' })
  async getCandidates(@CurrentUser('companyId') companyId: string) {
    return this.matchingService.getCompanyCandidates(companyId);
  }

  @Post(':id/like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kandidat liken (als Unternehmen)' })
  @ApiParam({ name: 'id', description: 'User ID des Kandidaten' })
  @ApiResponse({ status: 200, description: 'Like erfolgreich' })
  @ApiResponse({ status: 409, description: 'Bereits geliked' })
  async likeUser(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') likedById: string,
    @Param('id') userId: string,
    @Body() dto: CompanyLikeUserDto,
  ) {
    return this.matchingService.companyLikeUser(
      companyId,
      userId,
      likedById,
      dto.jobPostId,
      dto.note,
    );
  }

  @Post(':id/pass')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kandidat passen (als Unternehmen)' })
  @ApiParam({ name: 'id', description: 'User ID des Kandidaten' })
  @ApiResponse({ status: 200, description: 'Pass erfolgreich' })
  async passUser(
    @CurrentUser('companyId') companyId: string,
    @Param('id') userId: string,
  ) {
    return this.matchingService.companyPassUser(companyId, userId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD MATCHES CONTROLLER (Company Dashboard)
// ═══════════════════════════════════════════════════════════════════════════

@ApiTags('Dashboard - Matches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard/matches')
export class DashboardMatchesController {
  constructor(private matchingService: MatchingService) {}

  @Get()
  @ApiOperation({ summary: 'Unternehmens-Matches auflisten' })
  @ApiResponse({ status: 200, description: 'Liste der aktiven Matches' })
  async getMatches(@CurrentUser('companyId') companyId: string) {
    return this.matchingService.getCompanyMatches(companyId);
  }
}
