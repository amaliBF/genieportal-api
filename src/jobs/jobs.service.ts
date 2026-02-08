import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  // ─── SLUG GENERATION ─────────────────────────────────────────────────────

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[äÄ]/g, 'ae')
      .replace(/[öÖ]/g, 'oe')
      .replace(/[üÜ]/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 140);
  }

  // ─── PUBLIC: LIST ACTIVE JOBS ────────────────────────────────────────────

  async findPublicJobs(filters: {
    status?: string;
    professionId?: string;
    city?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit =
      filters.limit && filters.limit > 0 && filters.limit <= 100
        ? filters.limit
        : 20;
    const skip = (page - 1) * limit;

    const where: any = { status: 'ACTIVE' };

    if (filters.professionId) {
      where.professionId = filters.professionId;
    }

    if (filters.city) {
      where.city = { contains: filters.city };
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
        take: limit,
      }),
      this.prisma.jobPost.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── PUBLIC: GET SINGLE JOB ──────────────────────────────────────────────

  async findOne(id: string) {
    const job = await this.prisma.jobPost.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            coverImageUrl: true,
            city: true,
            postalCode: true,
            industry: true,
            employeeCount: true,
            description: true,
            shortDescription: true,
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
    });

    if (!job) {
      throw new NotFoundException('Stellenanzeige nicht gefunden');
    }

    // Increment view count asynchronously
    this.prisma.jobPost
      .update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {
        // silently ignore view-count errors
      });

    return job;
  }

  // ─── PUBLIC: FIND NEARBY JOBS (HAVERSINE) ────────────────────────────────

  async findNearby(
    lat: number,
    lng: number,
    radiusKm: number,
    page?: number,
    limit?: number,
  ) {
    const currentPage = page && page > 0 ? page : 1;
    const take =
      limit && limit > 0 && limit <= 100 ? limit : 20;
    const offset = (currentPage - 1) * take;

    const jobs = await this.prisma.$queryRawUnsafe(
      `
      SELECT
        jp.*,
        c.name AS "companyName",
        c.slug AS "companySlug",
        c.logo_url AS "companyLogoUrl",
        p.name AS "professionName",
        p.slug AS "professionSlug",
        (
          6371 * acos(
            cos(radians($1)) * cos(radians(jp.latitude))
            * cos(radians(jp.longitude) - radians($2))
            + sin(radians($1)) * sin(radians(jp.latitude))
          )
        ) AS distance_km
      FROM job_posts jp
      LEFT JOIN companies c ON c.id = jp.company_id
      LEFT JOIN professions p ON p.id = jp.profession_id
      WHERE jp.status = 'ACTIVE'
        AND jp.latitude IS NOT NULL
        AND jp.longitude IS NOT NULL
        AND (
          6371 * acos(
            cos(radians($1)) * cos(radians(jp.latitude))
            * cos(radians(jp.longitude) - radians($2))
            + sin(radians($1)) * sin(radians(jp.latitude))
          )
        ) <= $3
      ORDER BY distance_km ASC
      LIMIT $4 OFFSET $5
      `,
      lat,
      lng,
      radiusKm,
      take,
      offset,
    );

    return {
      data: jobs,
      meta: {
        page: currentPage,
        limit: take,
        radiusKm,
        lat,
        lng,
      },
    };
  }

  // ─── DASHBOARD: LIST COMPANY JOBS ────────────────────────────────────────

  async findByCompany(companyId: string) {
    const jobs = await this.prisma.jobPost.findMany({
      where: { companyId },
      include: {
        company: {
          select: { id: true, slug: true, name: true },
        },
        profession: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
          },
        },
        videoJobPosts: {
          include: {
            video: {
              select: {
                id: true,
                title: true,
                thumbnailPath: true,
                durationSeconds: true,
                viewCount: true,
              },
            },
          },
          orderBy: { position: 'asc' },
        },
        _count: {
          select: {
            likes: true,
            matches: true,
            videos: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return jobs.map((job) => ({
      ...job,
      websiteUrl: job.showOnWebsite && job.status === 'ACTIVE'
        ? `https://ausbildungsgenie.de/stellen/${job.company?.slug || 'firma'}-${job.slug}-${job.id.substring(0, 8)}`
        : null,
    }));
  }

  // ─── DASHBOARD: CREATE JOB ──────────────────────────────────────────────

  async create(companyId: string, dto: CreateJobDto) {
    const slug = this.generateSlug(dto.title) + '-' + Date.now().toString(36);

    const job = await this.prisma.jobPost.create({
      data: {
        companyId,
        title: dto.title,
        slug,
        ...(dto.professionId !== undefined && { professionId: dto.professionId }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.requirements !== undefined && { requirements: dto.requirements }),
        ...(dto.benefits !== undefined && { benefits: dto.benefits }),
        ...(dto.startDate !== undefined && {
          startDate: new Date(dto.startDate),
        }),
        ...(dto.durationMonths !== undefined && { durationMonths: dto.durationMonths }),
        ...(dto.positionsAvailable !== undefined && {
          positionsAvailable: dto.positionsAvailable,
        }),
        ...(dto.salaryYear1 !== undefined && { salaryYear1: dto.salaryYear1 }),
        ...(dto.salaryYear2 !== undefined && { salaryYear2: dto.salaryYear2 }),
        ...(dto.salaryYear3 !== undefined && { salaryYear3: dto.salaryYear3 }),
        ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.showOnWebsite !== undefined && { showOnWebsite: dto.showOnWebsite }),
        ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
        ...(dto.metaDescription !== undefined && { metaDescription: dto.metaDescription }),
      },
      include: {
        profession: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Link videos if provided
    if (dto.videoIds?.length) {
      await this.linkVideosToJob(job.id, companyId, dto.videoIds);
    }

    return job;
  }

  // ─── DASHBOARD: UPDATE JOB ──────────────────────────────────────────────

  async update(jobId: string, companyId: string, dto: UpdateJobDto) {
    const job = await this.prisma.jobPost.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Stellenanzeige nicht gefunden');
    }

    if (job.companyId !== companyId) {
      throw new ForbiddenException('Zugriff verweigert');
    }

    const updated = await this.prisma.jobPost.update({
      where: { id: jobId },
      data: {
        ...(dto.title !== undefined && {
          title: dto.title,
          slug: this.generateSlug(dto.title) + '-' + Date.now().toString(36),
        }),
        ...(dto.professionId !== undefined && { professionId: dto.professionId }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.requirements !== undefined && { requirements: dto.requirements }),
        ...(dto.benefits !== undefined && { benefits: dto.benefits }),
        ...(dto.startDate !== undefined && {
          startDate: new Date(dto.startDate),
        }),
        ...(dto.durationMonths !== undefined && { durationMonths: dto.durationMonths }),
        ...(dto.positionsAvailable !== undefined && {
          positionsAvailable: dto.positionsAvailable,
        }),
        ...(dto.salaryYear1 !== undefined && { salaryYear1: dto.salaryYear1 }),
        ...(dto.salaryYear2 !== undefined && { salaryYear2: dto.salaryYear2 }),
        ...(dto.salaryYear3 !== undefined && { salaryYear3: dto.salaryYear3 }),
        ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.showOnWebsite !== undefined && { showOnWebsite: dto.showOnWebsite }),
        ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
        ...(dto.metaDescription !== undefined && { metaDescription: dto.metaDescription }),
      },
      include: {
        profession: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Update video links if provided
    if (dto.videoIds !== undefined) {
      await this.linkVideosToJob(jobId, companyId, dto.videoIds);
    }

    return updated;
  }

  // ─── DASHBOARD: REMOVE (CLOSE) JOB ──────────────────────────────────────

  async remove(jobId: string, companyId: string) {
    const job = await this.prisma.jobPost.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Stellenanzeige nicht gefunden');
    }

    if (job.companyId !== companyId) {
      throw new ForbiddenException('Zugriff verweigert');
    }

    return this.prisma.jobPost.update({
      where: { id: jobId },
      data: { status: 'CLOSED' },
    });
  }

  // ─── DASHBOARD: PUBLISH JOB ─────────────────────────────────────────────

  async publish(jobId: string, companyId: string) {
    const job = await this.prisma.jobPost.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Stellenanzeige nicht gefunden');
    }

    if (job.companyId !== companyId) {
      throw new ForbiddenException('Zugriff verweigert');
    }

    return this.prisma.jobPost.update({
      where: { id: jobId },
      data: {
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
    });
  }

  // ─── DASHBOARD: LINK VIDEOS TO JOB ──────────────────────────────────────

  private async linkVideosToJob(jobId: string, companyId: string, videoIds: string[]) {
    // Verify all videos belong to the company
    if (videoIds.length > 0) {
      const validVideos = await this.prisma.video.findMany({
        where: { id: { in: videoIds }, companyId },
        select: { id: true },
      });
      const validIds = new Set(validVideos.map((v) => v.id));
      videoIds = videoIds.filter((id) => validIds.has(id));
    }

    // Delete existing links
    await this.prisma.videoJobPost.deleteMany({
      where: { jobPostId: jobId },
    });

    // Create new links with position
    if (videoIds.length > 0) {
      await this.prisma.videoJobPost.createMany({
        data: videoIds.map((videoId, index) => ({
          videoId,
          jobPostId: jobId,
          position: index,
        })),
      });
    }
  }

  // ─── DASHBOARD: PAUSE JOB ──────────────────────────────────────────────

  async pause(jobId: string, companyId: string) {
    const job = await this.prisma.jobPost.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Stellenanzeige nicht gefunden');
    }

    if (job.companyId !== companyId) {
      throw new ForbiddenException('Zugriff verweigert');
    }

    return this.prisma.jobPost.update({
      where: { id: jobId },
      data: { status: 'PAUSED' },
    });
  }
}
