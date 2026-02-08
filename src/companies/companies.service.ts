import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  // ─── PUBLIC PROFILE ────────────────────────────────────────────────────

  async getPublicProfile(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        slug: true,
        legalName: true,
        phone: true,
        website: true,
        street: true,
        postalCode: true,
        city: true,
        latitude: true,
        longitude: true,
        industry: true,
        industryTags: true,
        description: true,
        shortDescription: true,
        foundedYear: true,
        employeeCount: true,
        logoUrl: true,
        coverImageUrl: true,
        trainingSince: true,
        totalApprentices: true,
        benefits: true,
        verified: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            companyUsers: true,
            jobPosts: { where: { status: 'ACTIVE' } },
            videos: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });

    if (!company || company.status !== 'ACTIVE') {
      throw new NotFoundException('Unternehmen nicht gefunden');
    }

    return company;
  }

  // ─── OWN PROFILE (DASHBOARD) ──────────────────────────────────────────

  async getOwnProfile(companyUserId: string) {
    const companyUser = await this.prisma.companyUser.findUnique({
      where: { id: companyUserId },
      select: { companyId: true },
    });

    if (!companyUser) {
      throw new NotFoundException('Benutzer nicht gefunden');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyUser.companyId },
      include: {
        _count: {
          select: {
            companyUsers: true,
            jobPosts: true,
            videos: true,
            matches: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Unternehmen nicht gefunden');
    }

    return company;
  }

  // ─── UPDATE PROFILE ───────────────────────────────────────────────────

  async updateProfile(
    companyId: string,
    companyUserId: string,
    dto: UpdateCompanyDto,
  ) {
    const companyUser = await this.prisma.companyUser.findUnique({
      where: { id: companyUserId },
    });

    if (!companyUser || companyUser.companyId !== companyId) {
      throw new ForbiddenException('Zugriff verweigert');
    }

    if (!companyUser.canEditProfile) {
      throw new ForbiddenException(
        'Keine Berechtigung zum Bearbeiten des Profils',
      );
    }

    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.legalName !== undefined && { legalName: dto.legalName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.street !== undefined && { street: dto.street }),
        ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.industry !== undefined && { industry: dto.industry }),
        ...(dto.industryTags !== undefined && { industryTags: dto.industryTags }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.shortDescription !== undefined && {
          shortDescription: dto.shortDescription,
        }),
        ...(dto.foundedYear !== undefined && { foundedYear: dto.foundedYear }),
        ...(dto.employeeCount !== undefined && {
          employeeCount: dto.employeeCount,
        }),
        ...(dto.trainingSince !== undefined && {
          trainingSince: dto.trainingSince,
        }),
        ...(dto.totalApprentices !== undefined && {
          totalApprentices: dto.totalApprentices,
        }),
        ...(dto.benefits !== undefined && { benefits: dto.benefits }),
      },
    });

    return company;
  }

  // ─── COMPANY VIDEOS ───────────────────────────────────────────────────

  async getCompanyVideos(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, status: true },
    });

    if (!company || company.status !== 'ACTIVE') {
      throw new NotFoundException('Unternehmen nicht gefunden');
    }

    return this.prisma.video.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnailPath: true,
        processedPath: true,
        durationSeconds: true,
        videoType: true,
        featuredPerson: true,
        viewCount: true,
        likeCount: true,
        publishedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── COMPANY JOBS ─────────────────────────────────────────────────────

  async getCompanyJobs(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, status: true },
    });

    if (!company || company.status !== 'ACTIVE') {
      throw new NotFoundException('Unternehmen nicht gefunden');
    }

    return this.prisma.jobPost.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
      },
      include: {
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
      orderBy: { createdAt: 'desc' },
    });
  }
}
