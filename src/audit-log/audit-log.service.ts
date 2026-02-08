import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogEntry {
  adminUserId?: string;
  portalId?: number;
  action: string;
  entityType: string;
  entityId?: string;
  description: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async log(entry: AuditLogEntry) {
    return this.prisma.auditLog.create({
      data: {
        adminUserId: entry.adminUserId,
        portalId: entry.portalId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        description: entry.description,
        oldValues: entry.oldValues,
        newValues: entry.newValues,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  }

  async findAll(options: {
    page?: number;
    limit?: number;
    adminUserId?: string;
    portalId?: number;
    entityType?: string;
    action?: string;
  }) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.adminUserId) where.adminUserId = options.adminUserId;
    if (options.portalId) where.portalId = options.portalId;
    if (options.entityType) where.entityType = options.entityType;
    if (options.action) where.action = options.action;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          adminUser: {
            select: { id: true, name: true, email: true },
          },
          portal: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
