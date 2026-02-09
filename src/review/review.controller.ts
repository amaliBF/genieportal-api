import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../admin/guards/admin-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';

@ApiTags('Bewertungen')
@Controller('api')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  // ─── Public ──────────────────────────────────────────────────────────────────

  @Get('public/companies/:companyId/reviews')
  @ApiOperation({ summary: 'Bewertungen eines Unternehmens (öffentlich)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getCompanyReviews(
    @Param('companyId') companyId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.reviewService.getCompanyReviews(companyId, page, limit);
  }

  @Get('public/companies/:companyId/rating')
  @ApiOperation({ summary: 'Bewertungszusammenfassung eines Unternehmens' })
  getCompanyRating(@Param('companyId') companyId: string) {
    return this.reviewService.getCompanyRatingSummary(companyId);
  }

  // ─── User ───────────────────────────────────────────────────────────────────

  @Post('user/reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bewertung abgeben' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateReviewDto) {
    return this.reviewService.create(userId, dto);
  }

  @Post('user/reviews/:reviewId/helpful')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bewertung als hilfreich markieren (Toggle)' })
  markHelpful(@CurrentUser('id') userId: string, @Param('reviewId') reviewId: string) {
    return this.reviewService.markHelpful(userId, reviewId);
  }

  // ─── Dashboard (Firma antwortet) ─────────────────────────────────────────────

  @Put('dashboard/reviews/:reviewId/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Auf Bewertung antworten (Firma)' })
  respond(
    @CurrentUser('companyId') companyId: string,
    @Param('reviewId') reviewId: string,
    @Body('response') response: string,
  ) {
    return this.reviewService.respondToReview(companyId, reviewId, response);
  }

  // ─── Admin ──────────────────────────────────────────────────────────────────

  @Get('admin/reviews')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Alle Bewertungen (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  adminList(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    return this.reviewService.adminList(page, limit, status);
  }

  @Put('admin/reviews/:reviewId/moderate')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bewertung moderieren (Admin)' })
  adminModerate(
    @Param('reviewId') reviewId: string,
    @Body('status') status: string,
    @Body('moderationNote') moderationNote?: string,
  ) {
    return this.reviewService.adminModerate(reviewId, status, moderationNote);
  }
}
