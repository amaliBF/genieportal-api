import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PortalService {
  constructor(private prisma: PrismaService) {}

  async findAllPublic() {
    return this.prisma.portal.findMany({
      where: { status: 'LIVE' },
      select: {
        id: true,
        name: true,
        slug: true,
        beschreibung: true,
        domain: true,
        farbe: true,
        icon: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  async findAll() {
    const portals = await this.prisma.portal.findMany({
      orderBy: { id: 'asc' },
    });

    // Enrich with counts
    const enriched = await Promise.all(
      portals.map(async (portal) => {
        const [companyCount, userCount, jobCount, subscriptionCount] =
          await Promise.all([
            this.prisma.company.count({ where: { portalId: portal.id } }),
            this.prisma.user.count({ where: { portalId: portal.id } }),
            this.prisma.jobPost.count({ where: { portalId: portal.id } }),
            this.prisma.subscription.count({
              where: { portalId: portal.id, status: 'ACTIVE' },
            }),
          ]);

        return {
          ...portal,
          _count: {
            companies: companyCount,
            users: userCount,
            jobs: jobCount,
            activeSubscriptions: subscriptionCount,
          },
        };
      }),
    );

    return enriched;
  }

  async findById(id: number) {
    const portal = await this.prisma.portal.findUnique({
      where: { id },
    });

    if (!portal) {
      throw new NotFoundException(`Portal mit ID ${id} nicht gefunden`);
    }

    const [companyCount, userCount, jobCount, videoCount, subscriptionCount] =
      await Promise.all([
        this.prisma.company.count({ where: { portalId: id } }),
        this.prisma.user.count({ where: { portalId: id } }),
        this.prisma.jobPost.count({ where: { portalId: id } }),
        this.prisma.video.count({
          where: { company: { portalId: id } },
        }),
        this.prisma.subscription.count({
          where: { portalId: id, status: 'ACTIVE' },
        }),
      ]);

    return {
      ...portal,
      _count: {
        companies: companyCount,
        users: userCount,
        jobs: jobCount,
        videos: videoCount,
        activeSubscriptions: subscriptionCount,
      },
    };
  }

  async update(id: number, data: { status?: string; description?: string }) {
    const portal = await this.prisma.portal.findUnique({ where: { id } });
    if (!portal) {
      throw new NotFoundException(`Portal mit ID ${id} nicht gefunden`);
    }

    return this.prisma.portal.update({
      where: { id },
      data: {
        ...(data.status && { status: data.status as any }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
      },
    });
  }
}
