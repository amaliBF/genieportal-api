import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PublicJobsService {
  private cdnUrl: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.cdnUrl = this.config.get('CDN_URL') || 'https://cdn.ausbildungsgenie.de';
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  private paginate(page?: number, limit?: number, maxLimit = 100) {
    const p = Math.max(1, page || 1);
    const l = Math.min(maxLimit, Math.max(1, limit || 20));
    return { page: p, limit: l, skip: (p - 1) * l };
  }

  private getMediaUrl(path?: string | null): string | null {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${this.cdnUrl}/${path.replace(/^\//, '')}`;
  }

  private buildJobUrl(job: any, portalDomain?: string): string {
    const companySlug = job.company?.slug || 'firma';
    const jobSlug = job.slug || 'stelle';
    const id = job.id.substring(0, 8);
    const domain = portalDomain || 'ausbildungsgenie.de';
    return `https://${domain}/stellen/${companySlug}-${jobSlug}-${id}`;
  }

  private mapJobListItem(job: any, portalDomain?: string) {
    const salaryValues = [job.salaryYear1, job.salaryYear2, job.salaryYear3].filter(Boolean);
    const hasVideo = (job.videos?.length || 0) > 0 || (job.videoJobPosts?.length || 0) > 0;
    const thumbnail = job.videos?.[0]?.thumbnailPath || job.videoJobPosts?.[0]?.video?.thumbnailPath;

    return {
      id: job.id,
      slug: job.slug,
      title: job.title,
      beruf: job.beruf || job.profession?.name || null,
      company: {
        id: job.company?.id,
        name: job.company?.name,
        slug: job.company?.slug,
        logo: this.getMediaUrl(job.company?.logoUrl),
      },
      standort: {
        stadt: job.city || job.company?.city || null,
        plz: job.postalCode || null,
      },
      gehalt: salaryValues.length > 0
        ? {
            min: Math.min(...salaryValues),
            max: Math.max(...salaryValues),
            einheit: 'MONTH' as const,
          }
        : null,
      startDatum: job.startDate ? job.startDate.toISOString().split('T')[0] : null,
      hasVideo,
      videoThumbnail: this.getMediaUrl(thumbnail),
      createdAt: job.createdAt.toISOString(),
      url: this.buildJobUrl(job, portalDomain),
    };
  }

  private baseWhere(portalId?: number) {
    const where: any = {
      status: 'ACTIVE',
      showOnWebsite: true,
    };
    if (portalId) where.portalId = portalId;
    return where;
  }

  private jobIncludes(): any {
    return {
      company: {
        select: {
          id: true, name: true, slug: true, logoUrl: true,
          city: true, postalCode: true, industry: true,
          verified: true, shortDescription: true,
        },
      },
      profession: {
        select: { id: true, name: true, slug: true, category: true },
      },
      videos: {
        where: { status: 'ACTIVE' },
        select: { id: true, thumbnailPath: true, title: true },
        take: 1,
      },
      videoJobPosts: {
        include: {
          video: {
            select: { id: true, thumbnailPath: true, title: true },
          },
        },
        take: 1,
      },
    };
  }

  // ─── 1. SEARCH ────────────────────────────────────────────────────────────

  async search(params: {
    q?: string;
    portalId?: number;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    berufsfeld?: string;
    stadt?: string;
    hasVideo?: boolean;
    sort?: string;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, skip } = this.paginate(params.page, params.limit);
    const where: any = this.baseWhere(params.portalId);

    // Text search
    if (params.q) {
      where.OR = [
        { title: { contains: params.q } },
        { beruf: { contains: params.q } },
        { description: { contains: params.q } },
        { company: { name: { contains: params.q } } },
        { profession: { name: { contains: params.q } } },
      ];
    }

    // City filter
    if (params.stadt) {
      where.city = { contains: params.stadt };
    }

    // Profession category filter
    if (params.berufsfeld) {
      where.profession = { category: { contains: params.berufsfeld } };
    }

    // Has video filter
    if (params.hasVideo) {
      where.OR = [
        ...(where.OR || []),
        { videos: { some: { status: 'ACTIVE' } } },
        { videoJobPosts: { some: {} } },
      ];
    }

    // Sort
    let orderBy: any = { publishedAt: 'desc' };
    if (params.sort === 'date') orderBy = { createdAt: 'desc' };
    else if (params.sort === 'salary') orderBy = { salaryYear1: 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.jobPost.findMany({
        where,
        include: this.jobIncludes(),
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.jobPost.count({ where }),
    ]);

    // Facets
    const facetWhere = this.baseWhere(params.portalId);
    const [berufsfelderRaw, staedteRaw] = await Promise.all([
      this.prisma.jobPost.groupBy({
        by: ['professionId'],
        where: facetWhere,
        _count: true,
        orderBy: { _count: { professionId: 'desc' } },
        take: 20,
      }),
      this.prisma.jobPost.groupBy({
        by: ['city'],
        where: { ...facetWhere, city: { not: null } },
        _count: true,
        orderBy: { _count: { city: 'desc' } },
        take: 30,
      }),
    ]);

    // Resolve profession names for facets
    const professionIds = berufsfelderRaw
      .filter((b) => b.professionId)
      .map((b) => b.professionId!);
    const professions = professionIds.length > 0
      ? await this.prisma.profession.findMany({
          where: { id: { in: professionIds } },
          select: { id: true, name: true, slug: true, category: true },
        })
      : [];
    const profMap = new Map(professions.map((p) => [p.id, p]));

    return {
      total,
      items: items.map((j) => this.mapJobListItem(j)),
      facets: {
        berufsfelder: berufsfelderRaw
          .filter((b) => b.professionId && profMap.has(b.professionId))
          .map((b) => ({
            name: profMap.get(b.professionId!)!.name,
            slug: profMap.get(b.professionId!)!.slug,
            count: b._count,
          })),
        staedte: staedteRaw
          .filter((s) => s.city)
          .map((s) => ({
            name: s.city!,
            slug: s.city!.toLowerCase().replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
            count: s._count,
          })),
      },
      pagination: { page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── 2. AUTOCOMPLETE ──────────────────────────────────────────────────────

  async autocomplete(q: string, portalId?: number, limit = 5) {
    if (!q || q.length < 2) return { suggestions: [] };

    const baseWhere = this.baseWhere(portalId);

    const [professions, companies, cities] = await Promise.all([
      // Berufe
      this.prisma.profession.findMany({
        where: { name: { contains: q }, isActive: true },
        select: { id: true, name: true, slug: true },
        take: limit,
      }),
      // Firmen
      this.prisma.company.findMany({
        where: { name: { contains: q }, status: 'ACTIVE' },
        select: { id: true, name: true, slug: true },
        take: limit,
      }),
      // Städte (distinct)
      this.prisma.jobPost.groupBy({
        by: ['city'],
        where: { ...baseWhere, city: { contains: q } },
        _count: true,
        orderBy: { _count: { city: 'desc' } },
        take: limit,
      }),
    ]);

    const suggestions = [
      ...professions.map((p) => ({
        type: 'beruf' as const,
        text: p.name,
        slug: p.slug,
        count: 0,
      })),
      ...companies.map((c) => ({
        type: 'firma' as const,
        text: c.name,
        slug: c.slug,
        count: 0,
      })),
      ...cities
        .filter((c) => c.city)
        .map((c) => ({
          type: 'stadt' as const,
          text: c.city!,
          slug: c.city!.toLowerCase().replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
          count: c._count,
        })),
    ];

    return { suggestions: suggestions.slice(0, limit * 3) };
  }

  // ─── 3. JOB DETAIL ────────────────────────────────────────────────────────

  async getDetail(idOrPartial: string) {
    // Support both full IDs and 8-char partial IDs from URL slugs
    let job: any = null;

    if (idOrPartial.length >= 20) {
      // Full CUID
      job = await this.prisma.jobPost.findUnique({
        where: { id: idOrPartial },
        include: {
          company: {
            select: {
              id: true, name: true, slug: true, email: true,
              phone: true, website: true, street: true,
              postalCode: true, city: true, latitude: true, longitude: true,
              industry: true, industryTags: true, description: true,
              shortDescription: true, foundedYear: true, employeeCount: true,
              logoUrl: true, coverImageUrl: true, trainingSince: true,
              totalApprentices: true, benefits: true, verified: true,
            },
          },
          profession: true,
          videos: {
            where: { status: 'ACTIVE' },
            select: {
              id: true, title: true, description: true,
              processedPath: true, thumbnailPath: true,
              durationSeconds: true, viewCount: true, likeCount: true,
            },
          },
          videoJobPosts: {
            include: {
              video: {
                select: {
                  id: true, title: true, description: true,
                  processedPath: true, thumbnailPath: true,
                  durationSeconds: true, viewCount: true, likeCount: true,
                },
              },
            },
            orderBy: { position: 'asc' },
          },
        },
      });
    }

    if (!job) {
      // Try partial ID match (from URL slug: last 8 chars)
      job = await this.prisma.jobPost.findFirst({
        where: { id: { startsWith: idOrPartial }, status: 'ACTIVE', showOnWebsite: true },
        include: {
          company: {
            select: {
              id: true, name: true, slug: true, email: true,
              phone: true, website: true, street: true,
              postalCode: true, city: true, latitude: true, longitude: true,
              industry: true, industryTags: true, description: true,
              shortDescription: true, foundedYear: true, employeeCount: true,
              logoUrl: true, coverImageUrl: true, trainingSince: true,
              totalApprentices: true, benefits: true, verified: true,
            },
          },
          profession: true,
          videos: {
            where: { status: 'ACTIVE' },
            select: {
              id: true, title: true, description: true,
              processedPath: true, thumbnailPath: true,
              durationSeconds: true, viewCount: true, likeCount: true,
            },
          },
          videoJobPosts: {
            include: {
              video: {
                select: {
                  id: true, title: true, description: true,
                  processedPath: true, thumbnailPath: true,
                  durationSeconds: true, viewCount: true, likeCount: true,
                },
              },
            },
            orderBy: { position: 'asc' },
          },
        },
      });
    }

    if (!job || job.status !== 'ACTIVE') {
      throw new NotFoundException('Stellenanzeige nicht gefunden');
    }

    const jobId = job.id;

    // Increment view
    this.prisma.jobPost
      .update({ where: { id: jobId }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});

    // All videos (direct + M2M)
    const allVideos = [
      ...job.videos.map((v) => ({
        ...v,
        url: this.getMediaUrl(v.processedPath),
        thumbnailUrl: this.getMediaUrl(v.thumbnailPath),
      })),
      ...job.videoJobPosts
        .filter((vjp) => vjp.video)
        .map((vjp) => ({
          ...vjp.video,
          url: this.getMediaUrl(vjp.video.processedPath),
          thumbnailUrl: this.getMediaUrl(vjp.video.thumbnailPath),
        })),
    ];
    // Deduplicate by id
    const videoMap = new Map(allVideos.map((v) => [v.id, v]));
    const videos = Array.from(videoMap.values());

    // Similar jobs
    const similarWhere: any = {
      status: 'ACTIVE',
      showOnWebsite: true,
      id: { not: jobId },
      portalId: job.portalId,
    };
    if (job.professionId) similarWhere.professionId = job.professionId;
    else if (job.city) similarWhere.city = { contains: job.city };

    const similarJobs = await this.prisma.jobPost.findMany({
      where: similarWhere,
      include: this.jobIncludes(),
      orderBy: { publishedAt: 'desc' },
      take: 6,
    });

    // Company logo URL
    const company = {
      ...job.company,
      logoUrl: this.getMediaUrl(job.company.logoUrl),
      coverImageUrl: this.getMediaUrl(job.company.coverImageUrl),
    };

    return {
      job: {
        id: job.id,
        title: job.title,
        slug: job.slug,
        description: job.description,
        requirements: job.requirements,
        benefits: job.benefits,
        beruf: job.beruf,
        anforderungen: job.anforderungen,
        gehalt: job.gehalt,
        arbeitszeit: job.arbeitszeit,
        dauer: job.dauer,
        remote: job.remote,
        standortAdresse: job.standortAdresse,
        startDate: job.startDate,
        durationMonths: job.durationMonths,
        positionsAvailable: job.positionsAvailable,
        salaryYear1: job.salaryYear1,
        salaryYear2: job.salaryYear2,
        salaryYear3: job.salaryYear3,
        postalCode: job.postalCode,
        city: job.city,
        latitude: job.latitude ? Number(job.latitude) : null,
        longitude: job.longitude ? Number(job.longitude) : null,
        metaTitle: job.metaTitle,
        metaDescription: job.metaDescription,
        portalId: job.portalId,
        publishedAt: job.publishedAt,
        expiresAt: job.expiresAt,
        viewCount: job.viewCount,
        likeCount: job.likeCount,
      },
      company,
      profession: job.profession,
      videos,
      similarJobs: similarJobs.map((j) => this.mapJobListItem(j)),
    };
  }

  // ─── 4. SCHEMA.ORG JSON-LD (Google for Jobs) ──────────────────────────────

  async getSchema(idOrPartial: string) {
    let job: any = null;

    if (idOrPartial.length >= 20) {
      job = await this.prisma.jobPost.findUnique({
        where: { id: idOrPartial },
        include: {
          company: {
            select: {
              name: true, slug: true, website: true, logoUrl: true,
              street: true, postalCode: true, city: true,
              latitude: true, longitude: true,
            },
          },
          profession: { select: { name: true, category: true } },
          portal: { select: { slug: true, domain: true } },
        },
      });
    }

    if (!job) {
      job = await this.prisma.jobPost.findFirst({
        where: { id: { startsWith: idOrPartial }, status: 'ACTIVE' },
        include: {
          company: {
            select: {
              name: true, slug: true, website: true, logoUrl: true,
              street: true, postalCode: true, city: true,
              latitude: true, longitude: true,
            },
          },
          profession: { select: { name: true, category: true } },
          portal: { select: { slug: true, domain: true } },
        },
      });
    }

    if (!job || job.status !== 'ACTIVE') {
      throw new NotFoundException('Stellenanzeige nicht gefunden');
    }

    const salaryValues = [job.salaryYear1, job.salaryYear2, job.salaryYear3].filter(Boolean) as number[];
    const portalSlug = job.portal?.slug || 'ausbildungsgenie';
    const portalDomain = job.portal?.domain || 'ausbildungsgenie.de';

    // Employment type based on portal
    let employmentType = 'FULL_TIME';
    if (portalSlug === 'praktikumsgenie') employmentType = 'INTERN';
    else if (portalSlug === 'minijobgenie') employmentType = 'PART_TIME';
    else if (portalSlug === 'werkstudentengenie') employmentType = 'PART_TIME';

    const schema: any = {
      '@context': 'https://schema.org/',
      '@type': 'JobPosting',
      title: job.title,
      description: job.description || `${job.title} bei ${job.company.name}`,
      datePosted: job.publishedAt
        ? job.publishedAt.toISOString().split('T')[0]
        : job.createdAt.toISOString().split('T')[0],
      employmentType,
      hiringOrganization: {
        '@type': 'Organization',
        name: job.company.name,
        ...(job.company.website && { sameAs: job.company.website }),
        ...(job.company.logoUrl && {
          logo: this.getMediaUrl(job.company.logoUrl),
        }),
      },
      identifier: {
        '@type': 'PropertyValue',
        name: 'Genie Job ID',
        value: job.id,
      },
      directApply: false,
    };

    // Valid through
    if (job.expiresAt) {
      schema.validThrough = job.expiresAt.toISOString();
    } else if (job.bewerbungsfrist) {
      schema.validThrough = job.bewerbungsfrist.toISOString();
    }

    // Location
    if (job.city || job.company.city) {
      schema.jobLocation = {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          ...(job.standortAdresse && { streetAddress: job.standortAdresse }),
          ...(!(job.standortAdresse) && job.company.street && { streetAddress: job.company.street }),
          addressLocality: job.city || job.company.city,
          ...(job.postalCode && { postalCode: job.postalCode }),
          ...(!(job.postalCode) && job.company.postalCode && { postalCode: job.company.postalCode }),
          addressCountry: 'DE',
        },
      };

      const lat = job.latitude ? Number(job.latitude) : (job.company.latitude ? Number(job.company.latitude) : null);
      const lng = job.longitude ? Number(job.longitude) : (job.company.longitude ? Number(job.company.longitude) : null);
      if (lat && lng) {
        schema.jobLocation.geo = {
          '@type': 'GeoCoordinates',
          latitude: lat,
          longitude: lng,
        };
      }
    }

    // Remote
    if (job.remote) {
      schema.jobLocationType = 'TELECOMMUTE';
    }

    // Salary
    if (salaryValues.length > 0) {
      schema.baseSalary = {
        '@type': 'MonetaryAmount',
        currency: 'EUR',
        value: {
          '@type': 'QuantitativeValue',
          minValue: Math.min(...salaryValues),
          maxValue: Math.max(...salaryValues),
          unitText: 'MONTH',
        },
      };
    }

    // Benefits
    if (job.benefits) {
      schema.jobBenefits = job.benefits;
    }

    // Industry
    if (job.company.name) {
      schema.industry = job.profession?.category || undefined;
    }

    // Education requirements (portal-specific)
    if (portalSlug === 'werkstudentengenie') {
      schema.educationRequirements = {
        '@type': 'EducationalOccupationalCredential',
        credentialCategory: 'Immatrikulation erforderlich',
      };
    }

    // Work hours for specific portals
    if (portalSlug === 'werkstudentengenie') {
      schema.workHours = 'max. 20h/Woche';
    } else if (portalSlug === 'minijobgenie') {
      schema.workHours = 'geringfügig';
    }

    // Application URL
    schema.applicationContact = {
      '@type': 'ContactPoint',
      url: `https://${portalDomain}/stellen/${job.company.slug}-${job.slug}-${job.id.substring(0, 8)}`,
    };

    return { schema };
  }

  // ─── 5. BY CITY ───────────────────────────────────────────────────────────

  async byCity(city: string, portalId?: number, page?: number, limit?: number) {
    const pag = this.paginate(page, limit);
    const cityDecoded = city
      .replace(/-/g, ' ')
      .replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü');

    const where: any = {
      ...this.baseWhere(portalId),
      city: { contains: cityDecoded },
    };

    const [items, total] = await Promise.all([
      this.prisma.jobPost.findMany({
        where,
        include: this.jobIncludes(),
        orderBy: { publishedAt: 'desc' },
        skip: pag.skip,
        take: pag.limit,
      }),
      this.prisma.jobPost.count({ where }),
    ]);

    return {
      city: { name: cityDecoded, slug: city },
      total,
      items: items.map((j) => this.mapJobListItem(j)),
      pagination: { page: pag.page, limit: pag.limit, totalPages: Math.ceil(total / pag.limit) },
    };
  }

  // ─── 6. BY PROFESSION ─────────────────────────────────────────────────────

  async byProfession(professionSlug: string, portalId?: number, page?: number, limit?: number) {
    const pag = this.paginate(page, limit);

    const profession = await this.prisma.profession.findFirst({
      where: { slug: professionSlug },
      select: { id: true, name: true, slug: true, category: true, shortDescription: true },
    });

    const where: any = this.baseWhere(portalId);
    if (profession) {
      where.professionId = profession.id;
    } else {
      // Fallback: search by beruf field
      where.beruf = { contains: professionSlug.replace(/-/g, ' ') };
    }

    const [items, total] = await Promise.all([
      this.prisma.jobPost.findMany({
        where,
        include: this.jobIncludes(),
        orderBy: { publishedAt: 'desc' },
        skip: pag.skip,
        take: pag.limit,
      }),
      this.prisma.jobPost.count({ where }),
    ]);

    return {
      profession: profession || { name: professionSlug.replace(/-/g, ' '), slug: professionSlug },
      total,
      items: items.map((j) => this.mapJobListItem(j)),
      pagination: { page: pag.page, limit: pag.limit, totalPages: Math.ceil(total / pag.limit) },
    };
  }

  // ─── 7. STATS ─────────────────────────────────────────────────────────────

  async getStats(portalId?: number) {
    const where = this.baseWhere(portalId);

    const [totalJobs, totalCompanies, topCitiesRaw, topProfessionsRaw] = await Promise.all([
      this.prisma.jobPost.count({ where }),
      this.prisma.jobPost.groupBy({
        by: ['companyId'],
        where,
      }).then((r) => r.length),
      this.prisma.jobPost.groupBy({
        by: ['city'],
        where: { ...where, city: { not: null } },
        _count: true,
        orderBy: { _count: { city: 'desc' } },
        take: 15,
      }),
      this.prisma.jobPost.groupBy({
        by: ['professionId'],
        where: { ...where, professionId: { not: null } },
        _count: true,
        orderBy: { _count: { professionId: 'desc' } },
        take: 15,
      }),
    ]);

    // Resolve profession names
    const profIds = topProfessionsRaw.filter((p) => p.professionId).map((p) => p.professionId!);
    const profs = profIds.length > 0
      ? await this.prisma.profession.findMany({
          where: { id: { in: profIds } },
          select: { id: true, name: true, slug: true },
        })
      : [];
    const profMap = new Map(profs.map((p) => [p.id, p]));

    return {
      totalJobs,
      totalCompanies,
      topCities: topCitiesRaw
        .filter((c) => c.city)
        .map((c) => ({ name: c.city!, count: c._count })),
      topProfessions: topProfessionsRaw
        .filter((p) => p.professionId && profMap.has(p.professionId))
        .map((p) => ({
          name: profMap.get(p.professionId!)!.name,
          slug: profMap.get(p.professionId!)!.slug,
          count: p._count,
        })),
    };
  }

  // ─── 8. LATEST ────────────────────────────────────────────────────────────

  async getLatest(portalId?: number, limit = 10) {
    const take = Math.min(50, Math.max(1, limit));

    const items = await this.prisma.jobPost.findMany({
      where: this.baseWhere(portalId),
      include: this.jobIncludes(),
      orderBy: { publishedAt: 'desc' },
      take,
    });

    return {
      items: items.map((j) => this.mapJobListItem(j)),
    };
  }

  // ─── 9. SITEMAP DATA ─────────────────────────────────────────────────────

  async getSitemapData(portalId?: number) {
    const where = this.baseWhere(portalId);

    const [jobs, cities, professions] = await Promise.all([
      this.prisma.jobPost.findMany({
        where,
        select: {
          id: true, slug: true, updatedAt: true,
          company: { select: { slug: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.jobPost.groupBy({
        by: ['city'],
        where: { ...where, city: { not: null } },
        _count: true,
      }),
      this.prisma.jobPost.groupBy({
        by: ['professionId'],
        where: { ...where, professionId: { not: null } },
        _count: true,
      }),
    ]);

    // Resolve profession slugs
    const profIds = professions.filter((p) => p.professionId).map((p) => p.professionId!);
    const profsData = profIds.length > 0
      ? await this.prisma.profession.findMany({
          where: { id: { in: profIds } },
          select: { id: true, slug: true },
        })
      : [];
    const profMap = new Map(profsData.map((p) => [p.id, p.slug]));

    return {
      jobs: jobs.map((j) => ({
        slug: `${j.company?.slug || 'firma'}-${j.slug || 'stelle'}-${j.id.substring(0, 8)}`,
        lastmod: j.updatedAt.toISOString().split('T')[0],
      })),
      cities: cities
        .filter((c) => c.city)
        .map((c) => ({
          slug: c.city!.toLowerCase().replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
          count: c._count,
        })),
      professions: professions
        .filter((p) => p.professionId && profMap.has(p.professionId))
        .map((p) => ({
          slug: profMap.get(p.professionId!)!,
          count: p._count,
        })),
    };
  }
}
