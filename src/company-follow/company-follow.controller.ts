import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CompanyFollowService } from './company-follow.service';

@ApiTags('User - Firmen folgen')
@Controller('api')
export class CompanyFollowController {
  constructor(private readonly companyFollowService: CompanyFollowService) {}

  // ─── Public ──────────────────────────────────────────────────────────────────

  @Get('public/companies/:companyId/followers/count')
  @ApiOperation({ summary: 'Follower-Anzahl eines Unternehmens' })
  getFollowerCount(@Param('companyId') companyId: string) {
    return this.companyFollowService.getFollowerCount(companyId);
  }

  // ─── User (mit Login) ───────────────────────────────────────────────────────

  @Post('user/companies/:companyId/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unternehmen folgen' })
  follow(@CurrentUser('id') userId: string, @Param('companyId') companyId: string) {
    return this.companyFollowService.follow(userId, companyId);
  }

  @Delete('user/companies/:companyId/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unternehmen entfolgen' })
  unfollow(@CurrentUser('id') userId: string, @Param('companyId') companyId: string) {
    return this.companyFollowService.unfollow(userId, companyId);
  }

  @Post('user/companies/:companyId/follow/notify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Benachrichtigung für Unternehmen ein/ausschalten' })
  toggleNotify(
    @CurrentUser('id') userId: string,
    @Param('companyId') companyId: string,
    @Body('notify') notify: boolean,
  ) {
    return this.companyFollowService.toggleNotify(userId, companyId, notify);
  }

  @Get('user/companies/:companyId/following')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Prüfen ob User Unternehmen folgt' })
  isFollowing(@CurrentUser('id') userId: string, @Param('companyId') companyId: string) {
    return this.companyFollowService.isFollowing(userId, companyId);
  }

  @Get('user/following')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Alle gefolgten Unternehmen' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getFollowing(
    @CurrentUser('id') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.companyFollowService.getFollowing(userId, page, limit);
  }

  // ─── Dashboard (Firma sieht ihre Follower) ──────────────────────────────────

  @Get('dashboard/followers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follower der eigenen Firma' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getFollowers(
    @CurrentUser('companyId') companyId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.companyFollowService.getFollowers(companyId, page, limit);
  }
}
