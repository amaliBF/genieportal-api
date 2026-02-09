import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(private prisma: PrismaService) {}

  // ─── FRIENDSHIPS ─────────────────────────────────────────────────────────────

  async sendFriendRequest(senderId: string, receiverId: string) {
    if (senderId === receiverId) throw new BadRequestException('Du kannst dir nicht selbst eine Anfrage senden.');

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'BLOCKED') throw new BadRequestException('Aktion nicht möglich.');
      throw new ConflictException('Freundschaftsanfrage existiert bereits.');
    }

    return this.prisma.friendship.create({
      data: { senderId, receiverId },
    });
  }

  async acceptFriendRequest(userId: string, friendshipId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: { id: friendshipId, receiverId: userId, status: 'FRIENDSHIP_PENDING' },
    });
    if (!friendship) throw new NotFoundException('Anfrage nicht gefunden.');

    return this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'ACCEPTED' },
    });
  }

  async declineFriendRequest(userId: string, friendshipId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: { id: friendshipId, receiverId: userId, status: 'FRIENDSHIP_PENDING' },
    });
    if (!friendship) throw new NotFoundException('Anfrage nicht gefunden.');

    await this.prisma.friendship.delete({ where: { id: friendshipId } });
    return { message: 'Anfrage abgelehnt.' };
  }

  async removeFriend(userId: string, friendshipId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        id: friendshipId,
        OR: [{ senderId: userId }, { receiverId: userId }],
        status: 'ACCEPTED',
      },
    });
    if (!friendship) throw new NotFoundException('Freundschaft nicht gefunden.');

    await this.prisma.friendship.delete({ where: { id: friendshipId } });
    return { message: 'Freundschaft entfernt.' };
  }

  async getFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
        status: 'ACCEPTED',
      },
      include: {
        sender: { select: { id: true, firstName: true, avatarUrl: true, city: true, level: true } },
        receiver: { select: { id: true, firstName: true, avatarUrl: true, city: true, level: true } },
      },
    });

    return friendships.map((f) => ({
      friendshipId: f.id,
      friend: f.senderId === userId ? f.receiver : f.sender,
      since: f.updatedAt,
    }));
  }

  async getPendingRequests(userId: string) {
    return this.prisma.friendship.findMany({
      where: { receiverId: userId, status: 'FRIENDSHIP_PENDING' },
      include: {
        sender: { select: { id: true, firstName: true, avatarUrl: true, city: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── JOB RECOMMENDATIONS ─────────────────────────────────────────────────────

  async recommendJob(senderId: string, receiverId: string, jobPostId: string, message?: string) {
    // Verify friendship exists
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
        status: 'ACCEPTED',
      },
    });
    if (!friendship) throw new BadRequestException('Ihr müsst befreundet sein, um Stellen zu empfehlen.');

    return this.prisma.jobRecommendation.create({
      data: { senderId, receiverId, jobPostId, message },
    });
  }

  async getRecommendations(userId: string) {
    return this.prisma.jobRecommendation.findMany({
      where: { receiverId: userId },
      include: {
        sender: { select: { firstName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  // ─── REFERRAL CODES ──────────────────────────────────────────────────────────

  async getOrCreateReferralCode(userId: string) {
    const existing = await this.prisma.referralCode.findFirst({
      where: { userId, isActive: true },
    });
    if (existing) return existing;

    const code = randomBytes(4).toString('hex').toUpperCase();
    return this.prisma.referralCode.create({
      data: { userId, code },
    });
  }

  async useReferralCode(userId: string, code: string) {
    const referral = await this.prisma.referralCode.findUnique({ where: { code } });
    if (!referral || !referral.isActive) throw new NotFoundException('Ungültiger Empfehlungscode.');
    if (referral.userId === userId) throw new BadRequestException('Du kannst deinen eigenen Code nicht einlösen.');
    if (referral.maxUsages && referral.usageCount >= referral.maxUsages) {
      throw new BadRequestException('Dieser Code wurde bereits maximal eingelöst.');
    }

    await this.prisma.referralCode.update({
      where: { code },
      data: { usageCount: { increment: 1 } },
    });

    return { message: 'Empfehlungscode eingelöst!', xpEarned: referral.xpPerReferral };
  }

  // ─── SKILL TESTS ─────────────────────────────────────────────────────────────

  async getAvailableTests() {
    return this.prisma.skillTest.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, name: true, description: true, icon: true, category: true, difficulty: true, durationMin: true, passingScore: true },
      orderBy: { category: 'asc' },
    });
  }

  async getTest(slug: string) {
    const test = await this.prisma.skillTest.findUnique({ where: { slug } });
    if (!test) throw new NotFoundException('Test nicht gefunden.');
    return test;
  }

  async submitTestResult(userId: string, skillTestId: string, data: { score: number; answers: any[]; timeSpentSec?: number }) {
    const test = await this.prisma.skillTest.findUnique({ where: { id: skillTestId } });
    if (!test) throw new NotFoundException('Test nicht gefunden.');

    const passed = data.score >= test.passingScore;
    const xpEarned = passed ? 30 : 10;

    const result = await this.prisma.skillTestResult.create({
      data: {
        userId,
        skillTestId,
        score: data.score,
        passed,
        answers: data.answers || [],
        timeSpentSec: data.timeSpentSec,
        xpEarned,
      },
    });

    return { ...result, testName: test.name, passed, xpEarned };
  }

  async getMyTestResults(userId: string) {
    return this.prisma.skillTestResult.findMany({
      where: { userId },
      include: { skillTest: { select: { name: true, slug: true, icon: true, category: true } } },
      orderBy: { completedAt: 'desc' },
    });
  }
}
