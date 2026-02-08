import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DiscoveryService {
  constructor(private prisma: PrismaService) {}

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  private paginate(page: number, limit: number) {
    const p = Math.max(1, page || 1);
    const l = Math.min(50, Math.max(1, limit || 10));
    return { page: p, limit: l, skip: (p - 1) * l };
  }

  private paginationMeta(total: number, page: number, limit: number) {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL SEARCH
  // ═══════════════════════════════════════════════════════════════════════════

  async searchGlobal(query: string, page: number, limit: number) {
    const { page: p, limit: l, skip } = this.paginate(page, limit);

    const trimmed = (query || '').trim();
    if (!trimmed) {
      return {
        data: { companies: [], jobs: [], professions: [], videos: [] },
        pagination: this.paginationMeta(0, p, l),
      };
    }

    // Run all four searches in parallel
    const [companies, jobs, professions, videos] = await Promise.all([
      this.prisma.company.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { name: { contains: trimmed } },
            { industry: { contains: trimmed } },
            { shortDescription: { contains: trimmed } },
            { city: { contains: trimmed } },
          ],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          city: true,
          industry: true,
          shortDescription: true,
          verified: true,
        },
        orderBy: { name: 'asc' },
        skip,
        take: l,
      }),

      this.prisma.jobPost.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { title: { contains: trimmed } },
            { description: { contains: trimmed } },
            { city: { contains: trimmed } },
          ],
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              city: true,
            },
          },
          profession: {
            select: {
              id: true,
              name: true,
              slug: true,
              category: true,
            },
          },
        },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: l,
      }),

      this.prisma.profession.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: trimmed } },
            { category: { contains: trimmed } },
            { shortDescription: { contains: trimmed } },
          ],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          shortDescription: true,
          iconUrl: true,
          imageUrl: true,
        },
        orderBy: { name: 'asc' },
        skip,
        take: l,
      }),

      this.prisma.video.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { title: { contains: trimmed } },
            { description: { contains: trimmed } },
          ],
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              city: true,
            },
          },
          profession: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
        },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: l,
      }),
    ]);

    // Total is the aggregate count across all entity types
    const total = companies.length + jobs.length + professions.length + videos.length;

    return {
      data: { companies, jobs, professions, videos },
      pagination: this.paginationMeta(total, p, l),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DISCOVER COMPANIES
  // ═══════════════════════════════════════════════════════════════════════════

  async discoverCompanies(filters: {
    city?: string;
    industry?: string;
    verified?: boolean;
    portalId?: number;
    page: number;
    limit: number;
  }) {
    const { page, limit, skip } = this.paginate(filters.page, filters.limit);

    const where: any = { status: 'ACTIVE' };

    if (filters.city) {
      where.city = { contains: filters.city };
    }

    if (filters.industry) {
      where.industry = { contains: filters.industry };
    }

    if (filters.verified !== undefined) {
      where.verified = filters.verified;
    }

    if (filters.portalId) {
      where.portalId = filters.portalId;
    }

    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          coverImageUrl: true,
          city: true,
          postalCode: true,
          industry: true,
          shortDescription: true,
          employeeCount: true,
          verified: true,
          trainingSince: true,
          totalApprentices: true,
          _count: {
            select: {
              jobPosts: {
                where: { status: 'ACTIVE' },
              },
              videos: {
                where: { status: 'ACTIVE' },
              },
            },
          },
        },
        orderBy: [{ verified: 'desc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      data,
      pagination: this.paginationMeta(total, page, limit),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DISCOVER PROFESSIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async discoverProfessions(filters: {
    category?: string;
    page: number;
    limit: number;
  }) {
    const { page, limit, skip } = this.paginate(filters.page, filters.limit);

    const where: any = { isActive: true };

    if (filters.category) {
      where.category = { contains: filters.category };
    }

    const [data, total] = await Promise.all([
      this.prisma.profession.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          subcategory: true,
          shortDescription: true,
          durationMonths: true,
          salaryYear1: true,
          salaryYear2: true,
          salaryYear3: true,
          iconUrl: true,
          imageUrl: true,
          _count: {
            select: {
              jobPosts: {
                where: { status: 'ACTIVE' },
              },
              videos: {
                where: { status: 'ACTIVE' },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.profession.count({ where }),
    ]);

    return {
      data,
      pagination: this.paginationMeta(total, page, limit),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // JOB FEED
  // ═══════════════════════════════════════════════════════════════════════════

  async getJobFeed(
    page: number,
    limit: number,
    filters?: { city?: string; professionId?: string; minSalary?: number; portalId?: number },
  ) {
    const { page: p, limit: l, skip } = this.paginate(page, limit);

    const where: any = { status: 'ACTIVE' };

    if (filters?.city) {
      where.city = { contains: filters.city };
    }

    if (filters?.professionId) {
      where.professionId = filters.professionId;
    }

    if (filters?.minSalary) {
      where.salaryYear1 = { gte: filters.minSalary };
    }

    if (filters?.portalId) {
      where.portalId = filters.portalId;
    }

    const [data, total] = await Promise.all([
      this.prisma.jobPost.findMany({
        where,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              city: true,
              industry: true,
              verified: true,
            },
          },
          profession: {
            select: {
              id: true,
              name: true,
              slug: true,
              category: true,
              iconUrl: true,
            },
          },
        },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: l,
      }),
      this.prisma.jobPost.count({ where }),
    ]);

    return {
      data,
      pagination: this.paginationMeta(total, p, l),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSONALIZED RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async getRecommendations(userId: string) {
    // Fetch the user's profile to determine preferences
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        preferredProfessions: true,
        interests: true,
        city: true,
        postalCode: true,
        maxDistanceKm: true,
        latitude: true,
        longitude: true,
      },
    });

    if (!user) {
      return { data: { jobs: [], companies: [] } };
    }

    // Parse JSON fields safely
    const preferredProfessions = this.parseJsonArray(user.preferredProfessions);
    const interests = this.parseJsonArray(user.interests);

    // ── Build job query based on user preferences ────────────────────────

    const jobWhere: any = { status: 'ACTIVE' };

    // If user has preferred professions, prefer matching jobs
    // We use a two-pass approach: first try to find matching, then fill with general
    const professionIds = preferredProfessions.filter(
      (p: any) => typeof p === 'string' && p.length > 0,
    );

    if (professionIds.length > 0) {
      jobWhere.professionId = { in: professionIds };
    }

    // If user has a city, prefer jobs in the same city
    if (user.city) {
      jobWhere.city = { contains: user.city };
    }

    // Fetch matching jobs (up to 10)
    let recommendedJobs = await this.prisma.jobPost.findMany({
      where: jobWhere,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            city: true,
            industry: true,
            verified: true,
          },
        },
        profession: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
            iconUrl: true,
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 10,
    });

    // If not enough results with strict filters, relax and backfill
    if (recommendedJobs.length < 10) {
      const existingIds = recommendedJobs.map((j) => j.id);
      const backfillWhere: any = {
        status: 'ACTIVE',
        id: { notIn: existingIds },
      };

      // Keep city preference if available, but drop profession filter
      if (user.city) {
        backfillWhere.city = { contains: user.city };
      }

      const backfill = await this.prisma.jobPost.findMany({
        where: backfillWhere,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              city: true,
              industry: true,
              verified: true,
            },
          },
          profession: {
            select: {
              id: true,
              name: true,
              slug: true,
              category: true,
              iconUrl: true,
            },
          },
        },
        orderBy: { publishedAt: 'desc' },
        take: 10 - recommendedJobs.length,
      });

      recommendedJobs = [...recommendedJobs, ...backfill];
    }

    // ── Build company query based on interests / city ────────────────────

    const companyWhere: any = { status: 'ACTIVE' };

    // If user has interests that could map to industries, use them
    if (interests.length > 0) {
      const industryFilters = interests
        .filter((i: any) => typeof i === 'string' && i.length > 0)
        .map((interest: string) => ({ industry: { contains: interest } }));

      if (industryFilters.length > 0) {
        companyWhere.OR = industryFilters;
      }
    }

    if (user.city) {
      companyWhere.city = { contains: user.city };
    }

    let recommendedCompanies = await this.prisma.company.findMany({
      where: companyWhere,
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        coverImageUrl: true,
        city: true,
        industry: true,
        shortDescription: true,
        verified: true,
        _count: {
          select: {
            jobPosts: {
              where: { status: 'ACTIVE' },
            },
          },
        },
      },
      orderBy: [{ verified: 'desc' }, { name: 'asc' }],
      take: 10,
    });

    // Backfill companies if not enough
    if (recommendedCompanies.length < 10) {
      const existingCompanyIds = recommendedCompanies.map((c) => c.id);
      const backfill = await this.prisma.company.findMany({
        where: {
          status: 'ACTIVE',
          id: { notIn: existingCompanyIds },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          coverImageUrl: true,
          city: true,
          industry: true,
          shortDescription: true,
          verified: true,
          _count: {
            select: {
              jobPosts: {
                where: { status: 'ACTIVE' },
              },
            },
          },
        },
        orderBy: [{ verified: 'desc' }, { name: 'asc' }],
        take: 10 - recommendedCompanies.length,
      });

      recommendedCompanies = [...recommendedCompanies, ...backfill];
    }

    return {
      data: {
        jobs: recommendedJobs,
        companies: recommendedCompanies,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // APP VIDEO FEED (Video-first feed for mobile app)
  // ═══════════════════════════════════════════════════════════════════════════

  async getAppVideoFeed(
    page: number,
    limit: number,
    filters?: {
      portalId?: number;
      lat?: number;
      lng?: number;
      radiusKm?: number;
      excludeVideoIds?: string[];
    },
    userId?: string,
  ) {
    const { page: p, limit: l, skip } = this.paginate(page, limit);

    // Build where clause for active videos with active job posts
    const where: any = {
      status: 'ACTIVE',
      moderationStatus: 'APPROVED',
    };

    // Exclude already-seen videos
    if (filters?.excludeVideoIds && filters.excludeVideoIds.length > 0) {
      where.id = { notIn: filters.excludeVideoIds };
    }

    // Filter by portal via job posts
    if (filters?.portalId) {
      where.OR = [
        { jobPost: { portalId: filters.portalId } },
        { videoJobPosts: { some: { jobPost: { portalId: filters.portalId } } } },
      ];
    }

    // Get liked video IDs if user is authenticated
    let likedVideoIds = new Set<string>();
    let likedJobPostIds = new Set<string>();
    if (userId) {
      const [videoLikes, jobLikes] = await Promise.all([
        this.prisma.like.findMany({
          where: { userId, videoId: { not: null } },
          select: { videoId: true },
        }),
        this.prisma.like.findMany({
          where: { userId, jobPostId: { not: null } },
          select: { jobPostId: true },
        }),
      ]);
      likedVideoIds = new Set(videoLikes.map((l) => l.videoId!));
      likedJobPostIds = new Set(jobLikes.map((l) => l.jobPostId!));
    }

    const [videos, total] = await Promise.all([
      this.prisma.video.findMany({
        where,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              city: true,
              postalCode: true,
              industry: true,
              verified: true,
              shortDescription: true,
            },
          },
          jobPost: {
            select: {
              id: true,
              title: true,
              slug: true,
              city: true,
              postalCode: true,
              salaryYear1: true,
              salaryYear2: true,
              salaryYear3: true,
              gehalt: true,
              portalId: true,
              status: true,
              benefits: true,
              startDate: true,
              arbeitszeit: true,
              dauer: true,
              remote: true,
            },
          },
          videoJobPosts: {
            include: {
              jobPost: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  city: true,
                  postalCode: true,
                  salaryYear1: true,
                  salaryYear2: true,
                  salaryYear3: true,
                  gehalt: true,
                  portalId: true,
                  status: true,
                  benefits: true,
                  startDate: true,
                  arbeitszeit: true,
                  dauer: true,
                  remote: true,
                },
              },
            },
            orderBy: { position: 'asc' },
          },
          profession: {
            select: {
              id: true,
              name: true,
              slug: true,
              category: true,
            },
          },
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: l,
      }),
      this.prisma.video.count({ where }),
    ]);

    // Transform into feed items
    const items = videos.map((video) => {
      // Collect all associated job posts (direct + M2M)
      const jobPosts: any[] = [];
      if (video.jobPost && video.jobPost.status === 'ACTIVE') {
        jobPosts.push(video.jobPost);
      }
      for (const vjp of video.videoJobPosts) {
        if (vjp.jobPost.status === 'ACTIVE' && !jobPosts.find((j) => j.id === vjp.jobPost.id)) {
          jobPosts.push(vjp.jobPost);
        }
      }

      return {
        type: 'video' as const,
        video: {
          id: video.id,
          title: video.title,
          description: video.description,
          url: video.processedPath || video.filepath,
          thumbnailUrl: video.thumbnailPath,
          durationSeconds: video.durationSeconds,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
          isLiked: likedVideoIds.has(video.id),
        },
        company: video.company,
        jobPosts: jobPosts.map((jp) => ({
          ...jp,
          isLiked: likedJobPostIds.has(jp.id),
        })),
        profession: video.profession,
      };
    });

    return {
      data: items,
      pagination: this.paginationMeta(total, p, l),
      hasMore: skip + l < total,
    };
  }

  // ─── UTILITY ────────────────────────────────────────────────────────────────

  private parseJsonArray(value: unknown): any[] {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }
}
