import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BoostService {
  private readonly logger = new Logger(BoostService.name);

  constructor(private prisma: PrismaService) {}

  async createBoost(companyId: string, jobPostId: string, type: string, weeks: number) {
    const job = await this.prisma.jobPost.findFirst({
      where: { id: jobPostId, companyId },
    });
    if (!job) throw new NotFoundException('Stelle nicht gefunden.');

    const pricePerWeek = type === 'SPOTLIGHT' ? 99 : 29;
    const totalPrice = pricePerWeek * weeks;

    const startDate = new Date();
    const endDate = new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000);

    const boost = await this.prisma.jobBoost.create({
      data: {
        jobPostId,
        companyId,
        type: type as any,
        status: 'BOOST_ACTIVE',
        pricePerWeek,
        totalPrice,
        currency: 'EUR',
        startDate,
        endDate,
      },
    });

    return boost;
  }

  async getActiveBoosts(companyId: string) {
    return this.prisma.jobBoost.findMany({
      where: { companyId, status: 'BOOST_ACTIVE' },
      include: {
        jobPost: { select: { id: true, title: true, slug: true, status: true } },
      },
      orderBy: { endDate: 'asc' },
    });
  }

  async getBoostHistory(companyId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [boosts, total] = await Promise.all([
      this.prisma.jobBoost.findMany({
        where: { companyId },
        include: { jobPost: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.jobBoost.count({ where: { companyId } }),
    ]);
    return { data: boosts, total, page, totalPages: Math.ceil(total / limit) };
  }

  async cancelBoost(companyId: string, boostId: string) {
    const boost = await this.prisma.jobBoost.findFirst({
      where: { id: boostId, companyId, status: 'BOOST_ACTIVE' },
    });
    if (!boost) throw new NotFoundException('Aktiver Boost nicht gefunden.');

    return this.prisma.jobBoost.update({
      where: { id: boostId },
      data: { status: 'BOOST_CANCELLED' },
    });
  }

  async trackImpression(boostId: string) {
    await this.prisma.jobBoost.update({
      where: { id: boostId },
      data: { impressions: { increment: 1 } },
    });
  }

  async trackClick(boostId: string) {
    await this.prisma.jobBoost.update({
      where: { id: boostId },
      data: { clicks: { increment: 1 } },
    });
  }

  async getBoostedJobs(limit = 5) {
    return this.prisma.jobBoost.findMany({
      where: { status: 'BOOST_ACTIVE', endDate: { gte: new Date() } },
      include: {
        jobPost: {
          include: {
            company: { select: { name: true, slug: true, logoUrl: true, city: true } },
          },
        },
      },
      orderBy: [{ type: 'desc' }, { createdAt: 'asc' }],
      take: limit,
    });
  }

  @Cron('0 0 * * *')
  async expireBoosts() {
    const result = await this.prisma.jobBoost.updateMany({
      where: { status: 'BOOST_ACTIVE', endDate: { lt: new Date() } },
      data: { status: 'BOOST_EXPIRED' },
    });
    if (result.count > 0) {
      this.logger.log(`${result.count} Boosts abgelaufen.`);
    }
  }
}
