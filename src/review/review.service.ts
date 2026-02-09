import { Injectable, Logger, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(private prisma: PrismaService) {}

  // ─── PUBLIC ──────────────────────────────────────────────────────────────────

  async getCompanyReviews(companyId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.companyReview.findMany({
        where: { companyId, status: 'APPROVED' },
        include: {
          user: { select: { firstName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.companyReview.count({ where: { companyId, status: 'APPROVED' } }),
    ]);

    // Anonymize where needed
    const data = reviews.map((r) => ({
      ...r,
      user: r.isAnonymous ? { firstName: 'Anonym', avatarUrl: null } : r.user,
    }));

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getCompanyRatingSummary(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { reviewCount: true, reviewAverage: true, recommendPercent: true },
    });

    if (!company) throw new NotFoundException('Unternehmen nicht gefunden.');

    const ratingDistribution = await this.prisma.companyReview.groupBy({
      by: ['overallRating'],
      where: { companyId, status: 'APPROVED' },
      _count: true,
    });

    return {
      ...company,
      ratingDistribution: ratingDistribution.map((r) => ({
        rating: r.overallRating,
        count: r._count,
      })),
    };
  }

  // ─── USER ───────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateReviewDto) {
    const existing = await this.prisma.companyReview.findUnique({
      where: { companyId_userId: { companyId: dto.companyId, userId } },
    });

    if (existing) {
      throw new ConflictException('Du hast dieses Unternehmen bereits bewertet.');
    }

    const review = await this.prisma.companyReview.create({
      data: {
        companyId: dto.companyId,
        userId,
        overallRating: dto.overallRating,
        cultureRating: dto.cultureRating,
        tasksRating: dto.tasksRating,
        supervisorRating: dto.supervisorRating,
        salaryRating: dto.salaryRating,
        title: dto.title,
        pros: dto.pros,
        cons: dto.cons,
        reviewerType: dto.reviewerType as any,
        department: dto.department,
        isAnonymous: dto.isAnonymous ?? true,
        wouldRecommend: dto.wouldRecommend ?? true,
        status: 'REVIEW_PENDING',
      },
    });

    return review;
  }

  async markHelpful(userId: string, reviewId: string) {
    const review = await this.prisma.companyReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Bewertung nicht gefunden.');

    const existing = await this.prisma.reviewHelpful.findUnique({
      where: { reviewId_userId: { reviewId, userId } },
    });

    if (existing) {
      // Toggle off
      await this.prisma.$transaction([
        this.prisma.reviewHelpful.delete({ where: { reviewId_userId: { reviewId, userId } } }),
        this.prisma.companyReview.update({
          where: { id: reviewId },
          data: { helpfulCount: { decrement: 1 } },
        }),
      ]);
      return { helpful: false };
    }

    await this.prisma.$transaction([
      this.prisma.reviewHelpful.create({ data: { reviewId, userId } }),
      this.prisma.companyReview.update({
        where: { id: reviewId },
        data: { helpfulCount: { increment: 1 } },
      }),
    ]);

    return { helpful: true };
  }

  // ─── DASHBOARD (Firma antwortet) ─────────────────────────────────────────────

  async respondToReview(companyId: string, reviewId: string, response: string) {
    const review = await this.prisma.companyReview.findFirst({
      where: { id: reviewId, companyId },
    });

    if (!review) throw new NotFoundException('Bewertung nicht gefunden.');

    return this.prisma.companyReview.update({
      where: { id: reviewId },
      data: { companyResponse: response, companyRespondedAt: new Date() },
    });
  }

  // ─── ADMIN (Moderation) ──────────────────────────────────────────────────────

  async adminList(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;

    const [reviews, total] = await Promise.all([
      this.prisma.companyReview.findMany({
        where,
        include: {
          company: { select: { name: true } },
          user: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.companyReview.count({ where }),
    ]);

    return { data: reviews, total, page, totalPages: Math.ceil(total / limit) };
  }

  async adminModerate(reviewId: string, status: string, moderationNote?: string) {
    const review = await this.prisma.companyReview.findUnique({
      where: { id: reviewId },
      include: { company: true },
    });

    if (!review) throw new NotFoundException('Bewertung nicht gefunden.');

    const updated = await this.prisma.companyReview.update({
      where: { id: reviewId },
      data: { status: status as any, moderationNote },
    });

    // Update company aggregate if approved
    if (status === 'APPROVED') {
      await this.updateCompanyAggregates(review.companyId);
    }

    return updated;
  }

  private async updateCompanyAggregates(companyId: string) {
    const stats = await this.prisma.companyReview.aggregate({
      where: { companyId, status: 'APPROVED' },
      _avg: { overallRating: true },
      _count: true,
    });

    const recommendCount = await this.prisma.companyReview.count({
      where: { companyId, status: 'APPROVED', wouldRecommend: true },
    });

    const total = stats._count;
    const avg = stats._avg.overallRating || 0;
    const recommendPercent = total > 0 ? Math.round((recommendCount / total) * 100) : 0;

    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        reviewCount: total,
        reviewAverage: avg,
        recommendPercent,
      },
    });
  }
}
