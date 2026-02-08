import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) {}

  async findAll(options: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (options.search) {
      where.OR = [
        { name: { contains: options.search } },
        { email: { contains: options.search } },
        { city: { contains: options.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              companies: true,
              subscriptions: true,
              payments: true,
            },
          },
        },
      }),
      this.prisma.customer.count({ where }),
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

  async findById(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        companies: {
          select: {
            id: true,
            name: true,
            email: true,
            city: true,
            subscriptionPlan: true,
            subscriptionStatus: true,
            portalId: true,
            status: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            plan: true,
            status: true,
            priceMonthly: true,
            currency: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            createdAt: true,
            portalId: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Kunde mit ID ${id} nicht gefunden`);
    }

    return customer;
  }

  async create(data: {
    name: string;
    email: string;
    phone?: string;
    street?: string;
    postalCode?: string;
    city?: string;
    taxId?: string;
    notes?: string;
  }) {
    const existing = await this.prisma.customer.findFirst({
      where: { email: data.email },
    });
    if (existing) {
      throw new BadRequestException(
        `Ein Kunde mit der E-Mail ${data.email} existiert bereits`,
      );
    }

    return this.prisma.customer.create({ data });
  }

  async update(
    id: string,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      street?: string;
      postalCode?: string;
      city?: string;
      taxId?: string;
      notes?: string;
      tags?: any;
    },
  ) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Kunde mit ID ${id} nicht gefunden`);
    }

    return this.prisma.customer.update({ where: { id }, data });
  }

  async getStats() {
    const [total, withSubscriptions, totalRevenue] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.customer.count({
        where: { subscriptions: { some: { status: 'ACTIVE' } } },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'SUCCEEDED' },
      }),
    ]);

    return {
      total,
      withActiveSubscriptions: withSubscriptions,
      totalRevenue: totalRevenue._sum.amount || 0,
    };
  }
}
