import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // ─── OVERVIEW ──────────────────────────────────────────────────────────────

  async getOverview(companyId: string) {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      totalJobPosts,
      totalVideos,
      totalMatches,
      totalCandidates,
      newMatchesThisWeek,
      newCandidatesThisWeek,
      jobViewsAggregate,
      videoViewsAggregate,
    ] = await Promise.all([
      // Active job posts
      this.prisma.jobPost.count({
        where: { companyId, status: 'ACTIVE' },
      }),

      // Active videos
      this.prisma.video.count({
        where: { companyId, status: 'ACTIVE' },
      }),

      // Active matches
      this.prisma.match.count({
        where: { companyId, status: 'ACTIVE' },
      }),

      // Unique candidates: users who liked the company directly OR liked its job posts
      this.prisma.like.findMany({
        where: {
          OR: [
            { companyId },
            { jobPost: { companyId } },
          ],
        },
        select: { userId: true },
        distinct: ['userId'],
      }),

      // New matches this week
      this.prisma.match.count({
        where: {
          companyId,
          status: 'ACTIVE',
          matchedAt: { gte: weekAgo },
        },
      }),

      // New candidates this week
      this.prisma.like.findMany({
        where: {
          OR: [
            { companyId },
            { jobPost: { companyId } },
          ],
          createdAt: { gte: weekAgo },
        },
        select: { userId: true },
        distinct: ['userId'],
      }),

      // Sum of job post views
      this.prisma.jobPost.aggregate({
        where: { companyId },
        _sum: { viewCount: true },
      }),

      // Sum of video views
      this.prisma.video.aggregate({
        where: { companyId },
        _sum: { viewCount: true },
      }),
    ]);

    const totalViews =
      (jobViewsAggregate._sum.viewCount ?? 0) +
      (videoViewsAggregate._sum.viewCount ?? 0);

    return {
      totalJobPosts,
      totalVideos,
      totalMatches,
      totalCandidates: totalCandidates.length,
      newMatchesThisWeek,
      newCandidatesThisWeek: newCandidatesThisWeek.length,
      totalViews,
    };
  }

  // ─── VIEWS ANALYTICS ──────────────────────────────────────────────────────

  async getViewsAnalytics(companyId: string, days: number = 30) {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Try event-based analytics first
    const eventCount = await this.prisma.event.count({
      where: {
        eventType: { in: ['profile_view', 'job_view', 'video_view'] },
        createdAt: { gte: startDate },
        OR: [
          { companyId },
          {
            properties: {
              path: 'companyId' as any,
              equals: companyId,
            },
          },
        ],
      },
    });

    if (eventCount > 0) {
      return this.getViewsFromEvents(companyId, days, startDate);
    }

    // Fallback: return aggregate totals distributed across the date range
    return this.getViewsFallback(companyId, days, startDate);
  }

  private async getViewsFromEvents(
    companyId: string,
    days: number,
    startDate: Date,
  ) {
    const events = await this.prisma.event.findMany({
      where: {
        eventType: { in: ['profile_view', 'job_view', 'video_view'] },
        createdAt: { gte: startDate },
        OR: [
          { companyId },
          {
            properties: {
              path: 'companyId' as any,
              equals: companyId,
            },
          },
        ],
      },
      select: {
        eventType: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build a map of date -> counts
    const dateMap = new Map<
      string,
      { profileViews: number; jobViews: number; videoViews: number }
    >();

    // Initialize all dates
    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const key = date.toISOString().split('T')[0];
      dateMap.set(key, { profileViews: 0, jobViews: 0, videoViews: 0 });
    }

    // Populate from events
    for (const event of events) {
      const key = event.createdAt.toISOString().split('T')[0];
      const entry = dateMap.get(key);
      if (entry) {
        if (event.eventType === 'profile_view') {
          entry.profileViews++;
        } else if (event.eventType === 'job_view') {
          entry.jobViews++;
        } else if (event.eventType === 'video_view') {
          entry.videoViews++;
        }
      }
    }

    return Array.from(dateMap.entries()).map(([date, counts]) => ({
      date,
      ...counts,
    }));
  }

  private async getViewsFallback(
    companyId: string,
    days: number,
    startDate: Date,
  ) {
    // When no events exist, return zeroed-out daily entries
    const result: Array<{
      date: string;
      profileViews: number;
      jobViews: number;
      videoViews: number;
    }> = [];

    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      result.push({
        date: date.toISOString().split('T')[0],
        profileViews: 0,
        jobViews: 0,
        videoViews: 0,
      });
    }

    return result;
  }

  // ─── JOBS ANALYTICS ────────────────────────────────────────────────────────

  async getJobsAnalytics(companyId: string) {
    const jobs = await this.prisma.jobPost.findMany({
      where: { companyId },
      select: {
        id: true,
        title: true,
        status: true,
        viewCount: true,
        likeCount: true,
        matchCount: true,
        publishedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return jobs;
  }

  // ─── VIDEOS ANALYTICS ─────────────────────────────────────────────────────

  async getVideosAnalytics(companyId: string) {
    const videos = await this.prisma.video.findMany({
      where: { companyId },
      select: {
        id: true,
        title: true,
        status: true,
        viewCount: true,
        likeCount: true,
        shareCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return videos;
  }
}
