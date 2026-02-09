import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JobAnalyticsService {
  private readonly logger = new Logger(JobAnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  async trackView(jobPostId: string, data: { userId?: string; source?: string; sessionId?: string; ip?: string; userAgent?: string; referer?: string }) {
    const job = await this.prisma.jobPost.findUnique({
      where: { id: jobPostId },
      select: { companyId: true },
    });
    if (!job) return;

    await this.prisma.jobPostView.create({
      data: {
        jobPostId,
        companyId: job.companyId,
        userId: data.userId,
        source: (data.source as any) || 'WEBSITE_SOURCE',
        sessionId: data.sessionId,
        ip: data.ip,
        userAgent: data.userAgent,
        referer: data.referer,
      },
    });

    // Increment counter
    await this.prisma.jobPost.update({
      where: { id: jobPostId },
      data: { viewCount: { increment: 1 } },
    });
  }

  async trackClick(jobPostId: string, data: { userId?: string; clickType: string; sessionId?: string }) {
    const job = await this.prisma.jobPost.findUnique({
      where: { id: jobPostId },
      select: { companyId: true },
    });
    if (!job) return;

    await this.prisma.jobPostClick.create({
      data: {
        jobPostId,
        companyId: job.companyId,
        userId: data.userId,
        clickType: data.clickType as any,
        sessionId: data.sessionId,
      },
    });
  }

  async getJobAnalytics(companyId: string, jobPostId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [views, clicks, viewsBySource, viewsByDay] = await Promise.all([
      this.prisma.jobPostView.count({ where: { jobPostId, companyId, createdAt: { gte: since } } }),
      this.prisma.jobPostClick.count({ where: { jobPostId, companyId, createdAt: { gte: since } } }),
      this.prisma.jobPostView.groupBy({
        by: ['source'],
        where: { jobPostId, companyId, createdAt: { gte: since } },
        _count: true,
      }),
      this.prisma.$queryRawUnsafe(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM job_post_views
        WHERE job_post_id = ? AND company_id = ? AND created_at >= ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, jobPostId, companyId, since),
    ]);

    return {
      views,
      clicks,
      ctr: views > 0 ? Math.round((clicks / views) * 100 * 10) / 10 : 0,
      viewsBySource: viewsBySource.map((v) => ({ source: v.source, count: v._count })),
      viewsByDay,
    };
  }

  async getCompanyAnalytics(companyId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalViews, totalClicks, topJobs] = await Promise.all([
      this.prisma.jobPostView.count({ where: { companyId, createdAt: { gte: since } } }),
      this.prisma.jobPostClick.count({ where: { companyId, createdAt: { gte: since } } }),
      this.prisma.jobPostView.groupBy({
        by: ['jobPostId'],
        where: { companyId, createdAt: { gte: since } },
        _count: true,
        orderBy: { _count: { jobPostId: 'desc' } },
        take: 10,
      }),
    ]);

    // Fetch job titles for top jobs
    const jobIds = topJobs.map((j) => j.jobPostId);
    const jobs = await this.prisma.jobPost.findMany({
      where: { id: { in: jobIds } },
      select: { id: true, title: true },
    });
    const jobMap = new Map(jobs.map((j) => [j.id, j.title]));

    return {
      totalViews,
      totalClicks,
      ctr: totalViews > 0 ? Math.round((totalClicks / totalViews) * 100 * 10) / 10 : 0,
      topJobs: topJobs.map((j) => ({
        jobPostId: j.jobPostId,
        title: jobMap.get(j.jobPostId) || 'Unbekannt',
        views: j._count,
      })),
    };
  }
}
