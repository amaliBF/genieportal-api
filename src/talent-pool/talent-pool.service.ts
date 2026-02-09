import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TalentPoolService {
  private readonly logger = new Logger(TalentPoolService.name);

  constructor(private prisma: PrismaService) {}

  async addToPool(companyId: string, userId: string, data: { source?: string; tags?: string[]; notes?: string; rating?: number }) {
    const existing = await this.prisma.talentPool.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });
    if (existing) throw new ConflictException('Kandidat ist bereits im Talent-Pool.');

    return this.prisma.talentPool.create({
      data: {
        companyId,
        userId,
        source: (data.source as any) || 'MANUAL',
        tags: data.tags || [],
        notes: data.notes,
        rating: data.rating,
      },
    });
  }

  async removeFromPool(companyId: string, talentId: string) {
    const talent = await this.prisma.talentPool.findFirst({
      where: { id: talentId, companyId },
    });
    if (!talent) throw new NotFoundException('Kandidat nicht im Talent-Pool.');

    await this.prisma.talentPool.delete({ where: { id: talentId } });
    return { message: 'Kandidat aus Talent-Pool entfernt.' };
  }

  async getPool(companyId: string, page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = { companyId };

    if (search) {
      where.user = {
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { city: { contains: search } },
        ],
      };
    }

    const [talents, total] = await Promise.all([
      this.prisma.talentPool.findMany({
        where,
        include: {
          user: {
            select: {
              id: true, firstName: true, lastName: true, avatarUrl: true,
              city: true, currentSchoolType: true, graduationYear: true,
              bio: true, interests: true, strengths: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.talentPool.count({ where }),
    ]);

    return { data: talents, total, page, totalPages: Math.ceil(total / limit) };
  }

  async updateTalent(companyId: string, talentId: string, data: { tags?: string[]; notes?: string; rating?: number }) {
    const talent = await this.prisma.talentPool.findFirst({
      where: { id: talentId, companyId },
    });
    if (!talent) throw new NotFoundException('Kandidat nicht im Talent-Pool.');

    return this.prisma.talentPool.update({
      where: { id: talentId },
      data: {
        tags: data.tags !== undefined ? data.tags : undefined,
        notes: data.notes,
        rating: data.rating,
      },
    });
  }
}
