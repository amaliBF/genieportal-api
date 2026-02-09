import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ListParams {
  q?: string;
  portalId?: number;
  city?: string;
  industry?: string;
  hasJobs?: boolean;
  verified?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
}

function paginate(page = 1, limit = 20, maxLimit = 100) {
  const p = Math.max(1, page);
  const l = Math.min(Math.max(1, limit), maxLimit);
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
}

@Injectable()
export class PublicCompaniesService {
  constructor(private prisma: PrismaService) {}

  // ─── 1. LIST / SEARCH ──────────────────────────────────────────────────────

  async list(params: ListParams) {
    const { skip, take, page, limit } = paginate(params.page, params.limit);

    const where: any = {
      status: 'ACTIVE',
    };

    // Portal filter: companies that have jobs on this portal
    if (params.portalId) {
      where.OR = [
        { jobPosts: { some: { portalId: params.portalId, status: 'ACTIVE' } } },
        { jobPosts: { some: { publishedPortals: { some: { portalId: params.portalId } }, status: 'ACTIVE' } } },
      ];
    }

    // Text search
    if (params.q) {
      const q = params.q.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { name: { contains: q } },
            { industry: { contains: q } },
            { city: { contains: q } },
            { shortDescription: { contains: q } },
          ],
        },
      ];
    }

    // City filter
    if (params.city) {
      where.city = { contains: params.city };
    }

    // Industry filter
    if (params.industry) {
      where.industry = { contains: params.industry };
    }

    // Verified filter
    if (params.verified) {
      where.verified = true;
    }

    // Has active jobs
    if (params.hasJobs) {
      if (!where.OR) {
        where.jobPosts = { some: { status: 'ACTIVE' } };
      }
    }

    // Sort
    let orderBy: any = { name: 'asc' };
    switch (params.sort) {
      case 'jobs':
        orderBy = { jobPosts: { _count: 'desc' } };
        break;
      case 'rating':
        orderBy = { reviewAverage: 'desc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      default:
        orderBy = { name: 'asc' };
    }

    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          postalCode: true,
          industry: true,
          shortDescription: true,
          logoUrl: true,
          coverImageUrl: true,
          employeeCount: true,
          verified: true,
          reviewCount: true,
          reviewAverage: true,
          recommendPercent: true,
          _count: {
            select: {
              jobPosts: { where: { status: 'ACTIVE' } },
              videos: { where: { status: 'ACTIVE' } },
            },
          },
        },
        orderBy,
        skip,
        take,
      }),
      this.prisma.company.count({ where }),
    ]);

    const items = companies.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      city: c.city,
      postalCode: c.postalCode,
      industry: c.industry,
      shortDescription: c.shortDescription,
      logoUrl: c.logoUrl,
      coverImageUrl: c.coverImageUrl,
      employeeCount: c.employeeCount,
      verified: c.verified,
      reviewCount: c.reviewCount || 0,
      reviewAverage: c.reviewAverage ? parseFloat(String(c.reviewAverage)) : null,
      recommendPercent: c.recommendPercent || null,
      jobCount: c._count.jobPosts,
      videoCount: c._count.videos,
    }));

    return {
      total,
      items,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── 2. STATS ──────────────────────────────────────────────────────────────

  async getStats(portalId?: number) {
    const baseWhere: any = { status: 'ACTIVE' };

    if (portalId) {
      baseWhere.OR = [
        { jobPosts: { some: { portalId, status: 'ACTIVE' } } },
        { jobPosts: { some: { publishedPortals: { some: { portalId } }, status: 'ACTIVE' } } },
      ];
    }

    const [totalCompanies, topIndustries, topCities] = await Promise.all([
      this.prisma.company.count({ where: baseWhere }),
      this.prisma.company.groupBy({
        by: ['industry'],
        where: baseWhere,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),
      this.prisma.company.groupBy({
        by: ['city'],
        where: baseWhere,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),
    ]);

    return {
      totalCompanies,
      topIndustries: topIndustries
        .filter((i) => i.industry)
        .map((i) => ({
          name: i.industry!,
          count: i._count.id,
        })),
      topCities: topCities
        .filter((c) => c.city)
        .map((c) => ({
          name: c.city!,
          count: c._count.id,
        })),
    };
  }

  // ─── 3. DETAIL BY SLUG ─────────────────────────────────────────────────────

  async getBySlug(slug: string) {
    // Try slug first, then partial ID
    let company: any = await this.prisma.company.findFirst({
      where: { slug, status: 'ACTIVE' },
      include: {
        videos: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            title: true,
            description: true,
            thumbnailPath: true,
            processedPath: true,
            storagePath: true,
            durationSeconds: true,
            viewCount: true,
            featuredPerson: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 6,
        },
        jobPosts: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            title: true,
            slug: true,
            city: true,
            postalCode: true,
            startDate: true,
            salaryYear1: true,
            createdAt: true,
            profession: {
              select: { name: true, slug: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            jobPosts: { where: { status: 'ACTIVE' } },
            videos: { where: { status: 'ACTIVE' } },
            companyFollowers: true,
          },
        },
      },
    });

    if (!company) {
      // Try partial ID match (last 8 chars)
      company = await this.prisma.company.findFirst({
        where: {
          id: { startsWith: slug },
          status: 'ACTIVE',
        },
        include: {
          videos: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              title: true,
              description: true,
              thumbnailPath: true,
              processedPath: true,
              storagePath: true,
              durationSeconds: true,
              viewCount: true,
              featuredPerson: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 6,
          },
          jobPosts: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              title: true,
              slug: true,
              city: true,
              postalCode: true,
              startDate: true,
              salaryYear1: true,
              createdAt: true,
              profession: {
                select: { name: true, slug: true },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          _count: {
            select: {
              jobPosts: { where: { status: 'ACTIVE' } },
              videos: { where: { status: 'ACTIVE' } },
              companyFollowers: true,
            },
          },
        },
      });
    }

    if (!company) {
      throw new NotFoundException('Unternehmen nicht gefunden');
    }

    return {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        legalName: company.legalName,
        phone: company.phone,
        website: company.website,
        street: company.street,
        postalCode: company.postalCode,
        city: company.city,
        latitude: company.latitude,
        longitude: company.longitude,
        industry: company.industry,
        industryTags: company.industryTags,
        description: company.description,
        shortDescription: company.shortDescription,
        foundedYear: company.foundedYear,
        employeeCount: company.employeeCount,
        logoUrl: company.logoUrl,
        coverImageUrl: company.coverImageUrl,
        trainingSince: company.trainingSince,
        totalApprentices: company.totalApprentices,
        benefits: company.benefits,
        verified: company.verified,
        reviewCount: company.reviewCount || 0,
        reviewAverage: company.reviewAverage ? parseFloat(String(company.reviewAverage)) : null,
        recommendPercent: company.recommendPercent || null,
        jobCount: company._count.jobPosts,
        videoCount: company._count.videos,
        followerCount: company._count.companyFollowers,
      },
      videos: company.videos.map((v) => ({
        id: v.id,
        title: v.title,
        description: v.description,
        thumbnailUrl: v.thumbnailPath,
        url: v.storagePath
          ? `${process.env.BUNNY_CDN_URL || ''}/${v.storagePath}`
          : v.processedPath || null,
        durationSeconds: v.durationSeconds,
        viewCount: v.viewCount,
        featuredPerson: v.featuredPerson,
      })),
      jobs: company.jobPosts.map((j) => ({
        id: j.id,
        title: j.title,
        slug: j.slug,
        city: j.city,
        postalCode: j.postalCode,
        startDate: j.startDate,
        salaryYear1: j.salaryYear1,
        profession: j.profession,
        createdAt: j.createdAt,
      })),
    };
  }

  // ─── 4. COMPANY JOBS ───────────────────────────────────────────────────────

  async getCompanyJobs(slug: string, portalId?: number) {
    const company = await this.prisma.company.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException('Unternehmen nicht gefunden');
    }

    const where: any = {
      companyId: company.id,
      status: 'ACTIVE',
    };

    if (portalId) {
      where.OR = [
        { portalId },
        { publishedPortals: { some: { portalId } } },
      ];
    }

    const jobs = await this.prisma.jobPost.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        city: true,
        postalCode: true,
        startDate: true,
        salaryYear1: true,
        salaryYear2: true,
        salaryYear3: true,
        durationMonths: true,
        showOnWebsite: true,
        createdAt: true,
        profession: {
          select: { name: true, slug: true, category: true },
        },
        company: {
          select: { name: true, slug: true, logoUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      total: jobs.length,
      items: jobs.map((j) => ({
        id: j.id,
        title: j.title,
        slug: j.slug,
        city: j.city,
        postalCode: j.postalCode,
        startDate: j.startDate,
        salaryYear1: j.salaryYear1,
        durationMonths: j.durationMonths,
        profession: j.profession,
        company: j.company,
        createdAt: j.createdAt,
        url: `/stellen/${j.company.slug}-${j.slug}-${j.id.substring(0, 8)}`,
      })),
    };
  }

  // ─── 5. COMPANY REVIEWS ────────────────────────────────────────────────────

  async getCompanyReviews(slug: string, page = 1, limit = 10) {
    const company = await this.prisma.company.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: { id: true, reviewCount: true, reviewAverage: true, recommendPercent: true },
    });

    if (!company) {
      throw new NotFoundException('Unternehmen nicht gefunden');
    }

    const { skip, take } = paginate(page, limit);

    const [reviews, total] = await Promise.all([
      this.prisma.companyReview.findMany({
        where: {
          companyId: company.id,
          status: 'APPROVED',
        },
        select: {
          id: true,
          overallRating: true,
          title: true,
          pros: true,
          cons: true,
          reviewerType: true,
          isAnonymous: true,
          companyResponse: true,
          companyRespondedAt: true,
          helpfulCount: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.companyReview.count({
        where: {
          companyId: company.id,
          status: 'APPROVED',
        },
      }),
    ]);

    return {
      summary: {
        reviewCount: company.reviewCount || 0,
        reviewAverage: company.reviewAverage ? parseFloat(String(company.reviewAverage)) : null,
        recommendPercent: company.recommendPercent || null,
      },
      total,
      items: reviews,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
