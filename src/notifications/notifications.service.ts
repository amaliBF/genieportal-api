import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // ─── CREATE NOTIFICATION (used internally by other services) ──────────

  async createNotification(data: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        companyUserId: data.companyUserId,
        type: data.type,
        title: data.title,
        body: data.body,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
      },
    });
  }

  // ─── GET USER NOTIFICATIONS (paginated) ───────────────────────────────

  async getUserNotifications(userId: string, page?: number, limit?: number) {
    const currentPage = page && page > 0 ? page : 1;
    const take = limit && limit > 0 && limit <= 100 ? limit : 20;
    const skip = (currentPage - 1) * take;

    const where = { userId };

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: currentPage,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  // ─── GET COMPANY USER NOTIFICATIONS (paginated) ───────────────────────

  async getCompanyNotifications(
    companyUserId: string,
    page?: number,
    limit?: number,
  ) {
    const currentPage = page && page > 0 ? page : 1;
    const take = limit && limit > 0 && limit <= 100 ? limit : 20;
    const skip = (currentPage - 1) * take;

    const where = { companyUserId };

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: currentPage,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  // ─── MARK SINGLE NOTIFICATION AS READ ─────────────────────────────────

  async markAsRead(
    id: string,
    ownerId: string,
    userType: 'user' | 'company',
  ) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Benachrichtigung nicht gefunden');
    }

    const isOwner =
      userType === 'user'
        ? notification.userId === ownerId
        : notification.companyUserId === ownerId;

    if (!isOwner) {
      throw new ForbiddenException('Zugriff verweigert');
    }

    if (notification.isRead) {
      return notification;
    }

    return this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  // ─── MARK ALL NOTIFICATIONS AS READ ───────────────────────────────────

  async markAllAsRead(ownerId: string, userType: 'user' | 'company') {
    const where =
      userType === 'user'
        ? { userId: ownerId, isRead: false }
        : { companyUserId: ownerId, isRead: false };

    const result = await this.prisma.notification.updateMany({
      where,
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updated: result.count };
  }

  // ─── DELETE NOTIFICATION ──────────────────────────────────────────────

  async deleteNotification(
    id: string,
    ownerId: string,
    userType: 'user' | 'company',
  ) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Benachrichtigung nicht gefunden');
    }

    const isOwner =
      userType === 'user'
        ? notification.userId === ownerId
        : notification.companyUserId === ownerId;

    if (!isOwner) {
      throw new ForbiddenException('Zugriff verweigert');
    }

    await this.prisma.notification.delete({ where: { id } });

    return { deleted: true };
  }

  // ─── GET UNREAD COUNT ─────────────────────────────────────────────────

  async getUnreadCount(ownerId: string, userType: 'user' | 'company') {
    const where =
      userType === 'user'
        ? { userId: ownerId, isRead: false }
        : { companyUserId: ownerId, isRead: false };

    const count = await this.prisma.notification.count({ where });

    return { unreadCount: count };
  }
}
