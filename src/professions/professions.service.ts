import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProfessionsService {
  constructor(private prisma: PrismaService) {}

  // ─── LIST ALL PROFESSIONS ─────────────────────────────────────────────────

  async findAll(category?: string) {
    const where: any = { isActive: true };

    if (category) {
      where.category = category;
    }

    return this.prisma.profession.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  // ─── FIND SINGLE PROFESSION ───────────────────────────────────────────────

  async findOne(id: string) {
    const profession = await this.prisma.profession.findUnique({
      where: { id },
    });

    if (!profession) {
      throw new NotFoundException('Beruf nicht gefunden');
    }

    return profession;
  }

  // ─── GET DISTINCT CATEGORIES ──────────────────────────────────────────────

  async getCategories() {
    const results = await this.prisma.profession.findMany({
      where: { isActive: true, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    return results.map((r) => r.category);
  }

  // ─── GET VIDEOS FOR PROFESSION ────────────────────────────────────────────

  async getVideosByProfession(professionId: string) {
    const profession = await this.prisma.profession.findUnique({
      where: { id: professionId },
    });

    if (!profession) {
      throw new NotFoundException('Beruf nicht gefunden');
    }

    return this.prisma.video.findMany({
      where: {
        professionId,
        status: 'ACTIVE',
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── GET JOBS FOR PROFESSION ──────────────────────────────────────────────

  async getJobsByProfession(professionId: string) {
    const profession = await this.prisma.profession.findUnique({
      where: { id: professionId },
    });

    if (!profession) {
      throw new NotFoundException('Beruf nicht gefunden');
    }

    return this.prisma.jobPost.findMany({
      where: {
        professionId,
        status: 'ACTIVE',
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            city: true,
            postalCode: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── SEARCH PROFESSIONS ──────────────────────────────────────────────────

  async search(query: string) {
    return this.prisma.profession.findMany({
      where: {
        isActive: true,
        name: {
          contains: query,
        },
      },
      orderBy: { name: 'asc' },
    });
  }
}
