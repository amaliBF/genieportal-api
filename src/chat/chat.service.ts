import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageType } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // USER CHATS
  // ═══════════════════════════════════════════════════════════════════════════

  async getUserChats(userId: string) {
    return this.prisma.chat.findMany({
      where: { userId, isActive: true },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
        match: {
          select: {
            id: true,
            jobPostId: true,
            status: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPANY CHATS
  // ═══════════════════════════════════════════════════════════════════════════

  async getCompanyChats(companyId: string) {
    return this.prisma.chat.findMany({
      where: { companyId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        match: {
          select: {
            id: true,
            jobPostId: true,
            status: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET MESSAGES (paginated)
  // ═══════════════════════════════════════════════════════════════════════════

  async getMessages(
    chatId: string,
    userId: string,
    userType: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });

    if (!chat) {
      throw new NotFoundException('Chat nicht gefunden');
    }

    // Verify access
    await this.verifyAccess(chat, userId, userType);

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { chatId, isDeleted: false },
        include: {
          senderUser: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
          senderCompanyUser: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({ where: { chatId, isDeleted: false } }),
    ]);

    return {
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEND MESSAGE
  // ═══════════════════════════════════════════════════════════════════════════

  async sendMessage(
    chatId: string,
    senderType: string,
    senderId: string,
    content: string,
    messageType: string = 'TEXT',
  ) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });

    if (!chat) {
      throw new NotFoundException('Chat nicht gefunden');
    }

    if (!chat.isActive) {
      throw new ForbiddenException('Chat ist nicht mehr aktiv');
    }

    // Verify sender access
    await this.verifyAccess(chat, senderId, senderType);

    const preview = content.substring(0, 200);

    // Create message and update chat in a transaction
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          chatId,
          senderType,
          senderUserId: senderType === 'user' ? senderId : null,
          senderCompanyUserId: senderType === 'company' ? senderId : null,
          content,
          messageType: messageType as MessageType,
        },
        include: {
          senderUser: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
          senderCompanyUser: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.chat.update({
        where: { id: chatId },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: preview,
          // Increment unread count for the OTHER side
          ...(senderType === 'user'
            ? { companyUnreadCount: { increment: 1 } }
            : { userUnreadCount: { increment: 1 } }),
        },
      }),
    ]);

    return message;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MARK AS READ
  // ═══════════════════════════════════════════════════════════════════════════

  async markAsRead(chatId: string, userId: string, userType: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });

    if (!chat) {
      throw new NotFoundException('Chat nicht gefunden');
    }

    await this.verifyAccess(chat, userId, userType);

    if (userType === 'user') {
      // Reset user unread count and mark company messages as read
      await this.prisma.$transaction([
        this.prisma.chat.update({
          where: { id: chatId },
          data: { userUnreadCount: 0 },
        }),
        this.prisma.message.updateMany({
          where: {
            chatId,
            senderType: 'company',
            isRead: false,
          },
          data: {
            isRead: true,
            readAt: new Date(),
          },
        }),
      ]);
    } else {
      // Reset company unread count and mark user messages as read
      await this.prisma.$transaction([
        this.prisma.chat.update({
          where: { id: chatId },
          data: { companyUnreadCount: 0 },
        }),
        this.prisma.message.updateMany({
          where: {
            chatId,
            senderType: 'user',
            isRead: false,
          },
          data: {
            isRead: true,
            readAt: new Date(),
          },
        }),
      ]);
    }

    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET CHAT BY ID
  // ═══════════════════════════════════════════════════════════════════════════

  async getChatById(chatId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        match: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
      },
    });

    if (!chat) {
      throw new NotFoundException('Chat nicht gefunden');
    }

    return chat;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async verifyAccess(
    chat: { userId: string; companyId: string },
    userId: string,
    userType: string,
  ) {
    if (userType === 'user') {
      if (chat.userId !== userId) {
        throw new ForbiddenException('Kein Zugriff auf diesen Chat');
      }
    } else if (userType === 'company') {
      // For company users, verify they belong to the company
      const companyUser = await this.prisma.companyUser.findUnique({
        where: { id: userId },
      });

      if (!companyUser || companyUser.companyId !== chat.companyId) {
        throw new ForbiddenException('Kein Zugriff auf diesen Chat');
      }
    } else {
      throw new ForbiddenException('Ungueltiger Benutzertyp');
    }
  }
}
