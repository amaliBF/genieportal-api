import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompanyFollowService {
  private readonly logger = new Logger(CompanyFollowService.name);

  constructor(private prisma: PrismaService) {}

  async follow(userId: string, companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Unternehmen nicht gefunden.');

    const existing = await this.prisma.companyFollow.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });

    if (existing) {
      throw new ConflictException('Du folgst diesem Unternehmen bereits.');
    }

    await this.prisma.companyFollow.create({
      data: { userId, companyId },
    });

    return { message: `Du folgst jetzt ${company.name}.`, following: true };
  }

  async unfollow(userId: string, companyId: string) {
    const existing = await this.prisma.companyFollow.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });

    if (!existing) {
      throw new NotFoundException('Du folgst diesem Unternehmen nicht.');
    }

    await this.prisma.companyFollow.delete({
      where: { userId_companyId: { userId, companyId } },
    });

    return { message: 'Unternehmen entfolgt.', following: false };
  }

  async toggleNotify(userId: string, companyId: string, notify: boolean) {
    const follow = await this.prisma.companyFollow.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });

    if (!follow) throw new NotFoundException('Du folgst diesem Unternehmen nicht.');

    await this.prisma.companyFollow.update({
      where: { userId_companyId: { userId, companyId } },
      data: { notify },
    });

    return { notify };
  }

  async getFollowing(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [follows, total] = await Promise.all([
      this.prisma.companyFollow.findMany({
        where: { userId },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              city: true,
              industry: true,
              shortDescription: true,
              _count: { select: { jobPosts: { where: { status: 'ACTIVE' } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.companyFollow.count({ where: { userId } }),
    ]);

    return {
      data: follows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFollowers(companyId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [followers, total] = await Promise.all([
      this.prisma.companyFollow.findMany({
        where: { companyId },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true, city: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.companyFollow.count({ where: { companyId } }),
    ]);

    return { data: followers, total, page, totalPages: Math.ceil(total / limit) };
  }

  async isFollowing(userId: string, companyId: string) {
    const follow = await this.prisma.companyFollow.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    return { following: !!follow, notify: follow?.notify ?? false };
  }

  async getFollowerCount(companyId: string) {
    const count = await this.prisma.companyFollow.count({ where: { companyId } });
    return { count };
  }
}
