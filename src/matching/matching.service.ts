import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // USER LIKES
  // ═══════════════════════════════════════════════════════════════════════════

  async userLikeCompany(
    userId: string,
    companyId: string,
    source?: string,
  ): Promise<{ liked: boolean; matched: boolean }> {
    try {
      await this.prisma.like.create({
        data: {
          userId,
          companyId,
          source,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Bereits geliked');
      }
      throw error;
    }

    // Check if company already liked this user -> Match!
    const companyLike = await this.prisma.companyLike.findUnique({
      where: {
        companyId_userId: { companyId, userId },
      },
    });

    if (companyLike) {
      await this.createMatch(userId, companyId, 'user', companyLike.jobPostId ?? undefined);
      return { liked: true, matched: true };
    }

    return { liked: true, matched: false };
  }

  async userLikeJob(
    userId: string,
    jobPostId: string,
    source?: string,
  ): Promise<{ liked: boolean; matched: boolean }> {
    // Get companyId from job post
    const jobPost = await this.prisma.jobPost.findUnique({
      where: { id: jobPostId },
      select: { companyId: true },
    });

    if (!jobPost) {
      throw new NotFoundException('Stellenanzeige nicht gefunden');
    }

    try {
      await this.prisma.like.create({
        data: {
          userId,
          jobPostId,
          source,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Bereits geliked');
      }
      throw error;
    }

    // Increment job post like count
    await this.prisma.jobPost.update({
      where: { id: jobPostId },
      data: { likeCount: { increment: 1 } },
    });

    // Check if company already liked this user -> Match!
    const companyLike = await this.prisma.companyLike.findUnique({
      where: {
        companyId_userId: { companyId: jobPost.companyId, userId },
      },
    });

    if (companyLike) {
      await this.createMatch(
        userId,
        jobPost.companyId,
        'user',
        jobPostId,
      );
      return { liked: true, matched: true };
    }

    return { liked: true, matched: false };
  }

  async userLikeVideo(
    userId: string,
    videoId: string,
  ): Promise<{ liked: boolean }> {
    try {
      await this.prisma.like.create({
        data: {
          userId,
          videoId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Bereits geliked');
      }
      throw error;
    }

    // Increment video like count
    await this.prisma.video.update({
      where: { id: videoId },
      data: { likeCount: { increment: 1 } },
    });

    return { liked: true };
  }

  async userUnlikeCompany(userId: string, companyId: string): Promise<void> {
    try {
      await this.prisma.like.delete({
        where: {
          userId_companyId: { userId, companyId },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Like nicht gefunden');
      }
      throw error;
    }
  }

  async userUnlikeJob(userId: string, jobPostId: string): Promise<void> {
    try {
      await this.prisma.like.delete({
        where: {
          userId_jobPostId: { userId, jobPostId },
        },
      });

      // Decrement job post like count
      await this.prisma.jobPost.update({
        where: { id: jobPostId },
        data: { likeCount: { decrement: 1 } },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Like nicht gefunden');
      }
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPANY LIKES
  // ═══════════════════════════════════════════════════════════════════════════

  async companyLikeUser(
    companyId: string,
    userId: string,
    likedById: string,
    jobPostId?: string,
    note?: string,
  ): Promise<{ liked: boolean; matched: boolean }> {
    try {
      await this.prisma.companyLike.create({
        data: {
          companyId,
          userId,
          likedById,
          jobPostId,
          note,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Bereits geliked');
      }
      throw error;
    }

    // Check if user already liked this company -> Match!
    const userLike = await this.prisma.like.findUnique({
      where: {
        userId_companyId: { userId, companyId },
      },
    });

    if (userLike) {
      await this.createMatch(userId, companyId, 'company', jobPostId);
      return { liked: true, matched: true };
    }

    return { liked: true, matched: false };
  }

  async companyPassUser(
    companyId: string,
    userId: string,
  ): Promise<{ passed: boolean }> {
    // No specific model for passes - just acknowledge
    this.logger.log(
      `Company ${companyId} passed on user ${userId}`,
    );
    return { passed: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MATCHES
  // ═══════════════════════════════════════════════════════════════════════════

  async createMatch(
    userId: string,
    companyId: string,
    initiatedBy: string,
    jobPostId?: string,
  ) {
    // Check if match already exists
    const existingMatch = await this.prisma.match.findUnique({
      where: {
        userId_companyId: { userId, companyId },
      },
    });

    if (existingMatch) {
      this.logger.warn(
        `Match already exists between user ${userId} and company ${companyId}`,
      );
      return existingMatch;
    }

    // Create match + chat in a transaction
    const match = await this.prisma.$transaction(async (tx) => {
      const newMatch = await tx.match.create({
        data: {
          userId,
          companyId,
          jobPostId,
          initiatedBy,
          status: 'ACTIVE',
        },
      });

      // Auto-create chat for the match
      await tx.chat.create({
        data: {
          matchId: newMatch.id,
          userId,
          companyId,
        },
      });

      return tx.match.findUnique({
        where: { id: newMatch.id },
        include: {
          chat: true,
          company: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              city: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      });
    });

    this.logger.log(
      `Match created between user ${userId} and company ${companyId}`,
    );

    return match;
  }

  async getUserMatches(userId: string) {
    return this.prisma.match.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            city: true,
            industry: true,
            shortDescription: true,
          },
        },
        jobPost: {
          select: {
            id: true,
            title: true,
          },
        },
        chat: {
          select: {
            id: true,
            lastMessageAt: true,
            lastMessagePreview: true,
            userUnreadCount: true,
            isActive: true,
          },
        },
      },
      orderBy: { matchedAt: 'desc' },
    });
  }

  async getCompanyMatches(companyId: string) {
    return this.prisma.match.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            city: true,
            currentSchoolType: true,
            graduationYear: true,
            bio: true,
          },
        },
        jobPost: {
          select: {
            id: true,
            title: true,
          },
        },
        chat: {
          select: {
            id: true,
            lastMessageAt: true,
            lastMessagePreview: true,
            companyUnreadCount: true,
            isActive: true,
          },
        },
      },
      orderBy: { matchedAt: 'desc' },
    });
  }

  async getUserLikes(userId: string) {
    return this.prisma.like.findMany({
      where: { userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            city: true,
            industry: true,
          },
        },
        jobPost: {
          select: {
            id: true,
            title: true,
            company: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
              },
            },
          },
        },
        video: {
          select: {
            id: true,
            title: true,
            thumbnailPath: true,
            company: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCompanyCandidates(companyId: string) {
    // Get users who liked this company (directly or via job posts)
    const directLikes = await this.prisma.like.findMany({
      where: { companyId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            city: true,
            currentSchoolType: true,
            graduationYear: true,
            bio: true,
            interests: true,
            strengths: true,
            preferredProfessions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get users who liked job posts of this company
    const jobLikes = await this.prisma.like.findMany({
      where: {
        jobPost: { companyId },
        companyId: null, // only job likes, not direct company likes
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            city: true,
            currentSchoolType: true,
            graduationYear: true,
            bio: true,
            interests: true,
            strengths: true,
            preferredProfessions: true,
          },
        },
        jobPost: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Check which users the company has already liked
    const companyLikes = await this.prisma.companyLike.findMany({
      where: { companyId },
      select: { userId: true },
    });
    const likedUserIds = new Set(companyLikes.map((cl) => cl.userId));

    // Check which users already have a match
    const matches = await this.prisma.match.findMany({
      where: { companyId },
      select: { userId: true },
    });
    const matchedUserIds = new Set(matches.map((m) => m.userId));

    // Combine and deduplicate
    const candidateMap = new Map<
      string,
      {
        user: any;
        likeSource: string;
        jobPost?: any;
        likedAt: Date;
        companyLiked: boolean;
        matched: boolean;
      }
    >();

    for (const like of directLikes) {
      candidateMap.set(like.userId, {
        user: like.user,
        likeSource: 'company',
        likedAt: like.createdAt,
        companyLiked: likedUserIds.has(like.userId),
        matched: matchedUserIds.has(like.userId),
      });
    }

    for (const like of jobLikes) {
      if (!candidateMap.has(like.userId)) {
        candidateMap.set(like.userId, {
          user: like.user,
          likeSource: 'job',
          jobPost: like.jobPost,
          likedAt: like.createdAt,
          companyLiked: likedUserIds.has(like.userId),
          matched: matchedUserIds.has(like.userId),
        });
      }
    }

    return Array.from(candidateMap.values());
  }

  async deleteMatch(matchId: string, userId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { chat: true },
    });

    if (!match) {
      throw new NotFoundException('Match nicht gefunden');
    }

    // Verify user is part of this match
    if (match.userId !== userId) {
      throw new ForbiddenException('Kein Zugriff auf dieses Match');
    }

    await this.prisma.$transaction(async (tx) => {
      // Set match status to DECLINED
      await tx.match.update({
        where: { id: matchId },
        data: { status: 'DECLINED' },
      });

      // Deactivate associated chat
      if (match.chat) {
        await tx.chat.update({
          where: { id: match.chat.id },
          data: { isActive: false },
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MATCH DETAIL (App)
  // ═══════════════════════════════════════════════════════════════════════════

  async getMatchDetail(matchId: string, userId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
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
            shortDescription: true,
            description: true,
            verified: true,
            website: true,
            employeeCount: true,
            foundedYear: true,
            benefits: true,
          },
        },
        jobPost: {
          include: {
            profession: {
              select: {
                id: true,
                name: true,
                slug: true,
                category: true,
              },
            },
            videos: {
              where: { status: 'ACTIVE' },
              select: {
                id: true,
                title: true,
                processedPath: true,
                thumbnailPath: true,
                durationSeconds: true,
              },
            },
            videoJobPosts: {
              include: {
                video: {
                  select: {
                    id: true,
                    title: true,
                    processedPath: true,
                    thumbnailPath: true,
                    durationSeconds: true,
                    status: true,
                  },
                },
              },
              orderBy: { position: 'asc' },
            },
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            city: true,
          },
        },
        chat: {
          select: {
            id: true,
            isActive: true,
            lastMessageAt: true,
            lastMessagePreview: true,
            userUnreadCount: true,
            companyUnreadCount: true,
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Match nicht gefunden');
    }

    if (match.userId !== userId) {
      throw new ForbiddenException('Kein Zugriff auf dieses Match');
    }

    return match;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER LIKED JOBS (App - Profil)
  // ═══════════════════════════════════════════════════════════════════════════

  async getUserLikedJobs(userId: string) {
    const likes = await this.prisma.like.findMany({
      where: {
        userId,
        jobPostId: { not: null },
      },
      include: {
        jobPost: {
          select: {
            id: true,
            title: true,
            slug: true,
            city: true,
            postalCode: true,
            salaryYear1: true,
            status: true,
            portalId: true,
            company: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                city: true,
                verified: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Check which liked jobs have a match
    const matchedJobIds = new Set<string>();
    const matches = await this.prisma.match.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { jobPostId: true },
    });
    for (const m of matches) {
      if (m.jobPostId) matchedJobIds.add(m.jobPostId);
    }

    return likes
      .filter((l) => l.jobPost)
      .map((l) => ({
        likedAt: l.createdAt,
        isMatch: l.jobPostId ? matchedJobIds.has(l.jobPostId) : false,
        jobPost: l.jobPost,
      }));
  }
}
