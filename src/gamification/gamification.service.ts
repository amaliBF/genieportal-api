import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  // XP pro Level (1-15)
  private readonly levelThresholds = [
    0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5200, 6600, 8200, 10000, 12000, 15000,
  ];

  constructor(private prisma: PrismaService) {}

  // ─── XP & LEVEL ──────────────────────────────────────────────────────────────

  async addXp(userId: string, amount: number, reason: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true, level: true },
    });
    if (!user) return;

    const newXp = user.xp + amount;
    const newLevel = this.calculateLevel(newXp);

    await this.prisma.user.update({
      where: { id: userId },
      data: { xp: newXp, level: newLevel },
    });

    // Check if level up
    if (newLevel > user.level) {
      this.logger.log(`User ${userId} leveled up: ${user.level} → ${newLevel}`);
    }

    return { xp: newXp, level: newLevel, xpAdded: amount };
  }

  private calculateLevel(xp: number): number {
    for (let i = this.levelThresholds.length - 1; i >= 0; i--) {
      if (xp >= this.levelThresholds[i]) return i + 1;
    }
    return 1;
  }

  // ─── STREAKS ─────────────────────────────────────────────────────────────────

  async updateStreak(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currentStreak: true, longestStreak: true, lastStreakDate: true },
    });
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastDate = user.lastStreakDate ? new Date(user.lastStreakDate) : null;
    if (lastDate) lastDate.setHours(0, 0, 0, 0);

    // Already logged today
    if (lastDate && lastDate.getTime() === today.getTime()) return;

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let newStreak = 1;
    if (lastDate && lastDate.getTime() === yesterday.getTime()) {
      newStreak = user.currentStreak + 1;
    }

    const longestStreak = Math.max(newStreak, user.longestStreak);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        currentStreak: newStreak,
        longestStreak,
        lastStreakDate: today,
      },
    });

    // Award streak XP
    if (newStreak >= 7) {
      await this.addXp(userId, 50, 'weekly_streak');
    } else if (newStreak >= 3) {
      await this.addXp(userId, 20, 'streak_3');
    }

    return { currentStreak: newStreak, longestStreak };
  }

  // ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────

  async checkAndAwardAchievements(userId: string) {
    const achievements = await this.prisma.achievement.findMany({
      where: { isActive: true },
    });

    const userAchievements = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true },
    });

    const unlockedIds = new Set(userAchievements.map((ua) => ua.achievementId));
    const newlyUnlocked: any[] = [];

    for (const achievement of achievements) {
      if (unlockedIds.has(achievement.id)) continue;

      const condition = achievement.condition as any;
      const met = await this.checkCondition(userId, condition);

      if (met) {
        await this.prisma.userAchievement.create({
          data: { userId, achievementId: achievement.id },
        });

        if (achievement.xpReward > 0) {
          await this.addXp(userId, achievement.xpReward, `achievement_${achievement.slug}`);
        }

        newlyUnlocked.push(achievement);
      }
    }

    return newlyUnlocked;
  }

  private async checkCondition(userId: string, condition: any): Promise<boolean> {
    if (!condition?.type) return false;

    switch (condition.type) {
      case 'profile_complete': {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        return (user?.completenessScore || 0) >= (condition.threshold || 100);
      }
      case 'matches_count': {
        const count = await this.prisma.match.count({ where: { userId } });
        return count >= (condition.threshold || 1);
      }
      case 'messages_sent': {
        const count = await this.prisma.message.count({ where: { senderUserId: userId } });
        return count >= (condition.threshold || 1);
      }
      case 'likes_count': {
        const count = await this.prisma.like.count({ where: { userId } });
        return count >= (condition.threshold || 1);
      }
      case 'streak_days': {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        return (user?.longestStreak || 0) >= (condition.threshold || 7);
      }
      case 'applications_count': {
        const count = await this.prisma.application.count({ where: { userId } });
        return count >= (condition.threshold || 1);
      }
      default:
        return false;
    }
  }

  // ─── USER PROFILE DATA ───────────────────────────────────────────────────────

  async getUserStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true, level: true, currentStreak: true, longestStreak: true },
    });
    if (!user) throw new NotFoundException('Benutzer nicht gefunden.');

    const nextLevelXp = this.levelThresholds[user.level] || this.levelThresholds[this.levelThresholds.length - 1];
    const prevLevelXp = this.levelThresholds[user.level - 1] || 0;
    const progress = nextLevelXp > prevLevelXp ? Math.round(((user.xp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100) : 100;

    const achievements = await this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
    });

    return {
      ...user,
      nextLevelXp,
      progress,
      achievements: achievements.map((ua) => ({
        ...ua.achievement,
        unlockedAt: ua.unlockedAt,
      })),
    };
  }

  async getLeaderboard(limit = 20) {
    return this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        firstName: true,
        avatarUrl: true,
        xp: true,
        level: true,
        currentStreak: true,
      },
      orderBy: { xp: 'desc' },
      take: limit,
    });
  }

  async getAllAchievements(userId?: string) {
    const achievements = await this.prisma.achievement.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    if (!userId) return achievements;

    const userAchievements = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true, unlockedAt: true, progress: true },
    });

    const unlocked = new Map(userAchievements.map((ua) => [ua.achievementId, ua]));

    return achievements.map((a) => ({
      ...a,
      unlocked: unlocked.has(a.id),
      unlockedAt: unlocked.get(a.id)?.unlockedAt || null,
      progress: unlocked.get(a.id)?.progress || 0,
    }));
  }
}
