import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ─── DASHBOARD ──────────────────────────────────────────────────────────

  async getDashboard() {
    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      totalCompanies,
      activeCompanies,
      pendingCompanies,
      totalJobPosts,
      activeJobPosts,
      totalVideos,
      activeVideos,
      processingVideos,
      rejectedVideos,
      totalMatches,
      activeMatches,
      totalEvents,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { status: 'BANNED' } }),
      this.prisma.company.count(),
      this.prisma.company.count({ where: { status: 'ACTIVE' } }),
      this.prisma.company.count({ where: { status: 'PENDING' } }),
      this.prisma.jobPost.count(),
      this.prisma.jobPost.count({ where: { status: 'ACTIVE' } }),
      this.prisma.video.count(),
      this.prisma.video.count({ where: { status: 'ACTIVE' } }),
      this.prisma.video.count({ where: { status: 'PROCESSING' } }),
      this.prisma.video.count({ where: { status: 'REJECTED' } }),
      this.prisma.match.count(),
      this.prisma.match.count({ where: { status: 'ACTIVE' } }),
      this.prisma.event.count(),
    ]);

    // Recent signups (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      recentUsers,
      recentCompanies,
      recentMatches,
      freeCompanies,
      starterCompanies,
      proCompanies,
      enterpriseCompanies,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.company.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.match.count({
        where: { matchedAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.company.count({ where: { subscriptionPlan: 'FREE' } }),
      this.prisma.company.count({ where: { subscriptionPlan: 'STARTER' } }),
      this.prisma.company.count({ where: { subscriptionPlan: 'PRO' } }),
      this.prisma.company.count({ where: { subscriptionPlan: 'ENTERPRISE' } }),
    ]);

    // Portal counts
    const [portalCount, customerCount, activeSubCount] = await Promise.all([
      this.prisma.portal.count(),
      this.prisma.customer.count(),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        banned: bannedUsers,
        recentSignups: recentUsers,
      },
      companies: {
        total: totalCompanies,
        active: activeCompanies,
        pending: pendingCompanies,
        recentSignups: recentCompanies,
      },
      jobPosts: {
        total: totalJobPosts,
        active: activeJobPosts,
      },
      videos: {
        total: totalVideos,
        active: activeVideos,
        processing: processingVideos,
        rejected: rejectedVideos,
      },
      matches: {
        total: totalMatches,
        active: activeMatches,
        recentMatches,
      },
      events: {
        total: totalEvents,
      },
      subscriptions: {
        free: freeCompanies,
        starter: starterCompanies,
        pro: proCompanies,
        enterprise: enterpriseCompanies,
        paying: starterCompanies + proCompanies + enterpriseCompanies,
      },
      portals: {
        total: portalCount,
      },
      customers: {
        total: customerCount,
      },
      activeSubscriptions: activeSubCount,
    };
  }

  // ─── USERS ──────────────────────────────────────────────────────────────

  async getUsers(
    page: number,
    limit: number,
    search?: string,
    status?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { displayName: { contains: search } },
        { city: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          displayName: true,
          avatarUrl: true,
          city: true,
          status: true,
          emailVerified: true,
          profileComplete: true,
          createdAt: true,
          lastActiveAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        likes: {
          select: { id: true, companyId: true, jobPostId: true, videoId: true, createdAt: true },
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
        matches: {
          select: {
            id: true,
            companyId: true,
            jobPostId: true,
            status: true,
            matchedAt: true,
            company: {
              select: { id: true, name: true },
            },
          },
          take: 20,
          orderBy: { matchedAt: 'desc' },
        },
        notifications: {
          select: { id: true, type: true, title: true, isRead: true, createdAt: true },
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            likes: true,
            matches: true,
            chats: true,
            messages: true,
            notifications: true,
            events: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Benutzer nicht gefunden');
    }

    // Exclude sensitive fields
    const {
      passwordHash,
      refreshToken,
      emailVerifyToken,
      passwordResetToken,
      passwordResetExpires,
      ...safeUser
    } = user;

    return safeUser;
  }

  async updateUserStatus(id: string, status: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('Benutzer nicht gefunden');
    }

    const data: Record<string, any> = { status };

    if (status === 'DELETED') {
      data.deletedAt = new Date();
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  // ─── COMPANIES ──────────────────────────────────────────────────────────

  async getCompanies(
    page: number,
    limit: number,
    search?: string,
    status?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { city: { contains: search } },
        { legalName: { contains: search } },
        { industry: { contains: search } },
      ];
    }

    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          city: true,
          industry: true,
          status: true,
          verified: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
          maxJobPosts: true,
          maxVideos: true,
          createdAt: true,
          _count: {
            select: {
              companyUsers: true,
              jobPosts: true,
              videos: true,
              matches: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      data: companies,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCompanyDetail(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        companyUsers: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            emailVerified: true,
            createdAt: true,
            lastLoginAt: true,
          },
        },
        jobPosts: {
          select: {
            id: true,
            title: true,
            status: true,
            viewCount: true,
            likeCount: true,
            matchCount: true,
            createdAt: true,
            publishedAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        videos: {
          select: {
            id: true,
            title: true,
            status: true,
            viewCount: true,
            likeCount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        subscriptions: {
          select: {
            id: true,
            plan: true,
            status: true,
            priceMonthly: true,
            currency: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            cancelAt: true,
            canceledAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            companyUsers: true,
            jobPosts: true,
            videos: true,
            matches: true,
            likes: true,
            companyLikes: true,
            chats: true,
            subscriptions: true,
            events: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Unternehmen nicht gefunden');
    }

    return company;
  }

  async updateCompanyStatus(id: string, status: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException('Unternehmen nicht gefunden');
    }

    const data: Record<string, any> = { status };

    if (status === 'DELETED') {
      data.deletedAt = new Date();
    }

    const updated = await this.prisma.company.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  async verifyCompany(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException('Unternehmen nicht gefunden');
    }

    const updated = await this.prisma.company.update({
      where: { id },
      data: {
        verified: true,
        verifiedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        verified: true,
        verifiedAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  // ─── VIDEOS ─────────────────────────────────────────────────────────────

  async getVideos(page: number, limit: number, status?: string) {
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {};

    if (status) {
      where.status = status;
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
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.video.count({ where }),
    ]);

    return {
      data: videos,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateVideoStatus(
    id: string,
    status: string,
    moderationNote?: string,
  ) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!video) {
      throw new NotFoundException('Video nicht gefunden');
    }

    const data: Record<string, any> = { status };

    if (moderationNote !== undefined) {
      data.moderationNote = moderationNote;
    }

    if (status === 'ACTIVE') {
      data.publishedAt = new Date();
    }

    const updated = await this.prisma.video.update({
      where: { id },
      data,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return updated;
  }

  // ─── FINANCE ────────────────────────────────────────────────────────────

  async getFinanceOverview() {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalPayments,
      thisMonthPayments,
      lastMonthPayments,
      activeSubscriptions,
      subscriptionsByPlan,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { status: 'SUCCEEDED' },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        _count: true,
        where: {
          status: 'SUCCEEDED',
          createdAt: { gte: thisMonthStart },
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        _count: true,
        where: {
          status: 'SUCCEEDED',
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
        },
      }),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.subscription.groupBy({
        by: ['plan'],
        where: { status: 'ACTIVE' },
        _count: true,
        _sum: { priceMonthly: true },
      }),
    ]);

    // Calculate MRR from active subscriptions
    const mrr = subscriptionsByPlan.reduce(
      (sum, s) => sum + Number(s._sum.priceMonthly || 0),
      0,
    );

    return {
      totalRevenue: Number(totalPayments._sum.amount || 0),
      totalPaymentCount: totalPayments._count,
      thisMonth: {
        revenue: Number(thisMonthPayments._sum.amount || 0),
        count: thisMonthPayments._count,
      },
      lastMonth: {
        revenue: Number(lastMonthPayments._sum.amount || 0),
        count: lastMonthPayments._count,
      },
      mrr,
      activeSubscriptions,
      subscriptionsByPlan: subscriptionsByPlan.map((s) => ({
        plan: s.plan,
        count: s._count,
        mrr: Number(s._sum.priceMonthly || 0),
      })),
    };
  }

  async getPayments(
    page: number,
    limit: number,
    status?: string,
    provider?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: Record<string, any> = {};
    if (status) where.status = status;
    if (provider) where.provider = provider;

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getSubscriptions(
    page: number,
    limit: number,
    status?: string,
    plan?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: Record<string, any> = {};
    if (status) where.status = status;
    if (plan) where.plan = plan;

    const [data, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: {
            select: { id: true, name: true, email: true, city: true },
          },
          portal: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── ADMIN USERS ───────────────────────────────────────────────────────

  async getAdminUsers() {
    return this.prisma.adminUser.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        portalAccess: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateAdminUser(
    id: string,
    data: {
      role?: string;
      firstName?: string;
      lastName?: string;
      portalAccess?: any;
      isActive?: boolean;
    },
  ) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!admin) {
      throw new NotFoundException('Admin-Benutzer nicht gefunden');
    }

    return this.prisma.adminUser.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
        portalAccess: true,
      },
    });
  }

  // ─── EVENTS ─────────────────────────────────────────────────────────────

  async getRecentEvents(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.event.count(),
    ]);

    return {
      data: events,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
